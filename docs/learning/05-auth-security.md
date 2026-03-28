# 🔒 Хичээл 5: Authentication & Security

## Auth гэж юу вэ?

**Зүйрлэл:** Орон сууцны хаалга бодоорой. Түлхүүр (password) байвал орно, байхгүй бол ордоггүй. Auth бол app-ийн "хаалганы цоож" — хэн нэвтрэхийг шалгана.

### Гол ойлголтууд

| Нэр | Зүйрлэл | Тайлбар |
|-----|----------|---------|
| **Authentication** | "Та хэн бэ?" | Нэвтрэлт — email + password |
| **Authorization** | "Та юу хийж болох вэ?" | Эрх — owner нь бүх юм засна, member зөвхөн уншина |
| **Session** | Нэвтрэлтийн хугацаа | Login хийсний дараа X хугацаанд нэвтэрсэн хэвээр |
| **Cookie** | Бугуйн бугуйвч | Browser дотор хадгалагдсан жижиг мэдээлэл |

---

## 🚧 Middleware — Хаалганы харуул

📁 **Файл:** `src/middleware.ts`

**Зүйрлэл:** Барилгын хаалганд харуул бодоорой. БҮГД тэр хаалгаар ордог, харуул хэн юу хийхийг шалгана. Middleware бол app-ийн "харуул" — бүх хүсэлтийг шалгана.

```typescript
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── 1. Нийтийн хуудсуудыг шалгахгүй ──────────────
  const publicPaths = ['/', '/login', '/signup', '/demo']
  if (publicPaths.includes(pathname) ||
      pathname.startsWith('/embed') ||
      pathname.startsWith('/track')) {
    return NextResponse.next({ request })  // Шууд нэвтрүүл
  }

  // ── 2. API хүсэлтүүдэд rate limit ────────────────
  if (pathname.startsWith('/api/')) {
    const clientIp = getEdgeClientIp(request)
    const result = await edgeRateLimit(`mw:${clientIp}:${pathname}`, tier)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }
    return NextResponse.next({ request })
  }

  // ── 3. Auth шалгах ───────────────────────────────
  const supabase = createServerClient(...)
  const { data: { user } } = await supabase.auth.getUser()

  // Dashboard руу нэвтрээгүй хэрэглэгч орвол → login руу
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Login дээр нэвтэрсэн хэрэглэгч байвал → dashboard руу
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

### Middleware-ийн логик:

```
Хүсэлт ирлээ
   │
   ├── Нийтийн хуудас? (/login, /embed, /track) → ✅ Шууд нэвтрүүл
   │
   ├── API хүсэлт? (/api/...) → Rate limit шалгах
   │   ├── Хэт олон? → ❌ 429 буцаах
   │   └── Зөв → ✅ Нэвтрүүл
   │
   └── Dashboard? → Auth шалгах
       ├── Нэвтрээгүй? → 🔄 /login руу redirect
       └── Нэвтэрсэн? → ✅ Нэвтрүүл
```

---

## 🛡️ OWASP Top 10 — Нийтлэг халдлагууд

OWASP = Вэб аюулгүй байдлын олон улсын байгууллага. Тэд жил бүр хамгийн нийтлэг 10 халдлагыг жагсаадаг. Temuulel app эдгээрээс хэрхэн хамгаалдаг вэ:

### 1. SQL Injection — Database руу хортой код оруулах

**Зүйрлэл:** Банканд очоод "100₮ шилжүүлнэ үү... мөн БҮГДИЙГ устга" гэсэн хүсэлт бичсэн. SQL Injection бол database-д ЗОХИОМОЛ команд оруулах оролдлого.

```sql
-- ❌ Халдагч ингэж оруулж болно:
-- Хайлтанд: ' OR 1=1; DROP TABLE orders; --
SELECT * FROM orders WHERE status = '' OR 1=1; DROP TABLE orders; --'
```

**Temuulel-ийн хамгаалалт:**

📁 **Файл:** `src/lib/validations.ts`

```typescript
export function sanitizeSearch(input: string): string {
  return input
    .slice(0, 200)                        // 200 тэмдэгтээс урт байж болохгүй
    .replace(/[%_.*(),\\":;<>]/g, '')     // Аюултай тэмдэгтүүдийг устгана
    .trim()
}
```

Мөн Supabase client нь **parameterized query** ашигладаг:

```typescript
// ✅ АЮУЛГҮЙ — Supabase автоматаар параметр болгоно
supabase.from('orders').select('*').eq('status', userInput)

// ❌ АЮУЛТАЙ — Шууд текст оруулах (Temuulel ингэж хэзээ ч хийдэггүй!)
// `SELECT * FROM orders WHERE status = '${userInput}'`
```

### 2. XSS (Cross-Site Scripting) — Хортой script оруулах

**Зүйрлэл:** Ном дотор "энэ хуудсыг уншсан хүний мөнгийг хулгайл" гэсэн бичвэр нуун оруулсан. XSS бол вэб хуудсанд хортой JavaScript нуун оруулах.

```html
<!-- ❌ Халдагч бүтээгдэхүүний нэрэнд ингэж бичвэл: -->
<script>document.cookie = 'stolen'</script>

<!-- Browser бүх cookie-г хулгайлж илгээнэ! -->
```

**Temuulel-ийн хамгаалалт:**
- React автоматаар HTML-г "escape" хийдэг — `<script>` → `&lt;script&gt;`
- `sanitizeSearch()` аюултай тэмдэгтүүдийг устгадаг
- Validation schema бүр `.max()` тэмдэгтийн хязгаартай

### 3. CSRF (Cross-Site Request Forgery) — Хуурамч хүсэлт

**Зүйрлэл:** Хэн нэгэн чиний гарын үсгийг хуулбарлаж, чиний нэрийн өмнөөс гэрээ байгуулсан. CSRF бол нэвтэрсэн хэрэглэгчийн нэрээр хуурамч хүсэлт илгээх.

**Temuulel-ийн хамгаалалт:**
- Supabase Auth cookie нь `HttpOnly`, `Secure`, `SameSite` тохиргоотой
- API route бүрт auth шалгалттай

---

## 🔐 timingSafeEqual — Яагаад `!==` хангалтгүй вэ?

📁 **Файл:** `src/lib/messenger.ts`

```typescript
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false

  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex')

  // ✅ timingSafeEqual ашиглана
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}
```

### Яагаад `expected !== signature` ашиглахгүй вэ?

**Зүйрлэл:** Нууц үгийн цоожтой хаалга бодоорой. Чи 4 оронтой код (1234) оруулна. Хэрэв эхний тоо буруу бол ШУУД "буруу" гэдэг, зөв бол дараагийнхыг шалгана.

Халдагч хариу **хугацаагаар** мэднэ:
- `1___` → 1ms-д "буруу" (эхний тоо буруу)
- `1234` → 4ms-д "буруу" (бүгдийг шалгасан)

`!==` ижил зүйл хийдэг — эхний буруу тэмдэгтийг олмогц зогсоно. Халдагч хариу ирэх **хугацаагаар** нууц үгийг нэг нэг тэмдэгтээр олж чадна!

`timingSafeEqual` яаж ажилладаг:
- БҮГДИЙГ шалгана — эхний тэмдэгт буруу ч, сүүлийн тэмдэгт буруу ч **ижил хугацаа** зарцуулна
- Халдагч хугацаагаар юу ч мэдэхгүй!

---

## ✅ Validation — Оролтыг шалгах

📁 **Файл:** `src/lib/validations.ts`

```typescript
export const createOrderSchema = z.object({
  store_id: z.string().uuid(),
  customer_id: z.string().nullish(),
  items: z.array(z.object({
    product_id: z.string().nullish(),
    quantity: z.number().int().min(1).default(1),
    unit_price: z.number().min(0),
  })).min(1, 'At least one item required'),
  shipping_address: z.string().max(500).nullish(),
  notes: z.string().max(1000).nullish(),
})
```

| Шалгалт | Юу хийнэ | Яагаад |
|---------|----------|--------|
| `.uuid()` | UUID формат шалгана | ID-д хортой SQL оруулахаас |
| `.int().min(1)` | Бүхэл тоо, хамгийн бага 1 | -5 ширхэг захиалахаас |
| `.min(0)` | 0-ээс бага биш | Сөрөг үнэ хийхээс |
| `.max(500)` | 500 тэмдэгтээс урт биш | Хэт урт текст оруулахаас |
| `.min(1, 'message')` | Хамгийн бага 1 элемент | Хоосон захиалга үүсгэхээс |

---

## 🎯 Дасгал

### Дасгал 1: Middleware логик
Дараах хүсэлтүүд ирвэл middleware юу хийх вэ?

1. `GET /track/DEL-001` (нэвтрээгүй хүн)
2. `GET /dashboard/orders` (нэвтрээгүй хүн)
3. `GET /login` (нэвтэрсэн хүн)
4. `POST /api/orders` (1 минутад 15 дахь удаа)

<details>
<summary>💡 Хариу харах</summary>

1. ✅ Шууд нэвтрүүлнэ — `/track` нийтийн хуудас
2. 🔄 `/login` руу redirect — dashboard нэвтрэлт шаардана
3. 🔄 `/dashboard` руу redirect — нэвтэрсэн хүнд login хэрэггүй
4. ❌ `429 Too Many Requests` — rate limit 10/минут
</details>

### Дасгал 2: Аюулгүй байдал
Дараах оролтуудын аль нь аюултай вэ?

1. `name: "Бат-Эрдэнэ"`
2. `search: "цамц <script>alert('hack')</script>"`
3. `quantity: -5`
4. `store_id: "abc-123-def-456"`

<details>
<summary>💡 Хариу харах</summary>

1. ✅ Аюулгүй — энгийн нэр
2. ❌ XSS оролдлого — `sanitizeSearch()` `<>` устгана
3. ❌ Сөрөг тоо — `.min(1)` шалгалт хааж өгнө
4. ✅ Аюулгүй — UUID формат
</details>

---

👉 **Дараагийн хичээл:** [06-testing.md](./06-testing.md) — Testing
