/**
 * Test: photo request during order flow should NOT repeat address/phone prompt
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { processAIChat } from '@/lib/chat-ai-handler'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
)

describe('Photo question mid-order flow', () => {
  let storeId: string
  let convId: string

  beforeAll(async () => {
    const { data } = await sb.from('stores').select('id').eq('name', 'Монгол Маркет').single()
    storeId = data!.id
    convId = crypto.randomUUID()
    await sb.from('conversations').upsert(
      { id: convId, store_id: storeId, channel: 'web', status: 'active' },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  })

  test('zurag ni bnu during order flow → shows product info, not only address prompt', { timeout: 60000 }, async () => {
    // Step 1: Trigger product search + order intent
    await processAIChat(sb, {
      conversationId: convId, customerMessage: 'арьсан цүнх авна',
      storeId, storeName: 'Монгол Маркет', customerId: null, chatbotSettings: {},
    })
    // Step 2: Select product 1
    const step2 = await processAIChat(sb, {
      conversationId: convId, customerMessage: '1',
      storeId, storeName: 'Монгол Маркет', customerId: null, chatbotSettings: {},
    })
    console.log('Step 2 (select 1):', step2.response?.substring(0, 150), '| intent:', step2.intent, '| orderStep:', step2.orderStep)

    // Step 3: Ask for photo (was broken — repeated address/phone prompt)
    const step3 = await processAIChat(sb, {
      conversationId: convId, customerMessage: 'zurag ni bnu',
      storeId, storeName: 'Монгол Маркет', customerId: null, chatbotSettings: {},
    })
    console.log('Step 3 (photo request):', step3.response?.substring(0, 250), '| intent:', step3.intent, '| orderStep:', step3.orderStep)

    expect(step3.response).toBeTruthy()
    expect(step3.intent).toBe('order_collection')
    // The response must NOT be *only* the address/phone prompt
    // A proper response answers the photo question AND appends the order reminder
    const onlyAddressPrompt = step3.response?.includes('дараах мэдээлэл хэрэгтэй') &&
      !step3.response?.includes('зураг') &&
      step3.response?.split('\n').length < 6
    expect(onlyAddressPrompt).toBe(false)
  })

  test('зураг харуулна уу during order flow → product info response', { timeout: 60000 }, async () => {
    const convId2 = crypto.randomUUID()
    await sb.from('conversations').upsert(
      { id: convId2, store_id: storeId, channel: 'web', status: 'active' },
      { onConflict: 'id', ignoreDuplicates: true }
    )
    await processAIChat(sb, { conversationId: convId2, customerMessage: 'арьсан цүнх авна', storeId, storeName: 'Монгол Маркет', customerId: null, chatbotSettings: {} })
    await processAIChat(sb, { conversationId: convId2, customerMessage: '1', storeId, storeName: 'Монгол Маркет', customerId: null, chatbotSettings: {} })
    const r = await processAIChat(sb, { conversationId: convId2, customerMessage: 'зураг харуулна уу', storeId, storeName: 'Монгол Маркет', customerId: null, chatbotSettings: {} })
    console.log('Cyrillic photo request:', r.response?.substring(0, 200), '| intent:', r.intent)
    expect(r.intent).toBe('order_collection')
    const stuck = r.response?.includes('дараах мэдээлэл хэрэгтэй') && r.response?.split('\n').length < 6
    expect(stuck).toBe(false)
  })
})
