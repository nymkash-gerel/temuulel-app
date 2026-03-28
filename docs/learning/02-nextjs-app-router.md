# ⚡ Хичээл 2: Next.js App Router

## Next.js гэж юу вэ?

**Зүйрлэл:** Барилга барихад бэлэн хэв загвар (framework) ашигладаг шиг, Next.js бол вэб сайт барих бэлэн хэв загвар. Суурь, хана, дээвэр зэргийг сайтар бэлдсэн — чи дотоод засал хийхэд л хангалттай.

**React** = Тоосго, цемент (бүрэлдэхүүн хэсгүүд)
**Next.js** = Бэлэн барилгын загвар (routing, server rendering, API)

### Яагаад хэрэгтэй вэ?

- **Routing** — файл үүсгэхэд л хуудас автомат нэмэгдэнэ
- **Server rendering** — хуудас серверт бэлдэгдээд хэрэглэгч рүү ирнэ (хурдан!)
- **API routes** — Back-end API-г мөн нэг project дотор бичнэ

---

## 📁 Файлын бүтэц = URL

Next.js App Router дээр **файлын зам = URL зам**.

```
src/app/
├── page.tsx              → temuulel.com/
├── layout.tsx            → Бүх хуудсанд хамаарах бүтэц
├── login/
│   └── page.tsx          → temuulel.com/login
├── dashboard/
│   ├── layout.tsx        → Dashboard-ийн бүтэц (sidebar, header)
│   ├── page.tsx          → temuulel.com/dashboard
│   └── orders/
│       └── page.tsx      → temuulel.com/dashboard/orders
├── api/
│   └── orders/
│       └── route.ts      → temuulel.com/api/orders (API endpoint)
└── track/
    └── [deliveryNumber]/
        └── page.tsx      → temuulel.com/track/DEL-123 (динамик URL)
```

**Энгийнээр:** Фолдер нэр = URL хэсэг. `page.tsx` = тэр URL дээр юу харагдах.

---

## 📄 page.tsx — Хуудас

**Зүйрлэл:** Ном дотор хуудас бүрт агуулга бичсэн байдаг. `page.tsx` бол тухайн URL дээр юу харагдахыг тодорхойлсон файл.

### Бодит жишээ: Orders хуудас

📁 **Файл:** `src/app/dashboard/orders/page.tsx`

```typescript
'use client'  // ← Энэ чухал! Доор тайлбарлана

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OrdersPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders]   = useState<Order[]>([])
  const [search, setSearch]   = useState('')

  // Хуудас ачаалагдахад захиалгуудыг татна
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // ... database-аас захиалга татах
  }, [supabase, router])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Захиалга</h1>
      {/* ... захиалгуудыг харуулах */}
    </div>
  )
}
```

| Мөр | Тайлбар |
|-----|---------|
| `'use client'` | Browser дээр ажиллана (useState, onClick хэрэгтэй учир) |
| `export default function OrdersPage()` | Энэ хуудасны үндсэн component |
| `useState(true)` | Хувьсагчийн утга — өөрчлөгдөхөд хуудас дахин зурагдана |
| `useEffect(() => { load() }, [])` | Хуудас ачаалагдахад нэг удаа ажиллана |
| `router.push('/login')` | Login хуудас руу шилжүүлнэ |

---

## 🖼️ layout.tsx — Бүтэц, хүрээ

**Зүйрлэл:** Зургийн хүрээ бодоорой. Хүрээ нь (layout) хэвээрээ, дотор нь зураг (page) солигдоно.

### Root Layout — Бүх app-д хамаарна

📁 **Файл:** `src/app/layout.tsx`

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: 'Temuulel Commerce - AI-Powered E-commerce Platform',
    template: '%s | Temuulel Commerce',
  },
  description: 'Таны онлайн бизнесийг 24/7 ухаалаг туслахаар автоматжуулна.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className="dark">
      <body className="antialiased bg-slate-900">
        {children}          {/* ← Энд page.tsx-ийн агуулга орно */}
        <Toaster />         {/* ← Мэдэгдэл харуулах компонент */}
      </body>
    </html>
  );
}
```

| Хэсэг | Тайлбар |
|--------|---------|
| `metadata` | SEO мэдээлэл — browser tab дээр юу бичигдэх |
| `children` | Дотор нь ямар хуудас ч байж болно |
| `<html lang="mn">` | Монгол хэл гэж заана |
| `<Toaster />` | Бүх хуудсанд мэдэгдэл харуулах боломж |

### Dashboard Layout — Зөвхөн dashboard-д хамаарна

📁 **Файл:** `src/app/dashboard/layout.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')  // Нэвтрээгүй бол login руу шилжүүлнэ
  }

  return (
    <DashboardLayout store={store} user={user}>
      {children}        {/* ← Dashboard дотор orders, products г.м. хуудас */}
    </DashboardLayout>
  )
}
```

**Layout нь үүрлэдэг:**

```
RootLayout (html, body)
  └── DashboardLayout (sidebar, header)
       └── OrdersPage (захиалгын жагсаалт)
```

`/dashboard/orders` руу орвол: RootLayout + DashboardLayout + OrdersPage гурвуулаа нэгдэж харагдана.

---

## 🖥️ Server Component vs 🖱️ Client Component

**Зүйрлэл:**
- **Server Component** = Тогооч хоолоо бэлдээд аяга дээр тавьж өгнө (серверт бэлдэнэ)
- **Client Component** = Хэрэглэгч аягатай хоолоо өөрөө холино (browser дээр ажиллана)

### Server Component (default)

```typescript
// layout.tsx — 'use client' БАЙХГҮЙ = Server Component
export default async function Layout({ children }) {
  // Database-аас шууд уншиж болно
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // ...
}
```

**Давуу тал:** Хурдан, database-д шууд холбогдоно, нууц мэдээлэлтэй ажиллана.

### Client Component

```typescript
'use client'  // ← Энэ мөр заавал байна!

import { useState } from 'react'

export default function OrdersPage() {
  const [search, setSearch] = useState('')  // Хэрэглэгчийн оролт хадгална

  return (
    <input
      value={search}
      onChange={e => setSearch(e.target.value)}  // Товч дарах, бичих г.м.
    />
  )
}
```

**Хэзээ Client Component хэрэгтэй вэ?**
- `useState`, `useEffect` хэрэглэх үед
- `onClick`, `onChange` — хэрэглэгчийн үйлдэлд хариу өгөх үед
- Browser API (localStorage, window) ашиглах үед

### Хүснэгтээр харьцуулбал:

| | Server Component | Client Component |
|---|---|---|
| Тэмдэг | `'use client'` БАЙХГҮЙ | `'use client'` бичнэ |
| Хаана ажиллана | Server дээр | Browser дээр |
| Database | Шууд уншина ✅ | API дуудах хэрэгтэй |
| useState/useEffect | ❌ Боломжгүй | ✅ Бий |
| onClick | ❌ | ✅ |
| Хурд | Хурдан | Удаан (JS татах хэрэгтэй) |

---

## 🛤️ API Routes — route.ts

**Зүйрлэл:** Зоогийн газрын цэс бодоорой. Тогоочид (server) юу хийхийг хэлж байгаа захиалга (request). API route = тогоочид хүрэх зам.

📁 **Файл:** `src/app/api/orders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // 1. Rate limit шалгах
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // 2. Өгөгдлийг шалгах
  const { data: body, error } = await validateBody(request, createOrderSchema)
  if (error) return error

  // 3. Захиалга үүсгэх ...
  return NextResponse.json({ order }, { status: 201 })
}
```

| Хэсэг | Тайлбар |
|--------|---------|
| `export async function POST` | POST хүсэлт ирэхэд ажиллана |
| `NextRequest` | Ирж буй хүсэлт |
| `NextResponse.json()` | JSON хариу буцаана |
| `{ status: 429 }` | HTTP status code |

---

## 📂 Динамик route — [parameter]

`[deliveryNumber]` хаалтанд бичсэн фолдер нь **динамик** — URL-аас утга авна.

📁 **Файл:** `src/app/track/[deliveryNumber]/page.tsx`

```
URL: temuulel.com/track/DEL-001
                         ^^^^^^^^
                    deliveryNumber = "DEL-001"
```

Код дотор:

```typescript
export default function TrackPage({
  params,
}: {
  params: { deliveryNumber: string }
}) {
  // params.deliveryNumber === "DEL-001"
}
```

---

## 🎯 Дасгал

### Дасгал 1: Файлын бүтэц
Дараах URL-д тохирох файлын замыг бич:

1. `temuulel.com/dashboard/products` → `src/app/???`
2. `temuulel.com/api/customers` → `src/app/???`
3. `temuulel.com/driver/delivery/abc-123` → `src/app/???`

<details>
<summary>💡 Хариу харах</summary>

1. `src/app/dashboard/products/page.tsx`
2. `src/app/api/customers/route.ts`
3. `src/app/driver/delivery/[id]/page.tsx`
</details>

### Дасгал 2: Server vs Client
Дараах файлууд Server эсвэл Client Component аль нь вэ?

1. `layout.tsx` дотор `async function` + database уншина
2. `page.tsx` дотор `'use client'` + `useState` ашиглана
3. `page.tsx` дотор `'use client'` БАЙХГҮЙ + ямар ч hook байхгүй

<details>
<summary>💡 Хариу харах</summary>

1. **Server Component** — async + database шууд уншина
2. **Client Component** — `'use client'` + useState
3. **Server Component** — default нь Server
</details>

---

👉 **Дараагийн хичээл:** [03-database-supabase.md](./03-database-supabase.md) — Database & Supabase
