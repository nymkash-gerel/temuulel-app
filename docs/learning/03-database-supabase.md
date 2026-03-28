# 🗄️ Хичээл 3: Database & Supabase

## Database гэж юу вэ?

**Зүйрлэл:** Шүүгээ бодоорой. Шүүгээ дотор олон тасалгаа (хүснэгт/table) байна. Тасалгаа бүрт тодорхой зүйл хадгална — нэг тасалгаанд хувцас, нөгөөд гутал. Database бол компьютерийн "шүүгээ" — мэдээллийг зохион байгуулж хадгална.

### Гол ойлголтууд

| Нэр | Зүйрлэл | Тайлбар |
|-----|----------|---------|
| **Table** (хүснэгт) | Excel хүснэгт | Мэдээллийн хүснэгт — stores, orders, products |
| **Row** (мөр) | Excel мөр | Нэг бичлэг — нэг захиалга, нэг бараа |
| **Column** (багана) | Excel багана | Мэдээллийн талбар — name, price, status |
| **Primary Key** | Иргэний үнэмлэхний дугаар | Мөр бүрийг онцгойлох ID |
| **Foreign Key** | "Аав ээж нь хэн бэ?" | Өөр хүснэгттэй холбоос |

---

## Supabase гэж юу вэ?

**Зүйрлэл:** Database-ийг ингэж төсөөл — агуулах. Supabase бол тэр агуулахад нэвтрэх ухаалаг хаалгач. Хэн нэвтрэхийг шалгана, юу авч болохыг хянана, шинэ зүйл нэмэгдэхэд мэдэгдэл өгнө.

Supabase = **PostgreSQL database** + **Auth** + **Realtime** + **Storage** нэг дор

Temuulel app бүхэлдээ Supabase ашигладаг!

---

## 📊 Бодит хүснэгтийн жишээ

📁 **Файл:** `supabase/migrations/001_initial_schema.sql`

### users хүснэгт — Хэрэглэгчид

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'owner',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

| Мөр | Тайлбар |
|-----|---------|
| `id UUID PRIMARY KEY` | Өвөрмөц ID — `"a1b2c3d4-..."` |
| `email TEXT NOT NULL` | И-мэйл заавал байна (`NOT NULL`) |
| `phone TEXT` | Утас — байхгүй байж болно |
| `DEFAULT 'owner'` | Анхдагч утга — бүртгүүлэхэд `'owner'` |
| `REFERENCES auth.users(id)` | Supabase Auth хүснэгттэй холбоотой |
| `ON DELETE CASCADE` | Auth хэрэглэгч устгавал энэ мөр ч устна |
| `TIMESTAMPTZ DEFAULT now()` | Одоогийн цаг автомат хадгалагдана |

### stores хүснэгт — Дэлгүүрүүд

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  business_type TEXT,
  ai_auto_reply BOOLEAN DEFAULT true,
  chatbot_settings JSONB DEFAULT '{}',
  shipping_settings JSONB DEFAULT '{}',
  payment_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Хүснэгтүүд хоорондоо хэрхэн холбогддог:**

```
users ─────── stores ─────── products
  │              │               │
  │              │               │
  │              ├── orders ─── order_items
  │              │
  │              ├── customers
  │              │
  │              └── conversations ── messages
  │
  └── store_members (баг гишүүн)
```

`owner_id UUID REFERENCES users(id)` — stores хүснэгтийн `owner_id` нь users хүснэгтийн `id`-тай холбогдоно.

---

## 🔍 Supabase Query-ууд

### `.select()` — Мэдээлэл унших

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

```typescript
const { data } = await supabase
  .from('orders')                    // orders хүснэгтээс
  .select(`
    id, order_number, status, total_amount, created_at,
    customers(id, name, phone),      // холбоотой customers хүснэгтээс
    order_items(
      id, quantity, unit_price,
      products(name)                 // order_items → products хүснэгтээс
    )
  `)
  .eq('store_id', store.id)          // Зөвхөн энэ дэлгүүрийнхийг
  .order('created_at', { ascending: false })  // Шинэ нь эхэнд
```

| Мөр | Тайлбар |
|-----|---------|
| `.from('orders')` | `orders` хүснэгтийг сонго |
| `.select('id, name, ...')` | Ямар баганыг авахыг зааж өгнө |
| `customers(id, name, phone)` | Холбоотой `customers` хүснэгтээс нэр, утас авна |
| `.eq('store_id', store.id)` | `store_id = 'xxx'` шүүлтүүр |
| `.order('created_at', { ascending: false })` | Шинэ нь эхэнд эрэмбэлнэ |

### `.insert()` — Шинэ мэдээлэл нэмэх

📁 **Файл:** `src/lib/notifications.ts`

```typescript
await supabase.from('notifications').insert({
  store_id: storeId,
  type: event,           // 'new_order'
  title,                 // 'Шинэ захиалга #ORD-123'
  body,                  // 'Нийт: 25,000₮'
  data,                  // { order_number: 'ORD-123', total_amount: 25000 }
  is_read: false,        // Уншаагүй
})
```

### `.update()` — Мэдээлэл шинэчлэх

```typescript
await supabase
  .from('orders')
  .update({ status: 'confirmed' })   // Төлөвийг 'confirmed' болгох
  .eq('id', orderId)                  // Энэ ID-тай захиалгыг
```

### `.delete()` — Мэдээлэл устгах

```typescript
await supabase
  .from('products')
  .delete()
  .eq('id', productId)   // Энэ ID-тай бүтээгдэхүүнийг устгана
```

---

## 🔐 RLS (Row Level Security) — Мөрийн түвшний хамгаалалт

**Зүйрлэл:** Шүүгээний тасалгаа бүрт цоож бодоорой. Бат зөвхөн өөрийн тасалгааг нээж чадна, Дорж зөвхөн өөрийнхөө. RLS бол database-ийн "цоож" — хэрэглэгч бүр зөвхөн ӨӨР мэдээллээ харна.

📁 **Файл:** `supabase/migrations/001_initial_schema.sql`

```sql
-- 1. RLS идэвхжүүлэх
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 2. Дүрэм тодорхойлох: Эзэмшигч бүх үйлдэл хийж болно
CREATE POLICY "stores_owner_all" ON stores
  FOR ALL USING (owner_id = auth.uid());

-- 3. Баг гишүүн зөвхөн уншиж болно
CREATE POLICY "stores_member_select" ON stores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM store_members
      WHERE store_members.store_id = stores.id
      AND store_members.user_id = auth.uid()
    )
  );
```

| Мөр | Тайлбар |
|-----|---------|
| `ENABLE ROW LEVEL SECURITY` | Энэ хүснэгтэд хамгаалалт идэвхжүүлнэ |
| `FOR ALL USING (owner_id = auth.uid())` | Нэвтэрсэн хэрэглэгчийн ID = эзэмшигчийн ID бол бүх үйлдэл зөвшөөрнө |
| `FOR SELECT` | Зөвхөн уншихыг зөвшөөрнө |
| `auth.uid()` | Одоо нэвтэрсэн хэрэглэгчийн ID |

### Яагаад RLS чухал вэ?

RLS байхгүй бол:
```typescript
// ⚠️ АЮУЛТАЙ! Дорж нэвтрээд Батын дэлгүүрийн бүх захиалгыг харж чадна
await supabase.from('orders').select('*')
```

RLS байвал:
```typescript
// ✅ АЮУЛГҮЙ! Дорж зөвхөн ӨӨР дэлгүүрийнхээ захиалгыг харна
await supabase.from('orders').select('*')
// RLS автоматаар .eq('store_id', Доржийн_store_id) нэмнэ
```

---

## 🏪 store_id — Multi-tenancy

📁 **Файл:** `src/lib/resolve-store.ts`

Temuulel app олон дэлгүүрт зориулсан. Дэлгүүр бүр ӨӨР мэдээлэлтэй. `store_id` бол тэдгээрийг ялгах түлхүүр.

```typescript
export async function resolveStoreId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  // 1-р шалгалт: Эзэмшигч мөн үү?
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .single()

  if (store) return store.id

  // 2-р шалгалт: Баг гишүүн мөн үү?
  const { data: membership } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .single()

  if (!membership) return null
  return membership.store_id ?? null
}
```

Энэ функц юу хийдэг вэ?
1. Хэрэглэгч дэлгүүрийн **эзэмшигч** мөн эсэхийг шалгана
2. Үгүй бол **баг гишүүн** мөн эсэхийг шалгана
3. Аль нь ч биш бол `null` буцаана

---

## 📦 Migration — Database-ийн өөрчлөлтийн түүх

**Зүйрлэл:** Барилгын зураг төсөл бодоорой. Анхны зураг → нэмэлт давхар → гараж нэмэх. Migration бол database-ийн "өөрчлөлтийн түүх".

```
supabase/migrations/
├── 001_initial_schema.sql      ← Анхны бүтэц
├── 002_notifications_realtime.sql
├── 003_escalation.sql
├── 009_comment_auto_reply.sql
├── 014_performance_indexes.sql
├── 019_deliveries.sql
└── 020_driver_portal.sql
```

Migration файл бүр хэзээ, юу өөрчлөгдсөнийг хадгална. Шинэ хөгжүүлэгч `001`-ээс `020` хүртэл бүгдийг ажиллуулаад **яг адилхан** database авна.

---

## 🎯 Дасгал

### Дасгал 1: Query бичих
Бүх `"pending"` статустай захиалгыг авах query бич:

<details>
<summary>💡 Хариу харах</summary>

```typescript
const { data } = await supabase
  .from('orders')
  .select('id, order_number, total_amount, status')
  .eq('status', 'pending')
  .order('created_at', { ascending: false })
```
</details>

### Дасгал 2: Insert бичих
Шинэ бүтээгдэхүүн нэмэх query бич (name, base_price, store_id шаардлагатай):

<details>
<summary>💡 Хариу харах</summary>

```typescript
await supabase.from('products').insert({
  name: 'Кашемир цамц',
  base_price: 89000,
  store_id: 'xxx-yyy-zzz',
})
```
</details>

### Дасгал 3: RLS ойлгох
Хэрэв RLS идэвхгүй байвал ямар аюултай вэ? 2 жишээ бич.

<details>
<summary>💡 Хариу харах</summary>

1. Нэг дэлгүүрийн эзэмшигч өөр дэлгүүрийн БҮТЭЭГДЭХҮҮНИЙ ҮНИЙГ өөрчилж чадна
2. Хэрэглэгч бүх дэлгүүрийн ЗАХИАЛГЫН мэдээллийг (утас, хаяг) харж чадна
</details>

---

👉 **Дараагийн хичээл:** [04-rest-api.md](./04-rest-api.md) — REST API
