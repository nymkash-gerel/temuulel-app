/**
 * Seed test data for business tests
 * Run with: npx tsx scripts/seed-test-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SECRET_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seed() {
  console.log('🌱 Seeding test data...')

  // 1. Get or create test user
  console.log('Getting/creating test user: shop@temuulel.com')

  let userId: string | undefined

  // Try to create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'shop@temuulel.com',
    password: 'Test1234',
    email_confirm: true,
    user_metadata: {
      name: 'Монгол Маркет'
    }
  })

  if (authError && authError.message.includes('already been registered')) {
    // User exists, get their ID
    console.log('User already exists, fetching ID...')
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existingUser = users.find(u => u.email === 'shop@temuulel.com')
    userId = existingUser?.id
  } else {
    userId = authData?.user?.id
  }

  if (!userId) {
    console.error('Could not get user ID')
    return
  }

  console.log('User ID:', userId)

  // 2. Create public user record
  console.log('Creating public user record...')
  const { error: userError } = await supabase.from('users').upsert({
    id: userId,
    email: 'shop@temuulel.com',
    full_name: 'Монгол Маркет Owner'
  })

  if (userError) {
    console.error('Public user error:', userError)
    return
  }

  // 3. Create store
  console.log('Creating ecommerce store...')
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .insert({
      id: '10000000-0000-0000-0000-000000000001',
      owner_id: userId,
      name: 'Монгол Маркет',
      slug: 'mongol-market-test',
      business_type: 'ecommerce',
      chatbot_settings: {
        enabled: true,
        auto_reply: true
      },
      shipping_settings: {
        delivery_fee: 5000,
        free_delivery_threshold: 100000,
        free_delivery_items: 3
      }
    })
    .select()
    .single()

  if (storeError) {
    console.error('Store error:', storeError)
    return
  }

  console.log('Store created:', store.name)

  // 4. Create products
  console.log('Creating products...')
  const products = [
    { name: 'Цамц', description: 'Өвлийн дулаан цамц', price: 45000, stock: 10 },
    { name: 'Өмд', description: 'Жинсэн өмд', price: 35000, stock: 15 },
    { name: 'Гутал', description: 'Арьсан гутал', price: 85000, stock: 5 },
    { name: 'Малгай', description: 'Зусах малгай', price: 15000, stock: 20 },
    { name: 'Цүнх', description: 'Эмэгтэй цүнх', price: 55000, stock: 2 }
  ]

  for (const prod of products) {
    const { data: product } = await supabase
      .from('products')
      .insert({
        store_id: store.id,
        name: prod.name,
        description: prod.description,
        base_price: prod.price,
        status: 'active',
        has_variants: true
      })
      .select()
      .single()

    if (product) {
      // Create variant with stock
      await supabase.from('product_variants').insert({
        product_id: product.id,
        size: 'Standard',
        color: 'Default',
        price: prod.price,
        stock_quantity: prod.stock
      })
      console.log(`  ✓ ${prod.name} (${prod.stock} in stock)`)
    }
  }

  // 5. Create customer
  console.log('Creating test customer...')
  const { data: customer } = await supabase
    .from('customers')
    .insert({
      store_id: store.id,
      name: 'Болд',
      phone: '99001122',
      address: 'БЗД 5-р хороо',
      channel: 'messenger'
    })
    .select()
    .single()

  if (customer) {
    console.log('  ✓ Customer:', customer.name)

    // 6. Create conversation
    await supabase.from('conversations').insert({
      store_id: store.id,
      customer_id: customer.id,
      channel: 'messenger',
      status: 'active'
    })
    console.log('  ✓ Conversation created')
  }

  console.log('\n✅ Test data seeded successfully!')
  console.log('\nLogin credentials:')
  console.log('  Email: shop@temuulel.com')
  console.log('  Password: Test1234')
  console.log('\nStore: Монгол Маркет (ecommerce)')
  console.log('Products: 5 items with variants')
  console.log('Customer: Болд (99001122)')
}

seed().catch(console.error)
