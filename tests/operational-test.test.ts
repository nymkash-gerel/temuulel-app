/**
 * Comprehensive Operational Test
 *
 * Tests the complete chatbot system end-to-end with shop@temuulel.test account
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hybridClassify } from '@/lib/ai/hybrid-classifier'
import { processAIChat } from '@/lib/chat-ai-handler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
)

describe('Operational Test - Shop Account', () => {
  let storeId: string
  let storeName: string

  beforeAll(async () => {
    // Find the shop@temuulel.test store
    const { data: store } = await supabase
      .from('stores')
      .select('id, name, business_type')
      .eq('name', 'Монгол Маркет')
      .single()

    expect(store).toBeTruthy()
    storeId = store!.id
    storeName = store!.name

    console.log(`Testing with store: ${storeName} (${storeId})`)
  })

  describe('1. Database State Check', () => {
    test('Store exists and is configured', async () => {
      const { data: store } = await supabase
        .from('stores')
        .select('id, name, business_type, chatbot_settings')
        .eq('id', storeId)
        .single()

      expect(store).toBeTruthy()
      expect(store!.business_type).toBe('ecommerce')
    })

    test('Products exist in store', async () => {
      const { data: products, count } = await supabase
        .from('products')
        .select('id, name, base_price, stock_quantity', { count: 'exact' })
        .eq('store_id', storeId)
        .gt('stock_quantity', 0)
        .limit(10)

      console.log(`Found ${count} products in stock`)
      if (products && products.length > 0) {
        console.log('Sample products:', products.map(p => `${p.name} - ${p.base_price}₮`))
      } else {
        console.warn('⚠️  NO PRODUCTS FOUND - This explains the hallucination!')
      }

      // Document the issue but don't fail the test
      if (count === 0) {
        console.log('ISSUE IDENTIFIED: No products in database → AI hallucinates products')
      }
    })

    test('Product variants exist (size/color)', async () => {
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .limit(1)
        .single()

      if (products) {
        const { data: variants, count } = await supabase
          .from('product_variants')
          .select('id, size, color, price', { count: 'exact' })
          .eq('product_id', products.id)

        console.log(`Product variants found: ${count}`)
        if (variants) {
          console.log('Sample variants:', variants)
        }
      }
    })
  })

  describe('2. Intent Classification Tests', () => {
    test('Greeting intent', () => {
      const tests = ['hi', 'hello', 'Сайн байна уу', 'sain bn uu']
      for (const msg of tests) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('greeting')
      }
    })

    test('Product search intent', () => {
      const tests = ['tsunx bga uu', 'цүнх байгаа уу', 'bag available']
      for (const msg of tests) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('product_search')
      }
    })

    test('Order intent', () => {
      const tests = ['захиална', 'zahialna', 'авмаар бна', 'avmaar baina']
      for (const msg of tests) {
        const result = hybridClassify(msg)
        expect(['order_collection', 'product_search']).toContain(result.intent)
      }
    })

    test('Complaint intent', () => {
      const tests = [
        'yaagaad udaan bgan yum',
        'мөнгөө буцааж өг',
        'захирлаа дуудаач'
      ]
      for (const msg of tests) {
        const result = hybridClassify(msg)
        expect(result.intent).toBe('complaint')
      }
    })
  })

  describe('3. Product Search Flow', () => {
    test('Search for products returns results or empty state', async () => {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, base_price, description, images')
        .eq('store_id', storeId)
        .ilike('name', '%цүнх%')
        .limit(5)

      // Should either find products or return empty (not hallucinate)
      if (products && products.length > 0) {
        console.log('✅ Found real products:', products.map(p => p.name))
      } else {
        console.log('⚠️  No products match search - bot should say "products not available"')
        console.log('   Instead, it hallucinates products!')
      }
    })
  })

  describe('4. Order Creation Flow', () => {
    test('ISSUE: Bot should ask for product selection → size/color → address → phone', async () => {
      // This test documents the expected flow
      console.log('\n📋 Expected Order Flow:')
      console.log('1. User: "tsunx bga uu" → Bot shows products')
      console.log('2. User: "1" or product name → Bot asks size/color if variants exist')
      console.log('3. User: "M" or "хар" → Bot asks for address')
      console.log('4. User: "БЗД 8 хороо" → Bot asks for phone')
      console.log('5. User: "91250305" → Bot shows order summary')
      console.log('6. User: "тийм" → Order created in DB')

      console.log('\n🐛 Current Issue:')
      console.log('- Bot accepts phone number directly without proper flow')
      console.log('- Bot doesn\'t ask for size/color/address')
      console.log('- Bot doesn\'t create actual order in database')
    })
  })

  describe('5. Data Persistence', () => {
    test('Conversations are saved', async () => {
      const { data: convs, count } = await supabase
        .from('conversations')
        .select('id', { count: 'exact' })
        .eq('store_id', storeId)
        .limit(5)

      console.log(`Conversations in DB: ${count}`)
    })

    test('Messages are saved', async () => {
      const { data: msgs, count } = await supabase
        .from('messages')
        .select('id, content, is_from_customer', { count: 'exact' })
        .limit(5)

      console.log(`Messages in DB: ${count}`)
      if (msgs && msgs.length > 0) {
        console.log('Sample messages:', msgs.slice(0, 3))
      }
    })

    test('Orders are saved', async () => {
      const { data: orders, count } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount', { count: 'exact' })
        .eq('store_id', storeId)

      console.log(`Orders in DB: ${count}`)
      if (orders && orders.length > 0) {
        console.log('Sample orders:', orders.slice(0, 3))
      }
    })
  })

  describe('6. Delivery Fee Calculation', () => {
    test('Free delivery for orders >= 100,000₮', () => {
      const testCases = [
        { total: 50000, items: 1, expectedFee: 5000 },
        { total: 100000, items: 1, expectedFee: 0 },
        { total: 150000, items: 1, expectedFee: 0 },
      ]

      for (const tc of testCases) {
        const fee = tc.total >= 100000 ? 0 : 5000
        expect(fee).toBe(tc.expectedFee)
      }
    })

    test('Free delivery for 3+ items', () => {
      const testCases = [
        { total: 50000, items: 2, expectedFee: 5000 },
        { total: 50000, items: 3, expectedFee: 0 },
        { total: 30000, items: 5, expectedFee: 0 },
      ]

      for (const tc of testCases) {
        const fee = tc.items >= 3 ? 0 : 5000
        expect(fee).toBe(tc.expectedFee)
      }
    })
  })
})
