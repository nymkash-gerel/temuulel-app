# 🏗️ Хичээл 9: Architecture

## Temuulel App-ын бүтэц

**Зүйрлэл:** Том барилга барихдаа зураг төсөл хэрэгтэй — хаана дулааны шугам, хаана цахилгаан, хаана ус явах. App бичихдээ ч architecture = "зураг төсөл". Код хаана байх, хэсгүүд хоорондоо хэрхэн холбогдох.

### Бүрэн бүтцийн diagram:

```
┌─────────────────────────────────────────────────────┐
│                    Хэрэглэгчид                       │
│  Messenger  │  Instagram  │  Widget  │  Dashboard    │
└──────┬──────┴──────┬───────┴────┬─────┴──────┬───────┘
       │             │            │            │
       ▼             ▼            ▼            ▼
┌─────────────────────────────────────────────────────┐
│              Next.js Middleware                       │
│         (Auth шалгалт + Rate limiting)              │
└──────────────────────┬──────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────┐   ┌──────────────┐  ┌──────────────┐
│ API Routes│   │  AI Engine   │  │  Dashboard   │
│ /api/*   │   │  Classifier  │  │  Pages       │
│          │   │  Responder   │  │  (SSR + CSR) │
└────┬─────┘   └──────┬───────┘  └──────┬───────┘
     │                │                  │
     ▼                ▼                  ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + Auth)             │
│  stores │ orders │ products │ customers │ messages   │
└──────────────────────┬──────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌──────────┐   ┌──────────────┐  ┌──────────────┐
│  Redis   │   │  OpenAI API  │  │ Notifications│
│ (Cache,  │   │  (GPT-4o)    │  │ Email, Push, │
│  Rate    │   │              │  │ Telegram,    │
│  Limit)  │   │              │  │ Webhook      │
└──────────┘   └──────────────┘  └──────────────┘
```

---

## 🔄 Client → API → Database Flow

Хэрэглэгч захиалгын жагсаалт хүсвэл юу болох вэ?

```
1. Browser: GET /dashboard/orders
       │
       ▼
2. Middleware: Auth шалгах → Нэвтэрсэн ✅
       │
       ▼
3. Dashboard Layout: Store мэдээлэл татах (Server Component)
       │
       ▼
4. Orders Page: 'use client' → Browser дээр ажиллана
       │
       ▼
5. useEffect → supabase.from('orders').select(...)
       │
       ▼
6. Supabase → PostgreSQL: SELECT * FROM orders WHERE store_id = '...'
       │
       ▼
7. RLS шалгалт: store_id зөв тул → Data буцаана
       │
       ▼
8. Browser: Захиалгуудыг дэлгэцэнд харуулна
```

---

## 🏪 Multi-tenancy — store_id

**Зүйрлэл:** Нэг барилгад олон оффис бодоорой. Оффис бүр ӨӨР компани — ОӨР ажилтан, ОӨР баримт. Multi-tenancy бол нэг app дотор олон дэлгүүрийг тусгаарлах.

```
Temuulel App
├── Store A (Хувцас дэлгүүр) — store_id: "aaa"
│   ├── Products: цамц, өмд, малгай
│   ├── Orders: ORD-001, ORD-002
│   └── Customers: Бат, Дорж
│
├── Store B (Зоогийн газар) — store_id: "bbb"
│   ├── Products: бууз, хуушуур, цай
│   ├── Orders: ORD-003, ORD-004
│   └── Customers: Болд, Сараа
│
└── Store C (Гоо сайхан) — store_id: "ccc"
    ├── Products: шампунь, крем
    ├── Orders: ORD-005
    └── Customers: Туяа
```

**store_id** бүх хүснэгтэд бий — Store A-ийн эзэмшигч ЗӨВХӨН Store A-ийн мэдээллийг харна.

📁 **Файл:** `src/lib/resolve-store.ts`

```typescript
// Хэрэглэгчийн store-г олох: эзэмшигч мөн үү? баг гишүүн мөн үү?
export async function resolveStoreId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  // Эзэмшигч эсэхийг шалгах
  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', userId).single()
  if (store) return store.id

  // Баг гишүүн эсэхийг шалгах
  const { data: membership } = await supabase
    .from('store_members').select('store_id').eq('user_id', userId).single()
  return membership?.store_id ?? null
}
```

---

## 📢 Notification System

📁 **Файл:** `src/lib/notifications.ts`

**Зүйрлэл:** Шуудангийн үйлчилгээ бодоорой. Нэг захидал бичээд олон хүнд, олон аргаар хүргэдэг — шуудан, email, утас. Temuulel-ийн notification system нэг event-д олон суваг ашиглана.

```typescript
export async function dispatchNotification(
  storeId: string,
  event: NotificationEvent,    // 'new_order', 'low_stock', г.м.
  data: NotificationData
): Promise<void> {
  // 1. Дэлгүүрийн эзэмшигчийн тохиргоог авах
  const { data: store } = await supabase
    .from('stores').select('owner_id').eq('id', storeId).single()

  const { title, body } = buildNotificationContent(event, data)

  // 2. 📧 Email илгээх (тохиргоо идэвхтэй бол)
  if (settings[`email_${event}`]) {
    await sendOrderEmail(owner.email, { ... })
  }

  // 3. 📱 Push notification илгээх
  if (settings[`push_${event}`]) {
    await sendPushToUser(store.owner_id, { title, body, url: '/dashboard/orders' })
  }

  // 4. 💬 Telegram мэдэгдэл (staff-д)
  if (data.staff_id) {
    await notifyStaff(data.staff_id, { ... })
  }

  // 5. 🔔 In-app мэдэгдэл хадгалах
  await supabase.from('notifications').insert({
    store_id: storeId, type: event, title, body, is_read: false,
  })

  // 6. 🌐 Webhook илгээх (гадаад систем рүү)
  dispatchWebhook(storeId, event, data)
}
```

### Notification event-ийн жишээнүүд:

```typescript
type NotificationEvent =
  | 'new_order'              // Шинэ захиалга
  | 'new_message'            // Шинэ мессеж
  | 'low_stock'              // Нөөц дуусаж байна
  | 'order_status'           // Захиалгын төлөв өөрчлөгдсөн
  | 'escalation'             // Яаралтай чат
  | 'delivery_assigned'      // Хүргэлт оноогдсон
  | 'delivery_completed'     // Хүргэлт амжилттай
  | 'delivery_failed'        // Хүргэлт амжилтгүй
```

---

## 🔄 Status Machine — Төлөвийн машин

📁 **Файл:** `src/lib/status-machine.ts`

**Зүйрлэл:** Гэрлэн дохио бодоорой. Ногоон → Шар → Улаан → Ногоон. Ногооноос ШУУД улаан руу шилжихгүй — зөвхөн тодорхой дарааллаар. Status Machine бол захиалга/хүргэлтийн "гэрлэн дохио".

```typescript
// Засварын захиалгын төлөвүүд
export const repairOrderTransitions: TransitionMap = {
  received:  ['diagnosed', 'cancelled'],     // Хүлээн авсан → Оношилсон, Цуцалсан
  diagnosed: ['quoted', 'cancelled'],        // Оношилсон → Үнэ тогтоосон
  quoted:    ['approved', 'cancelled'],      // Үнэ тогтоосон → Зөвшөөрсөн
  approved:  ['in_repair', 'cancelled'],     // Зөвшөөрсөн → Засварт
  in_repair: ['completed', 'cancelled'],     // Засварт → Дууссан
  completed: ['delivered'],                  // Дууссан → Хүргэсэн
  delivered: [],                             // Хүргэсэн → ДУУСЛАА (terminal)
  cancelled: [],                             // Цуцалсан → ДУУСЛАА
}
```

### Diagram:

```
received → diagnosed → quoted → approved → in_repair → completed → delivered
    ↓          ↓         ↓         ↓           ↓
 cancelled  cancelled  cancelled  cancelled  cancelled
```

### Шилжилт шалгах функц:

```typescript
export function validateTransition(
  machine: TransitionMap,
  currentStatus: string,
  nextStatus: string
): TransitionResult {
  if (currentStatus === nextStatus) return { valid: true }

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

```typescript
// Жишээ:
validateTransition(repairOrderTransitions, 'received', 'diagnosed')
// → { valid: true } ✅

validateTransition(repairOrderTransitions, 'received', 'completed')
// → { valid: false, error: "Cannot transition from 'received' to 'completed'" } ❌
```

### Temuulel-д байгаа бүх status machine:

| Machine | Салбар |
|---------|--------|
| `reservationTransitions` | Зочид буудал |
| `repairOrderTransitions` | Засварын газар |
| `laundryOrderTransitions` | Угаалгын газар |
| `legalCaseTransitions` | Хуулийн фирм |
| `classBookingTransitions` | Фитнесс клуб |
| `enrollmentTransitions` | Сургалтын төв |
| `treatmentPlanTransitions` | Эмнэлэг |

---

## 🎯 Дасгал

### Дасгал 1: Flow зурах
Хэрэглэгч Messenger-ээр "Цамц хэд вэ?" гэж бичвэл юу болох вэ? Алхам бүрийг бич.

<details>
<summary>💡 Хариу харах</summary>

1. Facebook Webhook → `/api/webhook/messenger` руу мессеж ирнэ
2. Middleware: Rate limit шалгана
3. Intent classifier: "product_search" гэж таньна
4. Database: `products` хүснэгтээс "цамц" хайна
5. Contextual Responder: GPT-д бүтээгдэхүүн + prompt дамжуулна
6. GPT: "Бидэнд 3 төрлийн цамц байна: ..." хариу үүсгэнэ
7. Messenger API: Хэрэглэгч рүү хариу + зураг илгээнэ
</details>

### Дасгал 2: Status Machine
Угаалгын газрын status machine-д:

1. `received` → `ready` шилжиж болох уу?
2. `washing` → `drying` шилжиж болох уу?
3. `delivered` → `received` шилжиж болох уу?

<details>
<summary>💡 Хариу харах</summary>

1. ❌ — `received` → `processing` → `washing` → ... → `ready` дарааллаар
2. ✅ — `washing` → `drying` зөвшөөрөгдсөн
3. ❌ — `delivered` terminal state (хоосон жагсаалт `[]`)
</details>

---

👉 **Дараагийн хичээл:** [10-production.md](./10-production.md) — Performance & Production
