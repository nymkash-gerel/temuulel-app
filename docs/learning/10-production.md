# 📊 Хичээл 10: Performance & Production

## Production гэж юу вэ?

**Зүйрлэл:** Хоолны жор гэрт хийхэд ялгаатай, 1000 хүнд зоогийн газарт хийхэд ялгаатай. Гэрт хийхэд ямар ч хурдаар хийж болно. Зоогийн газарт хурд, чанар, зардлыг оновчтой болгох хэрэгтэй. Production = бодит хэрэглэгчидтэй, бодит ачаалалтай ажиллаж байгаа app.

---

## ❌ `select('*')` яагаад муу вэ?

**Зүйрлэл:** Дэлгүүрээс "бүгдийг авъя" гэхэд хэрэгтэй биш зүйл ч гарна — хашааны чулуу, хуучин сонин г.м. `select('*')` бол "бүгдийг авъя" — хэрэгтэй биш баганыг ч авна.

```typescript
// ❌ Муу — БҮХ баганыг авна (50+ багана!)
const { data } = await supabase.from('stores').select('*')

// ✅ Сайн — зөвхөн хэрэгтэй баганыг авна
const { data } = await supabase
  .from('stores')
  .select('id, name, slug, business_type')
```

### Ямар хохирол учруулдаг:

| | `select('*')` | `select('id, name')` |
|---|---|---|
| Хэмжээ | ~5KB/мөр | ~0.1KB/мөр |
| 1000 мөр бол | 5MB | 100KB |
| Хурд | Удаан | Хурдан |
| Network | Их traffic | Бага traffic |

📁 **Файл:** `src/lib/resolve-store.ts`

Temuulel-д хэрэгтэй баганыг тодорхой заасан:

```typescript
const STORE_COLUMNS = `id, name, slug, owner_id, address, phone, email,
  website, description, logo_url, business_type, ai_auto_reply,
  chatbot_settings, delivery_settings, shipping_settings,
  payment_settings, product_settings` as const

const { data: store } = await supabase
  .from('stores')
  .select(STORE_COLUMNS)       // Зөвхөн хэрэгтэй баганууд
  .eq('owner_id', userId)
  .single()
```

---

## 🔁 N+1 Query — Нийтлэг алдаа

**Зүйрлэл:** Анги дүүрэн 30 сурагчтай. Нэг нэгээр нь "Нэр чинь хэн бэ?" гэж асуухын оронд "Бүгдээрээ нэрээ хэлээч" гэвэл хурдан. N+1 query = нэг нэгээр нь асууж байгаа.

```typescript
// ❌ N+1 Query — 100 захиалга бол 101 query (маш удаан!)
const orders = await supabase.from('orders').select('*')
for (const order of orders.data) {
  // Захиалга бүрд нэг query = 100 нэмэлт query!
  const { data: customer } = await supabase
    .from('customers')
    .select('name, phone')
    .eq('id', order.customer_id)
    .single()
}

// ✅ Зөв — НЭГ query-д бүгдийг авна
const { data } = await supabase
  .from('orders')
  .select(`
    id, order_number, status, total_amount,
    customers(name, phone)
  `)
```

| | N+1 (муу) | Join (сайн) |
|---|---|---|
| 100 захиалга | 101 query | 1 query |
| Хугацаа | ~2000ms | ~50ms |
| Database ачаалал | Маш их | Бага |

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

Temuulel-д join ашигласан:

```typescript
const { data } = await supabase
  .from('orders')
  .select(`
    id, order_number, status, total_amount, shipping_amount, created_at,
    customers(id, name, phone),
    order_items(
      id, quantity, unit_price, variant_label,
      products(name),
      product_variants(size, color, products(name))
    )
  `)
  .eq('store_id', store.id)
  .order('created_at', { ascending: false })
```

Нэг query-д orders + customers + order_items + products БҮГДИЙГ авна!

---

## ⏱️ Rate Limiting & Caching

📁 **Файл:** `src/lib/rate-limit.ts`

### Rate Limiting — Хурд хязгаарлах

```typescript
// Development: In-memory (RAM дотор)
// Production: Redis (бүх server хуваалцана)
export async function rateLimit(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(options.limit, options.windowSeconds)

  if (upstash) {
    // Production: Redis ашиглана
    const result = await upstash.limit(key)
    return { success: result.success, ... }
  }

  // Development: In-memory fallback
  return memoryRateLimit(key, options.limit, options.windowSeconds)
}
```

### Redis — Caching

**Зүйрлэл:** Номын сангаас ном хайх (database) vs ширээн дээрх ном шууд авах (cache). Cache = ойр, хурдан хадгалалт.

📁 **Файл:** `src/lib/redis.ts`

```
Хүсэлт ирнэ → Redis-т бий юу?
                 ├── Бий → Шууд буцаана (1ms)
                 └── Байхгүй → Database-аас авна (50ms) → Redis-т хадгална
```

---

## 🚨 Error Tracking — Sentry

**Зүйрлэл:** Машин эвдрэхэд механик дуудна. App-д алдаа гарахад Sentry мэдэгдэл илгээнэ — хаана, юу, яаж.

📁 **Файл:** `src/lib/logger.ts`

```typescript
export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) console.debug(formatLog('debug', message, context))
  },

  info(message: string, context?: LogContext) {
    if (shouldLog('info')) console.info(formatLog('info', message, context))
  },

  error(message: string, error?: unknown, context?: LogContext) {
    console.error(formatLog('error', message, errorContext))
    // Sentry-д илгээнэ
    void reportToSentry(error, message, context)
  },
}
```

### `console.log` vs Structured Logger

```typescript
// ❌ console.log — production-д хайхад хэцүү
console.log('Order created')
console.log('Error:', err)

// ✅ Structured logger — хайж, шүүж болно
logger.info('Order created', {
  orderId: 'ORD-123',
  storeId: 'store-456',
  totalAmount: 25000,
})

logger.error('Order creation failed', err, {
  orderId: 'ORD-123',
  storeId: 'store-456',
})
```

### Production дээр:

```json
{"timestamp":"2024-03-15T10:30:00Z","level":"info","message":"Order created","orderId":"ORD-123","storeId":"store-456","totalAmount":25000}
```

- JSON формат → Log aggregator (Vercel, Datadog) автомат parse хийнэ
- `orderId`, `storeId` талбараар хайж болно
- `level` = "error" бол Sentry-д автомат илгээгдэнэ

---

## 📊 Request Logger

📁 **Файл:** `src/lib/logger.ts`

```typescript
export function createRequestLogger(
  requestId: string,
  route: string,
  options?: RequestLoggerOptions,
) {
  const baseContext: LogContext = { requestId, route, ...options }

  // Sentry scope тохируулах
  void setSentryScope(requestId, route, options)

  return {
    debug(msg: string, ctx?: LogContext) {
      logger.debug(msg, { ...baseContext, ...ctx })
    },
    info(msg: string, ctx?: LogContext) {
      logger.info(msg, { ...baseContext, ...ctx })
    },
    error(msg: string, err?: unknown, ctx?: LogContext) {
      logger.error(msg, err, { ...baseContext, ...ctx })
    },
  }
}
```

API route дотор ашиглахдаа:

```typescript
export async function POST(request: NextRequest) {
  const log = createRequestLogger('req-abc123', '/api/orders', {
    userId: 'user-456',
    storeId: 'store-789',
  })

  log.info('Creating order')           // requestId, route автомат нэмэгдэнэ
  log.error('Failed to create', err)   // Sentry-д автомат илгээнэ
}
```

---

## 📈 Monitoring — Хяналт

### Юу хянах вэ?

| Хэмжигдэхүүн | Яагаад | Хэрэгсэл |
|---------------|--------|-----------|
| Алдааны тоо | App эвдэрч байна уу? | Sentry |
| Response хугацаа | API удааширч байна уу? | Vercel Analytics |
| Database query | Удаан query байна уу? | Supabase Dashboard |
| Rate limit | Халдлага болж байна уу? | Redis logs |
| Uptime | App унасан уу? | Vercel Status |

### Sentry тохиргоо

📁 **Файл:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

```
sentry.client.config.ts  → Browser дээрх алдаа
sentry.server.config.ts  → Server дээрх алдаа
sentry.edge.config.ts    → Middleware дээрх алдаа
```

Sentry бүх алдааг:
1. **Бүртгэнэ** — хэзээ, хаана, хэдэн удаа
2. **Бүлэглэнэ** — ижил алдааг нэгтгэнэ
3. **Мэдэгдэнэ** — Email/Slack-аар мэдэгдэнэ
4. **Хянана** — шийдэгдсэн, шийдэгдээгүй

---

## 🎯 Production Checklist

App-аа production-д гаргахын өмнө шалгах зүйлс:

- [ ] `select('*')` байхгүй — зөвхөн хэрэгтэй баганыг авна
- [ ] N+1 query байхгүй — join ашиглана
- [ ] Rate limiting бий — API бүрт
- [ ] Validation бий — бүх input шалгагдана
- [ ] Error tracking бий — Sentry тохируулсан
- [ ] Structured logging — `console.log` биш, `logger` ашиглана
- [ ] `.env` Git-д байхгүй — `.gitignore`-д нэмсэн
- [ ] RLS идэвхтэй — бүх хүснэгтэд
- [ ] HTTPS — бүх холболт шифрлэгдсэн

---

## 🎯 Дасгал

### Дасгал 1: N+1 олох
Дараах кодод N+1 асуудал байна уу? Яаж засах вэ?

```typescript
const { data: products } = await supabase.from('products').select('*')
for (const p of products) {
  const { data: variants } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', p.id)
}
```

<details>
<summary>💡 Хариу харах</summary>

**Тийм, N+1 бий!** 100 бүтээгдэхүүн бол 101 query.

Засвар:
```typescript
const { data: products } = await supabase
  .from('products')
  .select(`
    id, name, base_price,
    product_variants(size, color, price, stock_quantity)
  `)
```
Нэг query-д бүгдийг авна!
</details>

### Дасгал 2: console.log засах
Дараах кодыг structured logger-аар дахин бич:

```typescript
console.log('User logged in')
console.log('Order created: ' + orderId)
console.error('Something went wrong', error)
```

<details>
<summary>💡 Хариу харах</summary>

```typescript
import { logger } from '@/lib/logger'

logger.info('User logged in', { userId: user.id })
logger.info('Order created', { orderId })
logger.error('Something went wrong', error, { orderId })
```
</details>

---

## 🎉 Баяр хүргэе!

Бүх 10 хичээлийг дуусгалаа! Одоо чи:
- TypeScript, Next.js, Supabase ойлгоно
- REST API, Auth, Security мэднэ
- Testing, Git, CI/CD ашиглаж чадна
- AI chatbot яаж ажилладагийг ойлгоно
- Production-д бэлэн app хэрхэн бичихийг мэдэнэ

👉 **Дараагийн алхам:** Temuulel app-ын кодыг уншиж, өөрчлөлт хийж туршаарай!

📖 [README руу буцах](./README.md)
