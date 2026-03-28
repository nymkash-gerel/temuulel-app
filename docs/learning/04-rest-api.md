# 🌐 Хичээл 4: REST API

## API гэж ��у вэ?

**Зүйрлэл:** Зоогийн газар бодоорой. Чи цэс харна (API documentation), зөөгчид захиалга хэлнэ (request), тогооч хоол бэлдэнэ (server), зөөгч хоол авчирна (response). API бол зөөгч — чи тогоочтой ШУУД ярьдаггүй, зөөгчөөр дамжуулна.

```
Хэрэглэгч (Browser)  →  API (зөөгч)  →  Database (тогооч)
         ←  Хариу (хоол)  ←
```

### REST гэж юу вэ?

REST = API-ийн **дүрэм**. Зоогийн газрын жишээгээр:

| HTTP Method | Зүйрлэл | Утга |
|-------------|----------|------|
| **GET** | "Цэс харуулна уу?" | Мэдээлэл уншина |
| **POST** | "Шинэ захиалга!" | Шинэ зүйл үүсгэнэ |
| **PATCH** | "Захиалга засна уу? Бифштексийг medium болгоно уу" | Мэдээлэл шинэчилнэ |
| **DELETE** | "Захиалга цуцалъя" | Мэдээлэл устгана |

---

## 📦 Бодит жишээ: POST /api/orders

📁 **Файл:** `src/app/api/orders/route.ts`

Энэ файл нь шинэ захиалга үүсгэдэг API endpoint.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createOrderSchema } from '@/lib/validations'
import { dispatchNotification } from '@/lib/notifications'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

export async function POST(request: NextRequest) {
  // ── 1. Rate limit шалгах ──────────────────────────
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    )
  }

  // ── 2. Өгөгдлийг шалгах (validation) ─────────────
  const { data: body, error: validationError } = await validateBody(
    request,
    createOrderSchema
  )
  if (validationError) return validationError

  // ── 3. Дэлгүүр байгаа эсэхийг шалгах ────────────
  const { data: store } = await supabase
    .from('stores')
    .select('id, shipping_settings, busy_mode')
    .eq('id', body.store_id)
    .single()

  if (!store) {
    return NextResponse.json(
      { error: 'Store not found' },
      { status: 404 }
    )
  }

  // ── 4. Дэлгүүр завгүй бол татгалзах ─────────────
  if (store.busy_mode) {
    return NextResponse.json({
      error: 'Дэлгүүр одоогоор захиалга авахгүй байна',
      busy: true,
    }, { status: 503 })
  }

  // ── 5. Захиалга үүсгэх ───────────────────────────
  // ... database insert ...

  // ── 6. Мэдэгдэл илгээх ───────────────────────────
  await dispatchNotification(store.id, 'new_order', { ... })

  return NextResponse.json({ order }, { status: 201 })
}
```

### Алхам бүрийн тайлбар:

| Алхам | Юу хийнэ | Яагаад |
|-------|----------|--------|
| 1. Rate limit | 1 минутад 10 хүсэлт хүртэл зөвшөөрнө | Халдлагаас хамгаална |
| 2. Validation | Ирсэн мэдээллийг шалгана | Буруу мэдээлэл орохоос сэргийлнэ |
| 3. Store check | Дэлгүүр байгаа эсэх | Байхгүй дэлгүүрт захиалга үүсгэхгүй |
| 4. Busy mode | Дэлгүүр завгүй эсэх | Ачаалал ихтэй үед захиалга хааж болно |
| 5. Create | Database-д бичнэ | Бодит захиалга үүсгэнэ |
| 6. Notify | Email, push, webhook илгээнэ | Эзэмшигчид мэдэгдэнэ |

---

## 📊 Status Codes — Хариуны код

**Зүйрлэл:** Зоогийн газрын хариу:
- "Хоол бэлэн!" = ✅ Амжилттай
- "Уучлаарай, тэр хоол дууссан" = ❌ Олдсонгүй
- "Тогооч завгүй байна, хүлээнэ үү" = ⏳ Серверийн алдаа

| Code | Нэр | Утга | Жишээ |
|------|-----|------|-------|
| **200** | OK | Амжилттай | Захиалгуудын жагсаалт ирлээ |
| **201** | Created | Шинэ зүйл үүслээ | Захиалга амжилттай |
| **400** | Bad Request | Буруу хүсэлт | "quantity" талбар дутуу |
| **401** | Unauthorized | Нэвтрээгүй | Login хийгээгүй |
| **404** | Not Found | Олдсонгүй | Тийм ID-тай захиалга байхгүй |
| **429** | Too Many Requests | Хэт олон хүсэлт | 1 минутад 10-аас олон |
| **500** | Server Error | Серверийн алдаа | Code-д bug бий |
| **503** | Service Unavailable | Үйлчилгээ боломжгүй | Дэлгүүр busy mode |

---

## 🔍 Request ба Response

### Request (Хүсэлт)

Browser → Server рүү илгээдэг мэдээлэл:

```
POST /api/orders
Content-Type: application/json

{
  "store_id": "abc-123",
  "customer_id": "cust-456",
  "items": [
    { "product_id": "prod-1", "quantity": 2, "unit_price": 15000 }
  ],
  "shipping_address": "БЗД 3-р хороо",
  "order_type": "delivery"
}
```

### Response (Хариу)

Server → Browser рүү буцаадаг хариу:

```json
// Амжилттай (201)
{
  "order": {
    "id": "ord-789",
    "order_number": "ORD-1711234567890",
    "status": "pending",
    "total_amount": 35000
  }
}

// Алдаатай (400)
{
  "error": "items: Required"
}
```

---

## 🛡️ Validation — Өгөгдлийг шалгах

📁 **Файл:** `src/lib/validations.ts`

**Зүйрлэл:** Нисэх онгоцны аюулгүй байдлын шалгалт бодоорой. Зорчигч бүрийг шалгана — зөвшөөрөгдөөгүй зүйл дотогш орохгүй. Validation бол API-ийн "аюулгүй байдлын шалгалт".

```typescript
import { z } from 'zod'

export const chatMessageSchema = z.object({
  sender_id: z.string().trim().min(1, 'Cannot be empty'),  // Хоосон байж болохгүй
  store_id: z.string().uuid(),                              // UUID формат
  role: z.enum(['user', 'assistant']),                      // Зөвхөн 2 утга
  content: z.string().min(1).max(2000),                     // 1-2000 тэмдэгт
  metadata: z.record(z.string(), z.unknown()).optional(),   // Заавал биш
})
```

| Шалгалт | Тайлбар |
|---------|---------|
| `.trim().min(1)` | Хоосон зай авсны дараа 1+ тэмдэгт байх |
| `.uuid()` | UUID формат байх: `"a1b2c3d4-..."` |
| `.enum(['user', 'assistant'])` | Зөвхөн эдгээрийн нэг байх |
| `.min(1).max(2000)` | 1-ээс 2000 тэмдэгт хооронд |
| `.optional()` | Байхгүй байж болно |

### validateBody функц

```typescript
export async function validateBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { error: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return { error: NextResponse.json({ error: issues }, { status: 400 }) }
  }

  return { data: result.data }
}
```

Энэ функц:
1. Request-ийн JSON-г уншина
2. Schema-аар шалгана
3. Алдаатай бол **ямар талбарт, ямар алдаа** гэдгийг хэлнэ

---

## ⏱️ Rate Limiting — Хүсэлтийн хязгаар

📁 **Файл:** `src/lib/rate-limit.ts`

**Зүйрлэл:** Цахилгаан шатны хүний тоо хязгаартай — 10 хүн л багтана. Rate limiting бол API-ийн "хүний тоо хязгаар" — тодорхой хугацаанд хэт олон хүсэлт ирэхээс хамгаална.

```typescript
const RATE_LIMIT = { limit: 10, windowSeconds: 60 }
// 1 минутад нэг IP-аас 10 хүсэлт хүртэл
```

### Яагаад хэрэгтэй вэ?

1. **Халдагч** 1 секундэд 1000 хүсэлт илгээж server-ийг унагаж болно
2. **Bot** бүх бүтээгдэхүүний мэдээллийг хулгайлж болно
3. **Буруу код** давталтад орж мянга мянган хүсэлт илгээж болно

Rate limit-тэй бол 1 минутад 10-аас олон хүсэлт илгээвэл `429 Too Many Requests` хариу ирнэ.

---

## 🎯 Дасгал

### Дасгал 1: HTTP Methods тааруулах
Аль method-г ашиглах вэ?

1. Бүх захиалгыг харуулах → ???
2. Шинэ бүтээгдэхүүн нэмэх → ???
3. Захиалгын хаягийг засах → ???
4. Бүтээгдэхүүн устгах → ???

<details>
<summary>💡 Хариу харах</summary>

1. `GET /api/orders`
2. `POST /api/products`
3. `PATCH /api/orders/[id]`
4. `DELETE /api/products/[id]`
</details>

### Дасгал 2: Status code тааруулах
Ямар status code буцаах вэ?

1. Захиалга амжилттай үүслээ
2. `product_id` талбар дутуу
3. Login хийгээгүй хүн dashboard руу орох гэсэн
4. 1 минутад 100 удаа хүсэлт илгээсэн

<details>
<summary>💡 Хариу харах</summary>

1. `201 Created`
2. `400 Bad Request`
3. `401 Unauthorized`
4. `429 Too Many Requests`
</details>

---

👉 **Дараагийн хичээл:** [05-auth-security.md](./05-auth-security.md) — Authentication & Security
