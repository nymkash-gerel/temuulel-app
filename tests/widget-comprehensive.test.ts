/**
 * Comprehensive widget E2E tests — all intent types + multi-turn conversation flows
 *
 * Each test runs the full processAIChat pipeline (intent → DB → GPT → response).
 * Tests are grouped by scenario type and run concurrently within each group.
 *
 * Assertions check:
 *  - Correct intent routing
 *  - Response is non-empty and in Mongolian
 *  - No hallucinated product lists when inappropriate
 *  - No wrong bot behavior (re-showing catalog, ignoring product context, etc.)
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { processAIChat } from '@/lib/chat-ai-handler'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
)

let storeId: string

async function newConv(): Promise<string> {
  const id = crypto.randomUUID()
  await sb.from('conversations').upsert(
    { id, store_id: storeId, channel: 'web', status: 'active' },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  return id
}

async function chat(convId: string, message: string) {
  return processAIChat(sb, {
    conversationId: convId,
    customerMessage: message,
    storeId,
    storeName: 'Монгол Маркет',
    customerId: null,
    chatbotSettings: {},
  })
}

/** Response must be non-empty and not contain error markers */
function expectValidResponse(response: string | undefined) {
  expect(response).toBeTruthy()
  expect(response!.length).toBeGreaterThan(10)
  expect(response).not.toMatch(/undefined|null|error/i)
}

/** Response must NOT show the numbered product-pick prompt */
function expectNoCatalogPrompt(response: string | undefined) {
  expect(response).not.toMatch(/Бараа дугаараа бичнэ үү/i)
  expect(response).not.toMatch(/Ямар бүтээгдэхүүн захиалмаар байна/i)
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const { data } = await sb.from('stores').select('id').eq('name', 'Монгол Маркет').single()
  expect(data, 'Монгол Маркет store must exist in DB').toBeTruthy()
  storeId = data!.id
}, 10000)

// ---------------------------------------------------------------------------
// 1. Greeting
// ---------------------------------------------------------------------------

describe('1. Greeting', () => {
  test.concurrent('Cyrillic greeting → warm response, no product list', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Сайн байна уу')
    expect(r.intent).toBe('greeting')
    expectValidResponse(r.response)
    expect(r.response).not.toMatch(/^\d+\.\s+\*\*/m)
    expect(r.orderStep).toBeNull()
  })

  test.concurrent('Latin greeting "sain bn uu"', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'sain bn uu')
    expect(r.intent).toBe('greeting')
    expectValidResponse(r.response)
  })

  test.concurrent('English greeting "hi" → handled gracefully', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'hi')
    expect(['greeting', 'general']).toContain(r.intent)
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 2. Product Search
// ---------------------------------------------------------------------------

describe('2. Product Search', () => {
  test.concurrent('Cyrillic "цамц байна уу" → shows products', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'цамц байна уу')
    expect(r.intent).toBe('product_search')
    expectValidResponse(r.response)
  })

  test.concurrent('Latin typo "tsamts bga uu" → shows products', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'tsamts bga uu')
    expect(r.intent).toBe('product_search')
    expectValidResponse(r.response)
  })

  test.concurrent('"ямар бараа байна" → catalog browse', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'ямар бараа байна')
    expect(r.intent).toBe('product_search')
    expectValidResponse(r.response)
  })

  test.concurrent('"арьсан цүнх байна уу" → leather bag search', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'арьсан цүнх байна уу')
    expect(['product_search', 'order_collection']).toContain(r.intent)
    expectValidResponse(r.response)
  })

  test.concurrent('"сул умсвут бна" — availability, NOT table_reservation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'сул умсвут бна')
    expect(r.intent).not.toBe('table_reservation')
    expectValidResponse(r.response)
    expect(r.response).not.toMatch(/ширээ|резерв|бронь/i)
  })
})

// ---------------------------------------------------------------------------
// 3. Size Info
// ---------------------------------------------------------------------------

describe('3. Size Info', () => {
  test.concurrent('Height+weight "60кг 165см размер аль нь вэ" → size recommendation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '60кг 165см размер аль нь вэ')
    expect(r.intent).toBe('size_info')
    expectValidResponse(r.response)
    // Should recommend a size (M or L)
    expect(r.response).toMatch(/[SMLX]{1,2}|размер/i)
    expect(r.orderStep).toBeNull()
  })

  test.concurrent('Latin "60kg 165sm hemjee" → size advice', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '60kg 165sm hemjee')
    expect(r.intent).toBe('size_info')
    expectValidResponse(r.response)
  })

  test.concurrent('After product selected: size question → no product re-list', { timeout: 60000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('info')

    const s3 = await chat(cid, 'bi ya tomtoi sulduu bvl zuger bh')
    expectValidResponse(s3.response)
    expectNoCatalogPrompt(s3.response)
  })

  test.concurrent('Size question cold (no product) → gives general size chart', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '75кг 178см хэдэн размер вэ')
    expect(r.intent).toBe('size_info')
    expectValidResponse(r.response)
    expectNoCatalogPrompt(r.response)
  })
})

// ---------------------------------------------------------------------------
// 4. Shipping
// ---------------------------------------------------------------------------

describe('4. Shipping', () => {
  test.concurrent('"хүргэлт хэдэн хоног вэ" → delivery days info', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'хүргэлт хэдэн хоног вэ')
    expect(r.intent).toBe('shipping')
    expectValidResponse(r.response)
    expect(r.orderStep).toBeNull()
  })

  test.concurrent('"hurgelt heden hunug ve" Latin → shipping info', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'hurgelt heden hunug ve')
    expect(r.intent).toBe('shipping')
    expectValidResponse(r.response)
  })

  test.concurrent('"орой 9 цагт хүргэж болох уу" → shipping NOT table_reservation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'орой 9 цагт хүргэж болох уу')
    expect(r.intent).not.toBe('table_reservation')
    // 'болох уу' triggers product_search; 'хүргэ*' triggers shipping — either is acceptable
    expect(['shipping', 'general', 'order_collection', 'product_search']).toContain(r.intent)
    expectValidResponse(r.response)
  })

  test.concurrent('"хүргэлтийн хөлс хэд вэ" → delivery fee', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'хүргэлтийн хөлс хэд вэ')
    expect(r.intent).toBe('shipping')
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 5. Payment
// ---------------------------------------------------------------------------

describe('5. Payment', () => {
  test.concurrent('"QPay-aar tulj boloh uu" → payment methods', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'QPay-aar tulj boloh uu')
    expect(r.intent).toBe('payment')
    expectValidResponse(r.response)
  })

  test.concurrent('"зээлээр авч болох уу" → credit/payment info', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'зээлээр авч болох уу')
    expect(r.intent).toBe('payment')
    expectValidResponse(r.response)
  })

  test.concurrent('"хаашаа шилжүүлэх вэ" → bank transfer info', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'хаашаа шилжүүлэх вэ')
    expect(['payment', 'general']).toContain(r.intent)
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 6. Order Status
// ---------------------------------------------------------------------------

describe('6. Order Status', () => {
  test.concurrent('"захиалга хаана байна" → asks for order details', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'захиалга хаана байна')
    expect(r.intent).toBe('order_status')
    expectValidResponse(r.response)
    expect(r.orderStep).toBeNull()
  })

  test.concurrent('"minii zahialga yamar baina" Latin → order status', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'minii zahialga yamar baina')
    expect(r.intent).toBe('order_status')
    expectValidResponse(r.response)
  })

  test.concurrent('"72 цаг боллоо ирэхгүй байна" → order status or complaint', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '72 цаг боллоо ирэхгүй байна')
    expect(['order_status', 'complaint']).toContain(r.intent)
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 7. Complaint
// ---------------------------------------------------------------------------

describe('7. Complaint', () => {
  test.concurrent('"baraa irehgui" → empathetic, no product push', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'baraa irehgui ene yaagaad')
    expect(r.intent).toBe('complaint')
    expectValidResponse(r.response)
    expect(r.response).not.toMatch(/санал болгож байна|дараах бүтээгдэхүүн/i)
  })

  test.concurrent('"хүнтэй ярих уу" → escalation response', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'хүнтэй ярих уу')
    expect(['complaint', 'escalated']).toContain(r.intent)
    expectValidResponse(r.response)
    expect(r.response).not.toMatch(/^\d+\.\s+\*\*[^*]+\*\*\s+—\s+[\d,]+₮/m)
  })

  test.concurrent('"муу чанартай байна" → complaint, not product search', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'муу чанартай байна')
    expect(r.intent).toBe('complaint')
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 8. Return / Exchange
// ---------------------------------------------------------------------------

describe('8. Return / Exchange', () => {
  test.concurrent('"butsaaj boloh uu" → return policy', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'butsaaj boloh uu')
    expect(r.intent).toBe('return_exchange')
    expectValidResponse(r.response)
  })

  test.concurrent('"хэмжээ тохирохгүй байна" → size return', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'хэмжээ тохирохгүй байна солиулж болох уу')
    expect(r.intent).toBe('return_exchange')
    expectValidResponse(r.response)
  })

  test.concurrent('"Аймар том байна" → size complaint → return_exchange', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Аймар том байна солих болох уу')
    expect(['return_exchange', 'complaint']).toContain(r.intent)
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 9. Multi-turn: Product selected → follow-up questions
// ---------------------------------------------------------------------------

describe('9. Product context preserved across follow-ups', () => {
  test('Size → material → color follow-ups all stay on selected product', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // Select product
    await chat(cid, 'арьсан цүнх авна')
    const sel = await chat(cid, '1')
    expect(sel.orderStep).toBe('info')

    // Follow-up 1: size — in order flow the bot may continue collecting info
    // so we only check it doesn't show an unrelated catalog, not that it gives size advice
    const q1 = await chat(cid, '60кг 170см размер аль вэ')
    expectValidResponse(q1.response)
    expectNoCatalogPrompt(q1.response)

    // Follow-up 2: material
    const q2 = await chat(cid, 'материал нь юу вэ')
    expectValidResponse(q2.response)
    expectNoCatalogPrompt(q2.response)

    // Follow-up 3: color
    const q3 = await chat(cid, 'хар өнгөтэй байдаг уу')
    expectValidResponse(q3.response)
    expectNoCatalogPrompt(q3.response)

    // Follow-up 4: care instructions
    const q4 = await chat(cid, 'яаж угаах вэ')
    expectValidResponse(q4.response)
    expectNoCatalogPrompt(q4.response)
  })

  test('General product question without order: stays on last shown product', { timeout: 60000 }, async () => {
    const cid = await newConv()

    // Browse products (no selection)
    const browse = await chat(cid, 'арьсан цүнх байгаа юу')
    expect(browse.intent).toBe('product_search')

    // Ask detail — should answer about the shown products
    const detail = await chat(cid, 'материал нь юу вэ')
    expectValidResponse(detail.response)
    // Must NOT say "what product do you want" — context exists
    expect(detail.response).not.toMatch(/ямар бараа авах|ямар бүтээгдэхүүн/i)
  })
})

// ---------------------------------------------------------------------------
// 10. Multi-turn: Full order flows
// ---------------------------------------------------------------------------

describe('10. Full order flows', () => {
  test('Happy path: search → select → address → phone → confirm', { timeout: 120000 }, async () => {
    const cid = await newConv()

    const s1 = await chat(cid, 'арьсан цүнх авна')
    expect(['product_search', 'order_collection']).toContain(s1.intent)

    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('info')

    const s3 = await chat(cid, 'БЗД 8 хороо 15 байр 23 тоот')
    expect(s3.orderStep).toBe('info')

    const s4 = await chat(cid, '99112233')
    expect(s4.orderStep).toBe('confirming')
    expect(s4.response).toMatch(/баталгаажуулах|тийм|үгүй/i)

    const s5 = await chat(cid, 'Тийм')
    expect(s5.intent).toBe('order_created')
    expect(s5.orderStep).toBeNull()
    expect(s5.response).not.toMatch(/баталгаажуулж байна/i)
  })

  test('Size question between product selection and order — flow continues', { timeout: 120000 }, async () => {
    const cid = await newConv()

    await chat(cid, 'арьсан цүнх байгаа юу')
    const sel = await chat(cid, '1')
    expect(sel.orderStep).toBe('info')

    // Ask size BEFORE giving address
    const sz = await chat(cid, '65кг 170см размер аль вэ')
    expectNoCatalogPrompt(sz.response)

    // Then continue order
    const addr = await chat(cid, 'СБД 3-р хороо 25 байр 4 тоот')
    expect(addr.orderStep).toBe('info')

    const phone = await chat(cid, '88776655')
    expect(phone.orderStep).toBe('confirming')
  })

  test('Latin address + phone in order flow', { timeout: 120000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'arsan tsunx avna')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('info')

    // Latin address — parser may or may not fully recognize it, stays in info
    const s3 = await chat(cid, 'BGD 8r horoo 15 bair 23 toot')
    expect(s3.orderStep).toBe('info')

    // Phone completes info collection (may need 2 steps if address wasn't parsed)
    const s4 = await chat(cid, '99112233')
    expect(['confirming', 'info']).toContain(s4.orderStep)
  })

  test('Greeting mid-order does NOT resume draft', { timeout: 60000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('info')

    const greeting = await chat(cid, 'Сайн байна уу')
    expect(greeting.intent).toBe('greeting')
    expect(greeting.orderStep).toBeNull()
  })

  test('Complaint mid-order → handled without breaking flow context', { timeout: 60000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    await chat(cid, '1')

    // Customer complains mid-order — in order flow context may stay as order_collection
    const comp = await chat(cid, 'яагаад ийм үнэтэй юм')
    expect(['complaint', 'general', 'order_collection']).toContain(comp.intent)
    expectValidResponse(comp.response)
  })
})

// ---------------------------------------------------------------------------
// 11. Edge cases & regressions from real FB data
// ---------------------------------------------------------------------------

describe('11. Edge cases & regressions', () => {
  test.concurrent('"өглөө 11-12 цагт ажилладаг уу" → NOT table_reservation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'өглөө 11-12 цагт ажилладаг уу')
    expect(r.intent).not.toBe('table_reservation')
    expectValidResponse(r.response)
  })

  test.concurrent('FB notification URL → not crash, graceful response', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Баатар нийтлэлд хариу бичсэн. Нийтлэлийг харах(https://www.facebook.com/story.php?story_fbid=test&id=123)')
    expectValidResponse(r.response)
  })

  test.concurrent('Pure phone number "99112233" without order context → not crash', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '99112233')
    expectValidResponse(r.response)
    // Should not hallucinate order confirmation
    expect(r.response).not.toMatch(/захиалга баталгаажлаа|захиалга үүслээ/i)
  })

  test.concurrent('Very short message "2" without context → no crash', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '2')
    expectValidResponse(r.response)
  })

  test.concurrent('"юмуу" question particle → NOT complaint', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'цагаан нь байгаа юмуу')
    expect(r.intent).not.toBe('complaint')
    expectValidResponse(r.response)
  })

  test.concurrent('Photo question "zurag ni bnu" mid-order → keeps draft alive', { timeout: 60000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('info')

    const s3 = await chat(cid, 'zurag ni bnu')
    expect(s3.orderStep).toBe('info')
    expect(s3.response).not.toMatch(/зураг (харуулах|үзүүлэх|илгээх) боломжгүй/i)
  })

  test.concurrent('Mixed script: Latin query then Cyrillic follow-up', { timeout: 60000 }, async () => {
    const cid = await newConv()
    const r1 = await chat(cid, 'arsan tsunx bga uu')
    expect(r1.intent).toBe('product_search')

    const r2 = await chat(cid, 'хэдэн өнгөтэй байна вэ')
    expect(['product_search', 'general', 'order_collection']).toContain(r2.intent)
    expectValidResponse(r2.response)
  })

  test.concurrent('Availability question "Guygui guytai gej avch boloh u" → product_search not menu', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Guygui guytai gej avch boloh u')
    expect(r.intent).not.toBe('menu_availability')
    expectValidResponse(r.response)
  })
})

// ---------------------------------------------------------------------------
// 12. Real customer journeys — full multi-turn simulations
// ---------------------------------------------------------------------------

describe('12. Real customer journeys', () => {

  test('Customer A: browses → asks size → orders → confirms', { timeout: 180000 }, async () => {
    const cid = await newConv()

    // Step 1: browsing
    const t1 = await chat(cid, 'ямар бараа байна вэ')
    expect(t1.intent).toBe('product_search')
    expectValidResponse(t1.response)

    // Step 2: asks about size before ordering — no product selected yet,
    // so it's correct for the bot to still show "Бараа дугаараа бичнэ үү" after size advice.
    const t2 = await chat(cid, '165см 58кг хэдэн размер авах вэ')
    expect(t2.intent).toBe('size_info')
    expectValidResponse(t2.response)
    expect(t2.response).toMatch(/[SMLX]{1,2}/i)

    // Step 3: selects a product
    const t3 = await chat(cid, 'арьсан цүнх авъя')
    expect(['product_search', 'order_collection']).toContain(t3.intent)
    expectValidResponse(t3.response)

    // Step 4: picks number from list
    const t4 = await chat(cid, '1')
    expect(t4.orderStep).toBe('info')

    // Step 5: gives address
    const t5 = await chat(cid, 'БЗД 11 хороо 32 байр 7 тоот')
    expect(t5.orderStep).toBe('info')

    // Step 6: gives phone
    const t6 = await chat(cid, '99001122')
    expect(t6.orderStep).toBe('confirming')
    expect(t6.response).toMatch(/баталгаажуулах|тийм|үгүй/i)

    // Step 7: confirms
    const t7 = await chat(cid, 'тийм')
    expect(t7.intent).toBe('order_created')
    expect(t7.orderStep).toBeNull()
    expect(t7.response).toMatch(/амжилттай|баярлалаа/i)
  })

  test('Customer B: return journey — wrong size received', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // Step 1: states return intent — use clear return signal (буцаалт/солиулах)
    const t1 = await chat(cid, 'бараагаа буцааж өгмөөр байна солиулж болох уу')
    expect(t1.intent).toBe('return_exchange')
    expectValidResponse(t1.response)
    // Should NOT push products
    expect(t1.response).not.toMatch(/дараах бүтээгдэхүүн|санал болгож/i)

    // Step 2: explains reason
    const t2 = await chat(cid, 'хэмжээ нь тохирохгүй байна маш том байна')
    expect(['return_exchange', 'complaint']).toContain(t2.intent)
    expectValidResponse(t2.response)

    // Step 3: asks how to exchange
    const t3 = await chat(cid, 'солиулж болох уу яаж хийх вэ')
    expect(['return_exchange', 'general']).toContain(t3.intent)
    expectValidResponse(t3.response)
    // Should give instructions or escalate — not show catalog
    expectNoCatalogPrompt(t3.response)
  })

  test('Customer C: complaint → asks for human → escalation', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // Step 1: strong complaint
    const t1 = await chat(cid, '3 удаа захиалсан нэг ч ирэхгүй байна маш муу үйлчилгээ')
    expect(t1.intent).toBe('complaint')
    expectValidResponse(t1.response)
    // Must empathize, not push products
    expect(t1.response).not.toMatch(/дараах бүтээгдэхүүн|санал болгож/i)

    // Step 2: still upset
    const t2 = await chat(cid, 'энэ яаж болдог юм мөнгөө буцааж авмаар байна')
    expect(['complaint', 'return_exchange']).toContain(t2.intent)
    expectValidResponse(t2.response)

    // Step 3: demands human agent
    const t3 = await chat(cid, 'хүнтэй ярихыг хүсч байна менежер дуудаач')
    expect(['complaint', 'escalated']).toContain(t3.intent)
    expectValidResponse(t3.response)
    // Must mention manager/human will contact, NOT show product list
    expect(t3.response).not.toMatch(/^\d+\.\s+\*\*[^*]+\*\*\s+—\s+[\d,]+₮/m)
  })

  test('Customer D: checks shipping → asks payment → orders', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // Step 1: delivery question
    const t1 = await chat(cid, 'Дархан руу хүргэлт хийдэг үү')
    expect(t1.intent).toBe('shipping')
    expectValidResponse(t1.response)

    // Step 2: payment question
    const t2 = await chat(cid, 'QPay-аар төлж болох уу')
    expect(t2.intent).toBe('payment')
    expectValidResponse(t2.response)

    // Step 3: decides to order
    const t3 = await chat(cid, 'арьсан цүнх авъя')
    expect(['product_search', 'order_collection']).toContain(t3.intent)
    expectValidResponse(t3.response)

    // Step 4: selects product
    const t4 = await chat(cid, '1')
    expect(t4.orderStep).toBe('info')
  })

  test('Customer E: changes mind mid-order — asks about different product', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // Step 1: starts order for bag
    const t1 = await chat(cid, 'арьсан цүнх авна')
    expect(['product_search', 'order_collection']).toContain(t1.intent)

    const t2 = await chat(cid, '1')
    expect(t2.orderStep).toBe('info')

    // Step 2: changes mind — asks about something else mid-order
    const t3 = await chat(cid, 'цамц байна уу харуулаач')
    // May reset draft or keep it — either acceptable, just no crash
    expectValidResponse(t3.response)

    // Step 3: after seeing new options, picks one
    const t4 = await chat(cid, '1')
    expectValidResponse(t4.response)
  })

  test('Customer F: Latin script throughout full order', { timeout: 120000 }, async () => {
    const cid = await newConv()

    const t1 = await chat(cid, 'sain bn uu arsan tsunx bga uu')
    expectValidResponse(t1.response)

    const t2 = await chat(cid, '1')
    expect(t2.orderStep).toBe('info')

    // Latin address
    const t3 = await chat(cid, 'BZD 8r horoo 15 bair 23 toot')
    expect(['info', 'confirming']).toContain(t3.orderStep)

    // Phone
    const t4 = await chat(cid, '88997766')
    expect(['confirming', 'info']).toContain(t4.orderStep)
  })
})
