---
name: "chat-qa"
description: Жинхэнэ хэрэглэгч мэт AI чатботтой монголоор ярилцаж, ойлголт/хариултын чанар + бодит үйлдэл (захиалга, буцаалт, гомдол→escalation, нөхөн олговрын voucher) DB-д үүссэн эсэхийг end-to-end шалгана. "чатбот шалга", "chat qa", "чат тест", "бот ойлгож байна уу" гэхэд ашигла.
argument-hint: <сценари (заавал биш): order | return | complaint | coupon | бүгд>
---

# Chat QA — чатботын end-to-end чанарын шалгалт

Жинхэнэ хэрэглэгч мэт `/api/chat/widget` руу монголоор мессеж илгээж, 2 түвшинд үнэлнэ:
1. **Ойлголт/хариулт** — intent зөв таньсан, зөв мэдээлэл өгсөн, монгол хэл нь зөв эсэх
2. **Бодит үйлдэл** — DB-д жинхэнэ мөр үүссэн эсэх (захиалга, interaction, escalation, voucher)

## Урьдчилсан нөхцөл

1. **Локал Supabase асаалттай** (`supabase status`; унтарсан бол `supabase stop && supabase start`)
2. **Dev server асаалттай** — `preview_start` (name: dev), port 3000
3. **Seed хийгдсэн store** — `a1b2c3d4-e5f6-4789-ab01-234567890abc` (Монгол Маркет, 10 бараа). Байхгүй бол:
   `SUPABASE_SECRET_KEY=$(grep '^SUPABASE_SECRET_KEY=' .env.local | cut -d= -f2- | tr -d '"') npx tsx scripts/seed-local.ts`
4. `OPENAI_API_KEY` тохируулсан (.env.local) — pipeline бодит GPT дууддаг

## Ажиллуулах

Драйвер: `scripts/chat-qa.mjs`. Мессеж бүрийг дараалан илгээж, хариуг хэвлэнэ.

```bash
node scripts/chat-qa.mjs "<сценари нэр>" "<conversation-uuid-V4>" "<sender-id>" "мессеж 1" "мессеж 2" ...
```

**ХАТУУ ДҮРЭМ:**
- `conversation_id` + store_id **ЗААВАЛ UUID v4** (Zod strict, version nibble = 4). Жишээ: `11111111-1111-4111-8111-111111111111`. v4 биш бол `400 Invalid UUID`.
- Ярилцлага бүрд ШИНЭ conversation_id; нэг хэрэглэгчийн үргэлжлэл бол ижил `sender_id`.
- Rate limit 20/мин — драйвер 1.5s sleep хийдэг, нэг дуудлагад ~8-аас олон мессеж бүү өг.
- Туршилтын sender_id-г `web_qa_` угтвартай өг — дараа нь цэвэрлэхэд амар.

## Сценариуд (батлагдсан урсгалууд)

### 1. Захиалга (order) — ✅ 2026-07-20 бүрэн батлагдсан
Мессежүүд: бараа асуух → үнэ асуух → "авъя" → (бот variant асууна: "2" гэх мэт сонгох) → нэр → утас → хаяг → "Тийм"
- Бот variant жагсаалт харуулж, нэр/утас/хаяг цуглуулж, дүн + хүргэлтийн төлбөр гаргаж, баталгаажуулна.
- **DB шалгалт:** `orders` (order_number, status=pending, total_amount, shipping_address), `order_items` (variant_label), `product_variants.stock_quantity` хасагдсан эсэх.

### 2. Буцаалт (return)
"Захиалсан [бараа] гэмтэлтэй ирлээ, буцаамаар байна"
- Бот захиалгын дугаар + шалтгаан асууна.
- **DB:** `customer_interactions` (interaction_type='return_request').

### 3. Гомдол → Escalation (complaint)
Ууртай өнгө аястай мессеж ("Яагаад ийм удаан юм бэ, муу үйлчилгээ, мөнгөө буцаа")
- Бот уучлал гуйж + менежерт шилжүүлнэ (`escalated: true`).
- **DB:** `conversations.status = 'escalated'`.

### 4. Нөхөн олговрын coupon (compensation voucher)
Гомдол escalate хийгдэхэд `compensation_policies`-д тухайн store+category-ийн идэвхтэй policy байвал `vouchers`-т автоматаар COMP-* voucher үүсдэг (`src/lib/escalation.ts:450+`).
- **Эхлээд policy seed хий** (байхгүй бол voucher гарахгүй — энэ нь bug БИШ):
  `insert into compensation_policies (store_id, complaint_category, compensation_type, compensation_value, auto_approve, is_active) values ('<store>', '<category>', 'percent_discount', 10, true, true);`
- **DB:** `vouchers` (voucher_code like 'COMP-%', status).

### 5. Loyalty point — ⚠️ чатаар олгогддоггүй
Loyalty оноо зөвхөн `/api/loyalty-transactions` API-аар удирдагддаг; чат pipeline-д автомат олголт байхгүй. Чатаар шалгах юмгүй — API-г шууд тестлэ, эсвэл энэ хязгаарлалтыг тайланд дурд.

## DB шалгалтын жишээ query-үүд

```bash
D() { docker exec supabase_db_temuulel-app psql -U postgres -tA -F' | ' "$@" 2>/dev/null; }
D -c "select order_number,status,total_amount from public.orders where store_id='<store>' order by created_at desc limit 3;"
D -c "select interaction_type,left(summary,50) from public.customer_interactions where store_id='<store>' order by created_at desc limit 5;"
D -c "select id,status from public.conversations where store_id='<store>';"
D -c "select voucher_code,status,compensation_type from public.vouchers where store_id='<store>' order by created_at desc limit 3;"
```

Багана нэрс: orders-д `shipping_address`/`shipping_amount` (delivery_* биш), order_items-д `variant_label`, products-д `base_price` (price биш).

## Тайлангийн формат

Сценари бүрд: `✅/❌ | юу илгээсэн | бот юу хариулсан (товч) | DB-д юу үүссэн | чанарын тэмдэглэл`.
Төгсгөлд: ойлголтын алдаа (буруу intent, утгагүй хариулт), монгол хэлний алдаа, дутуу үйлдлүүдийг жагсаа. Унасан зүйлийг НУУХГҮЙ.

## Known Issues (ажиллуулах бүрт энд сургамжаа бич)

<!--
- [2026-07-20] "ямар бараа байгаа вэ?" (ерөнхий каталог асуулт) → бот TV тавиурын sales_script-ийг шууд буулгасан (утгагүй). Ерөнхий каталог асуултын хариу сул — quality finding, шалгалт бүрт ажиглах.
- [2026-07-20] Гомдол escalate хийгдэхэд customer_interactions-д 'complaint' мөр БИЧИГДЭЭГҮЙ (зөвхөн return_request бичигдсэн) — escalation зам эрт return хийдэг бололтой. Шалгаж тодруулах.
- [2026-07-20] Хэрэглэгч нэрний оронд утас өгөхөд бот хаягаа дахин асууж зөв сэргэсэн; утас нь summary-д зөв орсон (сайн).
- [2026-07-20] tsx нь .env.local-ийг өөрөө ачаалдаггүй — SUPABASE_SECRET_KEY-г гараар дамжуул.
- [2026-07-20] Coupon сценари батлагдсан: ГАНЦ гомдлын мессежээр escalation асахгүй (score хүрэхгүй) — 2 дахь ууртай мессеж хэрэгтэй. Гэмтэлтэй бараа + муу үйлчилгээ хосолсон гомдлыг classifier 'service_quality' гэж ангилсан (damaged_item биш) — policy-г олон ангилалд seed хийх нь найдвартай. Voucher: COMP-* код, auto_approve=true үед status='approved'.
-->
