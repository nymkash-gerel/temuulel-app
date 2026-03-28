# 🔤 Хичээл 1: TypeScript Үндэс

## TypeScript гэж юу вэ?

**Зүйрлэл:** Тоглоомон хайрцаг дотор юу юу байдгийг бичсэн шошго бодоорой. "Энэ хайрцагт ЗӨВХӨН машин тоглоом хийнэ" гэж бичвэл, хүүхэлдэй хийхийг оролдоход "Энэ хайрцагт машин тоглоом л хийх ёстой!" гэж анхааруулна. TypeScript бол яг ийм — код бичихдээ "энэ хувьсагчид ЗӨВХӨН тоо хийнэ" гэж зааж өгнө.

**JavaScript** — хайрцагт юу ч хийж болно (алдаа гарч болно!)
**TypeScript** — хайрцаг бүрт шошго наасан (алдааг урьдчилан анхааруулна)

### Яагаад хэрэгтэй вэ?

Temuulel app 100+ файлтай. TypeScript байхгүй бол:
- Захиалгын `total_amount`-д "hello" гэж тоо биш утга хийчихэж болно
- `customer.phone` гэхэд customer нь `null` байж болно — app унана

TypeScript байвал **код бичиж байхдаа** алдааг харуулна, хэрэглэгч дээр биш.

---

## 📦 Үндсэн төрлүүд (Basic Types)

### string — Текст

```typescript
// Хэрэглэгчийн нэр = текст
let customerName: string = 'Бат'
let phone: string = '99001122'

// ❌ Алдаа! Тоо хийж болохгүй — string гэж зааж өгсөн
// customerName = 123
```

### number — Тоо

```typescript
// Захиалгын дүн = тоо
let totalAmount: number = 25000
let quantity: number = 3

// ❌ Алдаа! Текст хийж болохгүй
// totalAmount = 'арван мянга'
```

### boolean — Тийм/Үгүй

```typescript
// Дэлгүүр завгүй эсэх = тийм/үгүй
let busyMode: boolean = false
let aiAutoReply: boolean = true
```

### array — Жагсаалт

```typescript
// Бүтээгдэхүүний нэрсийн жагсаалт
let productNames: string[] = ['Цамц', 'Өмд', 'Малгай']

// Захиалгын тоонуудын жагсаалт
let prices: number[] = [15000, 25000, 8000]
```

---

## 🏷️ interface — Бүтцийн тодорхойлолт

**Зүйрлэл:** Анкет маягт бодоорой. "Нэр: ___, Утас: ___, Нас: ___" гэж нүд бүрт юу бичихийг заасан. `interface` бол яг ийм маягт — объект ямар талбартай байхыг тодорхойлно.

### Бодит жишээ: Temuulel-ийн OrderItem

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

```typescript
interface OrderItem {
  id: string                    // Бүтээгдэхүүний ID (текст)
  quantity: number              // Тоо ширхэг (тоо)
  unit_price: number            // Нэгж үнэ (тоо)
  variant_label: string | null  // Хэмжээ/өнгө (текст эсвэл хоосон)
  products: { name: string } | null  // Бүтээгдэхүүний нэр (объект эсвэл хоосон)
}
```

**Мөр бүрийг тайлбарлая:**

| Мөр | Тайлбар |
|-----|---------|
| `id: string` | Бүтээгдэхүүний ID нь текст. Жишээ: `"abc-123"` |
| `quantity: number` | Хэдэн ширхэг авах вэ? Жишээ: `2` |
| `unit_price: number` | Нэг ширхгийн үнэ. Жишээ: `15000` |
| `variant_label: string \| null` | Хэмжээ/өнгө байж болно, байхгүй ч байж болно (`null`) |
| `products: { name: string } \| null` | Бүтээгдэхүүний нэр. `null` байвал нэргүй |

### `string | null` гэж юу вэ?

`|` тэмдэг нь "ЭСВЭЛ" гэсэн утгатай:

```typescript
variant_label: string | null
// Энэ нь: "Цэнхэр / XL" гэсэн текст ЭСВЭЛ null (хоосон) байж болно
```

Яагаад `null` зөвшөөрдөг вэ? Бүх бараанд размер/өнгө байдаггүй. Жишээ нь шампунь — размер гэж юу ч байхгүй.

### Бодит жишээ: Order interface

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

```typescript
interface Order {
  id: string
  order_number: string           // "ORD-1711234567890"
  status: string                 // "pending", "confirmed", "shipped"
  total_amount: number           // 45000
  shipping_amount: number        // 5000
  created_at: string             // "2024-03-15T10:30:00Z"
  order_type: string | null      // "delivery" эсвэл null
  notes: string | null           // "2-р давхарт гаргана уу" эсвэл null
  shipping_address: string | null
  customers: {                   // Харилцагчийн мэдээлэл
    id: string
    name: string | null
    phone: string | null
  } | null
  order_items: OrderItem[]       // Бараануудын жагсаалт
}
```

`order_items: OrderItem[]` — энэ нь `OrderItem` interface-ийн **жагсаалт** гэсэн утгатай. Нэг захиалгад олон бараа байж болно.

---

## 🔧 type — Нэрлэсэн төрөл

`interface` шиг ажилладаг, гэхдээ энгийн зүйлд тохиромжтой:

📁 **Файл:** `src/lib/status-machine.ts`

```typescript
export type TransitionMap = Record<string, string[]>
```

Энэ юу гэсэн үг вэ?
- `Record<string, string[]>` = "текстэн түлхүүртэй, утга нь текстэн жагсаалт" гэсэн объект
- Жишээ: `{ "pending": ["confirmed", "cancelled"], "confirmed": ["shipped"] }`

### type vs interface — юугаараа ялгаатай вэ?

```typescript
// type: Энгийн, нэрлэсэн төрөл
type NotificationEvent = 'new_order' | 'new_message' | 'low_stock'

// interface: Объектийн бүтэц
interface TransitionResult {
  valid: boolean
  error?: string   // ? = заавал биш, байхгүй байж болно
}
```

📁 **Файл:** `src/lib/notifications.ts`

```typescript
export type NotificationEvent =
  | 'new_order'        // Шинэ захиалга
  | 'new_message'      // Шинэ мессеж
  | 'new_customer'     // Шинэ харилцагч
  | 'low_stock'        // Нөөц дуусаж байна
  | 'order_status'     // Захиалгын төлөв өөрчлөгдсөн
  | 'escalation'       // Яаралтай чат
```

Энэ нь `NotificationEvent`-д ЗӨВХӨН эдгээр утгын нэгийг хийж болно гэсэн утгатай.

```typescript
let event: NotificationEvent = 'new_order'  // ✅ Зөв
// let event: NotificationEvent = 'hello'    // ❌ Алдаа! 'hello' зөвшөөрөгдөхгүй
```

---

## ⚙️ Function Types

**Зүйрлэл:** Тооны машин бодоорой. Дотор нь 2 тоо хийнэ → үр дүн нь нэг тоо гарна. Функц яг ийм — юу оруулахыг (parameter types) болон юу гаргахыг (return type) заана.

### Энгийн функц

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

```typescript
function fmtPrice(n: number) {
  return new Intl.NumberFormat('mn-MN').format(n) + '₮'
}
```

| Хэсэг | Тайлбар |
|--------|---------|
| `n: number` | Оролт нь тоо байх ёстой |
| `return ... + '₮'` | Гаралт нь текст (string) |
| `Intl.NumberFormat('mn-MN')` | Монгол форматаар тоог бичнэ: `25000` → `"25,000₮"` |

### Бодит жишээ: validateTransition

📁 **Файл:** `src/lib/status-machine.ts`

```typescript
export function validateTransition(
  machine: TransitionMap,     // Шилжилтийн дүрэм
  currentStatus: string,      // Одоогийн төлөв
  nextStatus: string           // Шинэ төлөв
): TransitionResult {          // Гаралтын төрөл
  if (currentStatus === nextStatus) {
    return { valid: true }
  }

  const allowed = machine[currentStatus]
  if (!allowed || !allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${nextStatus}'`,
    }
  }

  return { valid: true }
}
```

Энэ функц юу хийдэг вэ? Захиалгын төлөв зөв өөрчлөгдөж байгаа эсэхийг шалгана:
- `"pending"` → `"confirmed"` ✅ Зөв
- `"delivered"` → `"pending"` ❌ Хүргэсэн захиалгыг буцааж хүлээгдэж буй болгож болохгүй

---

## 🔄 async/await — Хүлээх

**Зүйрлэл:** Зоогийн газарт захиалга өгөөд хоол ирэхийг **хүлээнэ**. `await` бол яг тэр "хүлээх" үйлдэл.

📁 **Файл:** `src/lib/resolve-store.ts`

```typescript
export async function resolveStoreId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {              // Амлалт: текст эсвэл null буцаана
  // 1. Эзэмшигч эсэхийг шалгах — хүлээх
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .single()

  if (store) return store.id              // Олдвол ID буцаана

  // 2. Баг гишүүн эсэхийг шалгах — хүлээх
  const { data: membership } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', userId)
    .single()

  if (!membership) return null            // Олдохгүй бол null
  return membership.store_id ?? null
}
```

| Түлхүүр үг | Тайлбар |
|------------|---------|
| `async` | "Энэ функц хүлээлт хийнэ" гэж зарлана |
| `await` | "Үр дүн ирэхийг хүлээ" гэсэн утгатай |
| `Promise<string \| null>` | "Энэ функц string эсвэл null-ийг **амлана**" |

`await`-гүй бол яах вэ? Database-ийн хариу ирэхээс ӨМНӨ дараагийн код ажиллана → хоосон утга авна → алдаа!

---

## 📝 Record type

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

```typescript
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:    { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 ...', icon: '⏳' },
  confirmed:  { label: 'Баталгаажсан',  color: 'bg-blue-500/20 ...',   icon: '✅' },
  shipped:    { label: 'Илгээсэн',       color: 'bg-cyan-500/20 ...',   icon: '🚚' },
  delivered:  { label: 'Хүргэсэн',       color: 'bg-green-500/20 ...',  icon: '✅' },
  cancelled:  { label: 'Цуцлагдсан',     color: 'bg-red-500/20 ...',    icon: '❌' },
}
```

`Record<string, { label: string; color: string; icon: string }>` гэдэг нь:
- **Түлхүүр** нь текст (`"pending"`, `"confirmed"`, ...)
- **Утга** нь `{ label, color, icon }` бүтэцтэй объект

Ингэснээр `STATUS_CONFIG['pending'].label` → `"Хүлээгдэж буй"` гэж авч болно.

---

## 🎯 Дасгал

### Дасгал 1: Interface бичих
Доорх мэдээлэлд тохирох interface бич:

```
Хэрэглэгч:
- Нэр (заавал байна)
- Утас (байж болно, байхгүй ч байж болно)
- И-мэйл (заавал байна)
- Нас (тоо, заавал биш)
```

<details>
<summary>💡 Хариу харах</summary>

```typescript
interface Customer {
  name: string
  phone: string | null
  email: string
  age?: number          // ? тэмдэг = заавал биш (optional)
}
```
</details>

### Дасгал 2: Function бичих
Хоёр тооны нийлбэрийг буцаадаг функц бич:

<details>
<summary>💡 Хариу харах</summary>

```typescript
function add(a: number, b: number): number {
  return a + b
}
```
</details>

### Дасгал 3: Type бичих
Захиалгын төлөв зөвхөн `"pending"`, `"confirmed"`, `"shipped"`, `"delivered"`, `"cancelled"` байж болох type бич:

<details>
<summary>💡 Хариу харах</summary>

```typescript
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
```
</details>

---

👉 **Дараагийн хичээл:** [02-nextjs-app-router.md](./02-nextjs-app-router.md) — Next.js App Router
