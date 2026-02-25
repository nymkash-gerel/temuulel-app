/**
 * Seeds local Supabase with a test store + 10 products.
 * Uses the Admin API to create auth users (bypasses GoTrue schema issues).
 *
 * Usage: npx tsx scripts/seed-local.ts
 */

import { createClient } from '@supabase/supabase-js'

const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_SECRET = process.env.SUPABASE_SECRET_KEY!
// Proper UUID v4 (version=4, variant=a) — passes Zod v4 .uuid() validation
const STORE_ID = 'a1b2c3d4-e5f6-4789-ab01-234567890abc'

const sb = createClient(LOCAL_URL, LOCAL_SECRET, {
  auth: { persistSession: false },
})

async function main() {
  console.log('Seeding local Supabase...')

  // 1. Create auth user via Admin REST API
  console.log('\n[1/3] Creating auth user via Admin API...')
  const adminRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': LOCAL_SECRET,
      'Authorization': `Bearer ${LOCAL_SECRET}`,
    },
    body: JSON.stringify({
      id: undefined,
      email: 'shop@temuulel.test',
      password: 'test1234',
      email_confirm: true,
      user_metadata: { name: 'Монгол Маркет' },
    }),
  })

  const adminData = await adminRes.json()
  let actualUserId = undefined
  if (!adminRes.ok) {
    if (adminData.msg?.includes('already been registered') || adminData.code === 'email_exists') {
      console.log('  ℹ️  User already exists, looking up ID...')
      // List users and find by email
      const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, {
        headers: { 'apikey': LOCAL_SECRET, 'Authorization': `Bearer ${LOCAL_SECRET}` },
      })
      const listData = await listRes.json()
      const existing = listData.users?.find((u: { email: string; id: string }) => u.email === 'shop@temuulel.test')
      if (existing) {
        actualUserId = existing.id
        console.log(`  ✅ Found existing user ID: ${actualUserId}`)
      }
    } else {
      console.error('  ❌ Failed to create user:', adminData)
      process.exit(1)
    }
  } else {
    actualUserId = adminData.id ?? undefined
    console.log(`  ✅ Created user: ${adminData.email} (${actualUserId})`)
  }

  // 1.5 Insert into public.users (stores.owner_id references this, not auth.users directly)
  const { error: userErr } = await sb.from('users').upsert({
    id: actualUserId,
    email: 'shop@temuulel.test',
    full_name: 'Монгол Маркет',
    role: 'owner',
    is_verified: true,
    email_verified: true,
  }, { onConflict: 'id' })
  if (userErr) {
    console.error('  ❌ public.users error:', userErr.message)
    process.exit(1)
  }
  console.log('  ✅ public.users row created')

  // 2. Create store
  console.log('\n[2/3] Creating store...')
  const { data: store, error: storeErr } = await sb
    .from('stores')
    .upsert({
      id: STORE_ID,
      owner_id: actualUserId,
      name: 'Монгол Маркет',
      slug: 'mongol-market-test',
      business_type: 'ecommerce',
      chatbot_settings: { enabled: true, auto_reply: true, max_products: 5 },
      shipping_settings: { delivery_fee: 5000, free_delivery_threshold: 100000, free_delivery_items: 3 },
    }, { onConflict: 'id' })
    .select('id, name')
    .single()

  if (storeErr) {
    console.error('  ❌ Store error:', storeErr.message)
    process.exit(1)
  }
  console.log(`  ✅ Store: ${store.name} (${store.id})`)

  // 3. Insert 10 products
  console.log('\n[3/3] Inserting 10 products...')

  // Categories must use English values that match CATEGORY_MAP in product-search.ts
  // (bags, shoes, clothing, accessories, electronics, home, beauty, toys, etc.)
  // variants: array of { size?, color?, price, stock_quantity } — null = no variants
  type Variant = { size?: string; color?: string; price: number; stock_quantity: number }
  const products: { name: string; description: string; base_price: number; category: string; sales_script: string; variants: Variant[] | null }[] = [
    {
      name: 'TV тавиур',
      description: 'Орчин үеийн загвартай TV тавиур. Өргөн 120см, Өндөр 45см. 55 инч хүртэлх TV-д тохиромжтой.',
      base_price: 55000, category: 'home',
      sales_script: 'Хэмжээ: 120×45×35см. 55 инч хүртэл.',
      variants: null,
    },
    {
      name: 'Кашемир цамц',
      description: '100% цэвэр кашемир цамц. Монголын уламжлалт арга технологиор нэхсэн.',
      base_price: 189000, category: 'clothing',
      sales_script: 'Өнгө: Хар, Цагаан, Саарал. Размер: M, L, XL, 2XL.',
      variants: [
        { size: 'M',  color: 'Хар',   price: 189000, stock_quantity: 5 },
        { size: 'L',  color: 'Хар',   price: 189000, stock_quantity: 8 },
        { size: 'XL', color: 'Хар',   price: 189000, stock_quantity: 3 },
        { size: 'M',  color: 'Цагаан', price: 189000, stock_quantity: 4 },
        { size: 'L',  color: 'Цагаан', price: 189000, stock_quantity: 6 },
        { size: 'XL', color: 'Цагаан', price: 189000, stock_quantity: 2 },
        { size: 'M',  color: 'Саарал', price: 189000, stock_quantity: 7 },
        { size: 'L',  color: 'Саарал', price: 189000, stock_quantity: 5 },
        { size: '2XL',color: 'Саарал', price: 199000, stock_quantity: 2 },
      ],
    },
    {
      name: 'USB-C цэнэглэгч 65W',
      description: '65W хурдан цэнэглэгч. MacBook, iPhone, iPad болон бүх USB-C төхөөрөмжид тохирно.',
      base_price: 45000, category: 'electronics',
      sales_script: 'Apple MacBook болон бүх USB-C төхөөрөмжтэй нийцтэй.',
      variants: null,
    },
    {
      name: 'Витамин C нүүрний тос',
      description: 'Арьсыг гэрэлтүүлдэг Витамин C-тэй нүүрний тос. Бүх арьсны төрөлд тохиромжтой.',
      base_price: 28000, category: 'beauty',
      sales_script: 'Цагаан өнгийн тунгалаг шингэн. Өглөө, оройн арчилгаанд хэрэглэнэ.',
      variants: null,
    },
    {
      name: 'Ноосон малгай',
      description: '100% монгол ноосон дулаан малгай. Өвлийн улиралд тохиромжтой.',
      base_price: 35000, category: 'clothing',
      sales_script: 'Нэг хэмжээ бүгдэд. Өнгө: Хар, Хүрэн, Саарал, Цэнхэр.',
      variants: [
        { color: 'Хар',    price: 35000, stock_quantity: 10 },
        { color: 'Хүрэн',  price: 35000, stock_quantity: 7  },
        { color: 'Саарал', price: 35000, stock_quantity: 5  },
        { color: 'Цэнхэр', price: 35000, stock_quantity: 3  },
      ],
    },
    {
      name: 'Lego тоглоом',
      description: '6-8 насны хүүхдэд тохирсон Lego бүтээц. Монгол хөвцөс заавартай.',
      base_price: 42000, category: 'toys',
      sales_script: '6-8 насны хүүхдэд. Монгол Англи хэлний хөвцөс заавартай.',
      variants: null,
    },
    {
      name: 'Bluetooth чихэвч',
      description: 'Өндөр чанарын Bluetooth чихэвч. 30 цагийн батарей.',
      base_price: 85000, category: 'electronics',
      sales_script: '30 цагийн батарей. Хар, Цагаан өнгөтэй.',
      variants: [
        { color: 'Хар',   price: 85000, stock_quantity: 12 },
        { color: 'Цагаан', price: 85000, stock_quantity: 8  },
      ],
    },
    {
      name: 'Smartwatch',
      description: 'Ухаалаг цаг. Алхалт, зүрхний цохилт, нойрны хяналт. iOS, Android-тэй нийцтэй.',
      base_price: 125000, category: 'electronics',
      sales_script: 'iOS (iPhone 6+), Android (5.0+)-тэй нийцтэй. Батарей 7 хоног. Хар, Мөнгөн өнгөтэй.',
      variants: [
        { color: 'Хар',   price: 125000, stock_quantity: 6 },
        { color: 'Мөнгөн', price: 130000, stock_quantity: 4 },
      ],
    },
    {
      name: 'Шампунь + Кондишнер багц',
      description: 'Байгалийн найрлагатай шампунь, кондишнерийн хос багц. Бүх үстэй тохиромжтой.',
      base_price: 32000, category: 'beauty',
      sales_script: '3 ба түүнээс дээш багц авбал хүргэлт үнэгүй.',
      variants: null,
    },
    {
      name: 'Арьсан цүнх',
      description: '100% жинхэнэ арьсан цүнх. Том хэмжээ: 35×28×12см.',
      base_price: 120000, category: 'bags',
      sales_script: 'Хэмжээ: 35×28×12см. Өнгө: Хар, Бор, Улаан. Хүргэлт үнэгүй.',
      variants: [
        { color: 'Хар',  price: 120000, stock_quantity: 5 },
        { color: 'Бор',  price: 120000, stock_quantity: 4 },
        { color: 'Улаан', price: 125000, stock_quantity: 2 },
      ],
    },
  ]

  let ok = 0
  let variantOk = 0
  for (const p of products) {
    const { data: inserted, error } = await sb.from('products').insert({
      store_id: STORE_ID,
      name: p.name,
      description: p.description,
      base_price: p.base_price,
      category: p.category,
      status: 'active',
      sales_script: p.sales_script,
    }).select('id').single()

    if (error || !inserted) {
      console.error(`  ❌ ${p.name}: ${error?.message}`)
      continue
    }
    ok++

    if (p.variants && p.variants.length > 0) {
      const { error: vErr } = await sb.from('product_variants').insert(
        p.variants.map(v => ({
          product_id: inserted.id,
          size: v.size ?? null,
          color: v.color ?? null,
          price: v.price,
          stock_quantity: v.stock_quantity,
        }))
      )
      if (vErr) {
        console.error(`     ⚠️ variants for ${p.name}: ${vErr.message}`)
      } else {
        variantOk += p.variants.length
        const summary = p.variants.map(v => [v.size, v.color].filter(Boolean).join('/')).join(', ')
        console.log(`  ✅ ${p.name} (${p.variants.length} variants: ${summary})`)
      }
    } else {
      console.log(`  ✅ ${p.name}`)
    }
  }

  console.log(`\nDone. ${ok}/${products.length} products, ${variantOk} variants seeded.`)
  console.log(`Store ID: ${STORE_ID}`)
  console.log('Login: shop@temuulel.test / test1234')
  console.log('Dashboard: http://localhost:3000/dashboard')
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
