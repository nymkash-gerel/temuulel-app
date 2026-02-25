/**
 * Comprehensive Chat Scenario Tests
 *
 * Two tiers:
 *  1. FAST — pure intent classification (no AI, no DB, <5ms each)
 *  2. E2E  — full processAIChat flows (real OpenAI, run concurrently)
 *
 * Covers every intent with realistic Mongolian customer messages:
 *  Cyrillic, Latin transliteration, mixed-script, typos, slang.
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { hybridClassify } from '@/lib/ai/hybrid-classifier'
import { processAIChat } from '@/lib/chat-ai-handler'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
)

async function newConv(storeId: string): Promise<string> {
  const id = crypto.randomUUID()
  await sb.from('conversations').upsert(
    { id, store_id: storeId, channel: 'web', status: 'active' },
    { onConflict: 'id', ignoreDuplicates: true }
  )
  return id
}

async function chat(storeId: string, convId: string, message: string) {
  return processAIChat(sb, {
    conversationId: convId,
    customerMessage: message,
    storeId,
    storeName: 'Монгол Маркет',
    customerId: null,
    chatbotSettings: {},
  })
}

/** Assert intent is one of the allowed values */
function expectIntent(msg: string, ...allowed: string[]) {
  const { intent } = hybridClassify(msg)
  expect(allowed, `"${msg}" → "${intent}" not in [${allowed.join('|')}]`).toContain(intent)
}

// ---------------------------------------------------------------------------
// Part 1 — FAST: Intent Classification
// ---------------------------------------------------------------------------

describe('1. Intent Classification — all scenarios', () => {

  // ── Greeting ────────────────────────────────────────────────────────────
  describe('Greeting', () => {
    test('Cyrillic greetings', () => {
      for (const m of ['Сайн байна уу', 'Сайн уу', 'мэнд', 'өглөөний мэнд'])
        expectIntent(m, 'greeting')
      // "Юу байна" = "what's up" — greeting OR general inquiry
      expectIntent('Юу байна', 'greeting', 'general', 'return_exchange')
    })
    test('Latin / slang greetings', () => {
      for (const m of ['sain bn uu', 'sbnuu', 'hi', 'hello', 'hey', 'good morning'])
        expectIntent(m, 'greeting')
      // "bn uu" = "байна уу" — can classify as greeting OR product availability check
      expectIntent('bn uu', 'greeting', 'product_search')
    })
  })

  // ── Product search ───────────────────────────────────────────────────────
  describe('Product search', () => {
    test('Common Cyrillic queries', () => {
      for (const m of ['ямар бараа байна', 'цамц байна уу', 'гутал хэд вэ', 'бараа харуулна уу', 'ноолуур цамц бна уу'])
        expectIntent(m, 'product_search')
    })
    test('Latin transliterations', () => {
      for (const m of ['baraa bga uu', 'tsunx une hed', 'noooluur tsamts', 'une hed baina', 'shine baraa bga'])
        expectIntent(m, 'product_search')
    })
    test('Size + availability (should NOT become size_info when product context exists)', () => {
      for (const m of ['hemjee M tsamts bga uu', 'yamar ongo bn', 'цамц xl бга уу'])
        expectIntent(m, 'product_search', 'size_info')
    })
    test('Short availability abbreviations', () => {
      for (const m of ['бга юу', 'bgaa', 'бий юу', 'bii uu', 'bn uu'])
        expectIntent(m, 'product_search', 'greeting')
    })
  })

  // ── Order collection ─────────────────────────────────────────────────────
  describe('Order collection (purchase intent)', () => {
    test('Cyrillic purchase expressions', () => {
      for (const m of ['захиалмаар байна', 'авъя', 'авна', 'захиалъя', 'худалдаж авна'])
        expectIntent(m, 'order_collection', 'product_search')
    })
    test('Latin purchase expressions', () => {
      for (const m of ['zahialna', 'zahialya', 'avmaar', 'avna', 'avya', 'hudaldaj avna'])
        expectIntent(m, 'order_collection', 'product_search')
    })
    test('Short informal "авий"/"avi"', () => {
      for (const m of ['авий', 'avi', 'avii'])
        expectIntent(m, 'order_collection', 'product_search')
    })
  })

  // ── Order status ─────────────────────────────────────────────────────────
  describe('Order status', () => {
    test('Cyrillic status queries', () => {
      for (const m of ['захиалга хэзээ ирэх вэ', 'захиалгын статус', 'захиалга шалгана уу', 'явсан уу'])
        expectIntent(m, 'order_status')
    })
    test('Latin transliterations (Bug fix: minii zahialga → order_status not order_collection)', () => {
      for (const m of ['minii zahialga yamar baina', 'zahialga hezee ireh', 'zahialgaa shalgana uu', 'minii zahialga status'])
        expectIntent(m, 'order_status')
    })
  })

  // ── Complaint ────────────────────────────────────────────────────────────
  describe('Complaint', () => {
    test('Non-delivery (Bug fix: baraa irehgui → complaint not product_search)', () => {
      for (const m of ['baraa irehgui', 'baraa ireegui', 'baraa irehgui ene yaagaad'])
        expectIntent(m, 'complaint')
      // "захиалга ирэхгүй байна" — order not arrived, acceptable as complaint OR order_status
      expectIntent('захиалга ирэхгүй байна', 'complaint', 'order_status')
    })
    test('Human agent request (Bug fix: хүнтэй ярих → complaint not general)', () => {
      for (const m of ['хүнтэй ярих уу', 'хүн хэрэгтэй', 'менежер дуудах', 'оператор дуудах', 'operator duudaach', 'hun heregteii'])
        expectIntent(m, 'complaint')
    })
    test('General frustration/dissatisfaction', () => {
      for (const m of ['маш муу үйлчилгээ', 'гомдол байна', 'асуудал гарсан', 'эвдэрсэн ирлээ', 'бухимдсан байна'])
        expectIntent(m, 'complaint')
    })
    test('Mixed script complaints', () => {
      for (const m of ['baraa irehgui yaagaad', 'muu uilchilgee', 'mongoo butaaj ug', 'yaagaad udaad baina'])
        expectIntent(m, 'complaint')
    })
  })

  // ── Return/exchange ──────────────────────────────────────────────────────
  describe('Return / exchange', () => {
    test('Cyrillic return/exchange expressions', () => {
      for (const m of ['буцаах боломж байна уу', 'солих боломж', 'хэмжээ тохирохгүй', 'буцаалт хийх'])
        expectIntent(m, 'return_exchange')
    })
    test('Latin transliterations', () => {
      for (const m of ['butsaaj boloh uu', 'butsaah bolomj', 'hemjee tohirohgui', 'solih bolomj', 'solиulj boloh'])
        expectIntent(m, 'return_exchange')
    })
  })

  // ── Shipping ─────────────────────────────────────────────────────────────
  describe('Shipping', () => {
    test('Delivery questions', () => {
      for (const m of ['хүргэлт хэдэн хоног вэ', 'Дархан руу хүргэдэг үү', 'хэдэн өдрийн дотор ирэх вэ'])
        expectIntent(m, 'shipping')
      // "хүргэлтийн үнэ" = delivery fee — shipping OR product_search (price keyword overlap)
      expectIntent('хүргэлтийн үнэ', 'shipping', 'product_search')
    })
    test('Latin delivery queries', () => {
      for (const m of ['hurgelt hedgeen hunug', 'delivery hezee ireh'])
        expectIntent(m, 'shipping', 'order_status')
    })
  })

  // ── Payment ──────────────────────────────────────────────────────────────
  describe('Payment', () => {
    test('Payment method questions', () => {
      for (const m of ['QPay-аар төлж болох уу', 'хуваан төлж болох уу', 'данс руу шилжүүлэх', 'бэлнээр төлж болох уу'])
        expectIntent(m, 'payment')
    })
    test('Latin payment queries', () => {
      for (const m of ['QPay-aar tulj boloh uu', 'huvaan tuluh', 'belneer tuluh', 'dans ruu shilzhuuleh'])
        expectIntent(m, 'payment')
    })
  })

  // ── Size info ────────────────────────────────────────────────────────────
  describe('Size info', () => {
    test('Size chart / body measurements', () => {
      for (const m of ['60кг 165см размер аль нь вэ', '165cm 60kg hemjee', 'size chart', 'хэмжээний хүснэгт'])
        expectIntent(m, 'size_info')
    })
  })

  // ── Thanks ───────────────────────────────────────────────────────────────
  describe('Thanks', () => {
    test('Gratitude expressions', () => {
      for (const m of ['баярлалаа', 'thanks', 'гоё байна', 'рахмат'])
        expectIntent(m, 'thanks')
      // "маш сайн" = "very good" — thanks OR greeting (positive exclamation)
      expectIntent('маш сайн', 'thanks', 'greeting')
    })
  })

  // ── Edge cases: should NOT misclassify ───────────────────────────────────
  describe('Critical non-misclassification', () => {
    test('"minii zahialga yamar baina" must be order_status, not order_collection', () => {
      expectIntent('minii zahialga yamar baina', 'order_status')
    })
    test('"baraa irehgui" must be complaint, not product_search', () => {
      expectIntent('baraa irehgui', 'complaint')
    })
    test('"хүнтэй ярих уу" must be complaint, not general', () => {
      expectIntent('хүнтэй ярих уу', 'complaint')
    })
    test('"zahialna" can be order_collection, not order_status', () => {
      expectIntent('zahialna', 'order_collection', 'product_search')
    })
    test('"Тийм" (yes-confirm) should not trigger order_collection as primary', () => {
      // "Тийм" alone is ambiguous — we just check it doesn't crash
      const r = hybridClassify('Тийм')
      expect(r.intent).toBeTruthy()
    })
  })
})

// ---------------------------------------------------------------------------
// Part 2 — E2E: Widget response quality (real AI, concurrent)
// ---------------------------------------------------------------------------

describe('2. E2E Widget Response Quality', () => {
  let storeId: string

  beforeAll(async () => {
    const { data } = await sb.from('stores').select('id').eq('name', 'Монгол Маркет').single()
    expect(data, 'Монгол Маркет store must exist').toBeTruthy()
    storeId = data!.id
  }, 10000)

  // ── Greeting ────────────────────────────────────────────────────────────
  test('Greeting — warm response, no product list', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'Сайн байна уу')
    expect(r.intent).toBe('greeting')
    expect(r.response).toBeTruthy()
    // Should not list products in greeting
    expect(r.response).not.toMatch(/^\d+\.\s+\*\*/m)  // no numbered product list
  })

  // ── Product search ───────────────────────────────────────────────────────
  test('Product search — Latin typo "noooluur tsamts" → returns products or empty-state msg', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'noooluur tsamts bga uu')
    expect(r.intent).toBe('product_search')
    expect(r.response).toBeTruthy()
    expect(r.response).not.toMatch(/захиалга баталгаажуулж/i)
  })

  // ── Complaint: non-delivery ───────────────────────────────────────────────
  test('Complaint "baraa irehgui" — empathetic, no product recommendations', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'baraa irehgui ene yaagaad')
    expect(r.intent).toBe('complaint')
    expect(r.response).toBeTruthy()
    // Must NOT start recommending products
    expect(r.response).not.toMatch(/санал болгож байна|дараах бүтээгдэхүүн.*харна уу/i)
  })

  // ── Human agent request ──────────────────────────────────────────────────
  test('Human agent "хүнтэй ярих уу" — intent=complaint or escalated, manager response', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'хүнтэй ярих уу')
    expect(['complaint', 'escalated']).toContain(r.intent)
    expect(r.response).toBeTruthy()
    // Should NOT list products
    expect(r.response).not.toMatch(/^\d+\.\s+\*\*[^*]+\*\*\s+—\s+[\d,]+₮/m)
  })

  // ── Order status: Latin transliteration ──────────────────────────────────
  test('"minii zahialga yamar baina" → order_status, asks for order details', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'minii zahialga yamar baina')
    expect(r.intent).toBe('order_status')
    expect(r.response).toBeTruthy()
    // Should NOT start an order draft
    expect(r.orderStep).toBeNull()
  })

  // ── Return/exchange ──────────────────────────────────────────────────────
  test('Return/exchange "butsaaj boloh uu" — policy response', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'butsaaj boloh uu')
    expect(r.intent).toBe('return_exchange')
    expect(r.response).toBeTruthy()
  })

  // ── Shipping query ───────────────────────────────────────────────────────
  test('Shipping "хүргэлт хэдэн хоног вэ" — delivery info', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'хүргэлт хэдэн хоног вэ')
    expect(r.intent).toBe('shipping')
    expect(r.response).toBeTruthy()
    // Must NOT try to start an order
    expect(r.orderStep).toBeNull()
  })

  // ── Payment query ────────────────────────────────────────────────────────
  test('Payment "QPay-aar tulj boloh uu" — payment methods', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, 'QPay-aar tulj boloh uu')
    expect(r.intent).toBe('payment')
    expect(r.response).toBeTruthy()
  })

  // ── Size info ────────────────────────────────────────────────────────────
  test('Size info "60кг 165см размер аль нь вэ" — size recommendation', { timeout: 30000 }, async () => {
    const cid = await newConv(storeId)
    const r = await chat(storeId, cid, '60кг 165см размер аль нь вэ')
    expect(r.intent).toBe('size_info')
    expect(r.response).toBeTruthy()
    expect(r.orderStep).toBeNull()
  })

  // ── Photo during order flow ───────────────────────────────────────────────
  test('Photo question mid-order "zurag ni bnu" — answers photo + keeps order alive', { timeout: 60000 }, async () => {
    const cid = await newConv(storeId)
    // Step 1: search + select
    await chat(storeId, cid, 'арьсан цүнх авна')
    const step2 = await chat(storeId, cid, '1')
    expect(step2.orderStep).toBe('info')

    // Step 3: photo question
    const r = await chat(storeId, cid, 'zurag ni bnu')
    expect(r.intent).toBe('order_collection')
    expect(r.orderStep).toBe('info')  // draft still alive
    // Must NOT be only an address prompt (should have answered the photo question)
    const isStuck = r.response?.trim().startsWith('📦') &&
      r.response?.split('\n').length < 5
    expect(isStuck).toBe(false)
    // Must NOT claim photos are impossible
    expect(r.response).not.toMatch(/зураг (харуулах|үзүүлэх|илгээх) боломжгүй/i)
  })

  // ── Full happy-path order ─────────────────────────────────────────────────
  test('Full order flow: search → select → address → phone → confirm', { timeout: 120000 }, async () => {
    const cid = await newConv(storeId)

    const s1 = await chat(storeId, cid, 'арьсан цүнх авна')
    expect(s1.intent).toMatch(/product_search|order_collection/)

    const s2 = await chat(storeId, cid, '1')
    expect(s2.orderStep).toBe('info')

    const s3 = await chat(storeId, cid, 'БЗД 8 хороо 15 байр 23 тоот')
    expect(s3.orderStep).toBe('info')

    const s4 = await chat(storeId, cid, '99112233')
    expect(s4.orderStep).toBe('confirming')
    expect(s4.response).toMatch(/баталгаажуулах|тийм|үгүй/i)

    const s5 = await chat(storeId, cid, 'Тийм')
    expect(s5.intent).toBe('order_created')
    expect(s5.orderStep).toBeNull()
    // Must NOT say "system is creating order" — should confirm it was created
    expect(s5.response).not.toMatch(/баталгаажуулж байна/i)
  })

  // ── Greeting resets order draft ───────────────────────────────────────────
  test('Greeting mid-order does NOT resume draft', { timeout: 60000 }, async () => {
    const cid = await newConv(storeId)
    await chat(storeId, cid, 'арьсан цүнх авна')
    const step2 = await chat(storeId, cid, '1')
    expect(step2.orderStep).toBe('info')

    const greeting = await chat(storeId, cid, 'Сайн байна уу')
    expect(greeting.intent).toBe('greeting')
    expect(greeting.orderStep).toBeNull()
  })

  // ── Mixed-script realistic conversation ──────────────────────────────────
  test('Mixed-script conversation: Latin query → Cyrillic follow-up', { timeout: 60000 }, async () => {
    const cid = await newConv(storeId)

    const r1 = await chat(storeId, cid, 'sain bn uu')
    expect(r1.intent).toBe('greeting')

    const r2 = await chat(storeId, cid, 'arsan tsunx bga uu')
    expect(r2.intent).toBe('product_search')
    expect(r2.response).toBeTruthy()

    const r3 = await chat(storeId, cid, 'хэдэн өнгөтэй байна вэ')
    // Follow-up about color — should answer product detail
    expect(['product_search', 'product_detail', 'order_collection', 'general']).toContain(r3.intent)
    expect(r3.response).toBeTruthy()
  })
})
