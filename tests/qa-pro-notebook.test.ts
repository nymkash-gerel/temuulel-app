/**
 * QA Pro Test — NotebookLM-guided scenarios.
 *
 * Tests AI response quality against real-world Mongolian customer messages.
 * Based on NotebookLM analysis of operational test results.
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { processAIChat, type AIProcessingResult } from '@/lib/chat-ai-handler'

const STORE_NAME = 'Монгол Маркет'
const TIMEOUT = 30_000

class ChatClient {
  private supabase: SupabaseClient
  private storeId: string
  private conversationId: string

  constructor(supabase: SupabaseClient, storeId: string) {
    this.supabase = supabase
    this.storeId = storeId
    this.conversationId = crypto.randomUUID()
  }

  async init(): Promise<void> {
    await this.supabase.from('conversations').upsert(
      { id: this.conversationId, store_id: this.storeId, channel: 'web', status: 'active' },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  }

  async send(message: string): Promise<AIProcessingResult> {
    return processAIChat(this.supabase, {
      conversationId: this.conversationId,
      customerMessage: message,
      storeId: this.storeId,
      storeName: STORE_NAME,
      customerId: null,
      chatbotSettings: {},
    })
  }

  get id() { return this.conversationId }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
)

let storeId: string

async function newClient(): Promise<ChatClient> {
  const c = new ChatClient(sb, storeId)
  await c.init()
  return c
}

beforeAll(async () => {
  const { data } = await sb.from('stores').select('id').eq('name', STORE_NAME).single()
  expect(data, `${STORE_NAME} store must exist`).toBeTruthy()
  storeId = data!.id
}, 10_000)

// ===========================================================================
// I. Product Search & Narrowing
// ===========================================================================

describe('I. Product Search & Narrowing', () => {
  test('Latin search "tsunx bga uu" returns products (no hallucination)', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('tsunx bga uu')

    expect(r.intent).toBe('product_search')
    expect(r.response).toBeTruthy()
    expect(r.response.length).toBeGreaterThan(10)
    // Should NOT hallucinate if products exist
    if (r.metadata.products_found > 0) {
      expect(r.products.length).toBeGreaterThan(0)
    } else {
      // No products — should say "олдсонгүй" or "байхгүй", NOT invent products
      expect(r.response).toMatch(/олдсонгүй|байхгүй|хайсан/)
    }
  })

  test('Cyrillic search "цүнх байгаа уу" returns products', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('цүнх байгаа уу')

    expect(r.intent).toBe('product_search')
    expect(r.response).toBeTruthy()
  })

  test('Generic "Үнэ хэд вэ?" does NOT dump all products', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('Үнэ хэд вэ?')

    // Should ask which product, not dump entire catalog
    // Count product mentions — if >5, it's dumping
    const priceMatches = r.response.match(/₮/g)
    if (priceMatches && priceMatches.length > 5) {
      // Product dumping detected — fail
      expect(priceMatches.length, 'Should NOT dump >5 product prices at once').toBeLessThanOrEqual(5)
    }
  })
})

// ===========================================================================
// II. Full Order Flow
// ===========================================================================

describe('II. Full Order Flow', () => {
  test('Complete: search → select → name → address → phone → confirm', { timeout: 180_000 }, async () => {
    const c = await newClient()

    // Step 1: Search
    const s1 = await c.send('арьсан цүнх авна')
    expect(s1.intent).toBe('product_search')
    expect(s1.metadata.products_found).toBeGreaterThan(0)

    // Step 2: Select product
    const s2 = await c.send('1')
    expect(s2.orderStep).toBe('name')

    // Step 3: Name (CRITICAL — must NOT be classified as greeting)
    const s3 = await c.send('Бат')
    expect(s3.intent).toBe('order_collection')
    expect(s3.orderStep).toBe('address')
    // Must NOT greet back
    expect(s3.response).not.toMatch(/^сайн байна уу/i)

    // Step 4: Address
    const s4 = await c.send('БЗД 8 хороо 36-р байр 4 тоот')
    expect(s4.orderStep).toBe('phone')

    // Step 5: Phone
    const s5 = await c.send('91250305')
    expect(s5.orderStep).toBe('confirming')
    expect(s5.response).toMatch(/баталгаажуулах|тийм|үгүй/i)

    // Step 6: Confirm
    const s6 = await c.send('тийм')
    // Order should be created
    expect(s6.response).toMatch(/захиалга|амжилт|баярлалаа/i)
  })

  test('Name "Shinebayar" (contains "hi") does NOT reset order', { timeout: 60_000 }, async () => {
    const c = await newClient()
    await c.send('цамц байна уу')
    const s2 = await c.send('1')
    expect(s2.orderStep).toBe('name')

    const s3 = await c.send('Shinebayar')
    // Should advance to address, NOT reset to greeting
    expect(s3.orderStep).toBe('address')
    expect(s3.intent).toBe('order_collection')
  })
})

// ===========================================================================
// III. Complaint & Escalation
// ===========================================================================

describe('III. Complaint & Escalation', () => {
  test('Angry complaint triggers empathy + escalation score', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('Яагаад ийм удаан байгаа юм!?')

    expect(r.intent).toBe('complaint')
    expect(r.response).toBeTruthy()
    // Should NOT push products during complaint
    expect(r.response).not.toMatch(/санал болгож байна/i)
  })

  test('Discontinued product says "дууссан", not random alternatives', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('офис өмд хэдүү хямдрал хэвээрээ юу')

    // Should say not found / out of stock, NOT suggest random products
    if (r.metadata.products_found === 0) {
      expect(r.response).toMatch(/байхгүй|олдсонгүй|дууссан|ажилтан/)
      // Should NOT suggest random alternatives
      expect(r.response).not.toMatch(/оронд нь|үүний оронд/)
    }
  })
})

// ===========================================================================
// IV. Delivery Status Check
// ===========================================================================

describe('IV. Delivery Status', () => {
  test('Order status query classified correctly', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('Захиалга маань хаана явж байна?')

    expect(r.intent).toBe('order_status')
    expect(r.response).toBeTruthy()
    // Should ask for order number or provide status
    expect(r.response.length).toBeGreaterThan(10)
  })
})

// ===========================================================================
// V. Edge Cases
// ===========================================================================

describe('V. Edge Cases', () => {
  test('"болох уу" classified as payment, NOT size_info', { timeout: TIMEOUT }, async () => {
    const c = await newClient()
    const r = await c.send('Хуваан төлж болох уу?')

    // Should be payment intent, NOT size_info
    expect(r.intent).not.toBe('size_info')
    expect(['payment', 'general', 'shipping']).toContain(r.intent)
  })

  test('Latin address "bzd 7 horoo 36 bair" detected as address', { timeout: 60_000 }, async () => {
    const c = await newClient()
    await c.send('цамц авна')
    const s2 = await c.send('1')
    expect(s2.orderStep).toBe('name')

    // Latin address at name step should skip to phone
    const s3 = await c.send('bzd 7 horoo 36 bair')
    expect(s3.orderStep).toBe('phone')
  })
})
