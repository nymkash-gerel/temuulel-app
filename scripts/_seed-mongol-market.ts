/**
 * Seed the Монгол Маркет store + shop@temuulel.com user + products
 * Required for integration tests (9 files) and Playwright E2E
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  console.log('=== Seeding Монгол Маркет ===\n')
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // 1. Create user shop@temuulel.com
  let userId: string
  const { data: user, error: userErr } = await sb.auth.admin.createUser({
    email: 'shop@temuulel.com',
    password: 'Test1234',
    email_confirm: true,
  })
  if (userErr) {
    if (userErr.message.includes('already been registered') || userErr.message.includes('already exists')) {
      const { data: users } = await sb.auth.admin.listUsers()
      const existing = users?.users?.find((u: { email?: string }) => u.email === 'shop@temuulel.com')
      if (existing) {
        userId = existing.id
        console.log('✅ User exists:', userId)
      } else {
        throw new Error('User error: ' + userErr.message)
      }
    } else {
      throw new Error('User error: ' + userErr.message)
    }
  } else {
    userId = user.user.id
    console.log('✅ Created user:', userId)
  }

  // 1b. Ensure public.users record exists
  await sb.from('users').upsert({
    id: userId,
    email: 'shop@temuulel.com',
    full_name: 'Монгол Маркет Owner',
  }, { onConflict: 'id' })
  console.log('✅ Public user record ensured')

  // 2. Create store
  let storeId: string
  const { data: existingStore } = await sb.from('stores').select('id').eq('name', 'Монгол Маркет').single()
  if (existingStore) {
    storeId = existingStore.id
    console.log('✅ Store exists:', storeId)
  } else {
    const { data: store, error: storeErr } = await sb.from('stores').insert({
      name: 'Монгол Маркет',
      slug: 'mongol-market',
      owner_id: userId,
      business_type: 'ecommerce',
      description: 'Монгол e-commerce тест дэлгүүр',
      address: 'Улаанбаатар, Монгол',
      phone: '99112233',
    }).select().single()
    if (storeErr) throw new Error('Store error: ' + storeErr.message)
    storeId = store.id
    console.log('✅ Created store:', storeId)
  }

  // 3. Add store_members entry (owner)
  await sb.from('store_members').upsert({
    store_id: storeId,
    user_id: userId,
    role: 'owner',
  }, { onConflict: 'store_id,user_id' })
  console.log('✅ Store member (owner) linked')

  // 4. Add test products
  const products = [
    { store_id: storeId, name: 'Ноутбук', description: 'MacBook Air M2 — 13 инч, 8GB RAM', base_price: 3500000, status: 'active', category: 'electronics' },
    { store_id: storeId, name: 'Гар утас', description: 'iPhone 15 Pro — 256GB', base_price: 2800000, status: 'active', category: 'electronics' },
    { store_id: storeId, name: 'Чихэвч', description: 'AirPods Pro 2 — идэвхтэй дуу тусгаарлалттай', base_price: 450000, status: 'active', category: 'electronics' },
    { store_id: storeId, name: 'Цүнх', description: 'Premium Backpack — усны хамгаалалттай', base_price: 180000, status: 'active', category: 'accessories' },
    { store_id: storeId, name: 'Цамц', description: 'Cotton T-shirt — S, M, L, XL', base_price: 45000, status: 'active', category: 'clothing' },
    { store_id: storeId, name: 'Пүүз', description: 'Running Shoes — 38-45 размер', base_price: 250000, status: 'active', category: 'footwear' },
    { store_id: storeId, name: 'Цаг', description: 'Smart Watch — GPS, Heart Rate', base_price: 380000, status: 'active', category: 'electronics' },
    { store_id: storeId, name: 'Нүдний шил', description: 'Нарны шил — UV хамгаалалттай', base_price: 85000, status: 'active', category: 'accessories' },
  ]

  // Check if products already exist
  const { count: existingCount } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
  if (existingCount && existingCount > 0) {
    console.log(`✅ Products already seeded (${existingCount} exist)`)
  } else {
    const { error } = await sb.from('products').insert(products)
    if (error) console.log(`  ⚠️ Products insert error: ${error.message}`)
    else console.log(`✅ Inserted ${products.length} products`)
  }

  const { count } = await sb.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId)
  console.log(`✅ Products: ${count} in Монгол Маркет`)

  // 5. Add product_variants with stock_quantity (needed by business-operations tests)
  const { data: productList } = await sb.from('products').select('id, name').eq('store_id', storeId)
  if (productList) {
    for (const p of productList) {
      const { count: variantCount } = await sb.from('product_variants')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', p.id)
      if (!variantCount || variantCount === 0) {
        await sb.from('product_variants').insert({
          product_id: p.id,
          size: 'Default',
          sku: `SKU-${p.name.substring(0, 3).toUpperCase()}`,
          price: 0,
          stock_quantity: 20,
        })
      }
    }
    console.log(`✅ Product variants ensured for ${productList.length} products`)
  }

  // 6. Also create slug alias for tests expecting 'mongol-market-test'
  const { data: testStore } = await sb.from('stores').select('id').eq('slug', 'mongol-market-test').single()
  if (!testStore) {
    await sb.from('stores').insert({
      name: 'Монгол Маркет Test',
      slug: 'mongol-market-test',
      owner_id: userId,
      business_type: 'ecommerce',
      description: 'Test store for integration tests',
      address: 'Улаанбаатар',
      phone: '99112233',
    })
    // Copy products to test store
    const { data: testStoreRow } = await sb.from('stores').select('id').eq('slug', 'mongol-market-test').single()
    if (testStoreRow) {
      const testProducts = products.map(p => ({ ...p, store_id: testStoreRow.id }))
      await sb.from('products').insert(testProducts)
      // Add variants for test store products too
      const { data: testProds } = await sb.from('products').select('id, name').eq('store_id', testStoreRow.id)
      if (testProds) {
        for (const p of testProds) {
          await sb.from('product_variants').insert({
            product_id: p.id,
            size: 'Default',
            sku: `SKU-T-${p.name.substring(0, 3).toUpperCase()}`,
            price: 0,
            stock_quantity: 20,
          })
        }
      }
      console.log(`✅ Created test store (slug: mongol-market-test) with products + variants`)
    }
  } else {
    console.log('✅ Test store already exists:', testStore.id)
  }

  // 7. Verify
  console.log('\n=== Summary ===')
  console.log(`User: shop@temuulel.com (${userId})`)
  console.log(`Store: Монгол Маркет (${storeId})`)
  console.log(`Products: ${count}`)
  console.log('\nLogin: shop@temuulel.com / Test1234')
}

seed().catch(e => {
  console.error('❌ Seed failed:', e.message)
  process.exit(1)
})
