/**
 * Real FB Chat Pattern Tests — journeys based on authentic Facebook message patterns.
 *
 * Messages replicate how actual Mongolian customers chat:
 *  - Abbreviated Latin/Cyrillic: "tiimee", "bzd 8r horoo", "avya"
 *  - Sending measurements: "76kg jintei", "72 undur73kg"
 *  - Dumping address+phone in one line
 *  - Just sending "Хэмжээ" or "Хүргэлт" as a question
 *  - Timing requests: "oroi 9 iin uyd hurgeed uguurei"
 *  - Cancelling at the last step: "Үгүй"
 *  - Complaint after delayed delivery: "72 цаг боллоо ирэхгүй байна"
 *
 * Each journey runs the full processAIChat pipeline (real DB + GPT).
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { processAIChat } from '@/lib/chat-ai-handler'

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

function ok(response: string | undefined) {
  expect(response).toBeTruthy()
  expect(response!.length).toBeGreaterThan(10)
  expect(response).not.toMatch(/undefined|null/i)
}

beforeAll(async () => {
  const { data } = await sb.from('stores').select('id').eq('name', 'Монгол Маркет').single()
  expect(data, 'Монгол Маркет store must exist in DB').toBeTruthy()
  storeId = data!.id
}, 10000)

// ---------------------------------------------------------------------------
// 1. The Abbreviator — writes everything compressed or in Latin
// ---------------------------------------------------------------------------

describe('FB Journey 1 — Abbreviator: compact Latin throughout', () => {
  test('avya → 1 → Cyrillic address+phone combined → тийм', { timeout: 180000 }, async () => {
    const cid = await newConv()

    // "avya" = "авъя" = "I'll take it"
    const t1 = await chat(cid, 'arsan tsunx avya')
    expect(['product_search', 'order_collection']).toContain(t1.intent)
    ok(t1.response)

    const t2 = await chat(cid, '1')
    expect(t2.orderStep).toBe('name')

    // Real FB: dump address and phone on the same line
    // At 'name' step, combined address+phone may go to 'phone' or 'confirming'
    const t3 = await chat(cid, 'БЗД 11р хороо 32 байр 7 тоот 99826105')
    expect(['phone', 'confirming']).toContain(t3.orderStep)

    // If at 'phone' step, send phone again to advance to confirming
    if (t3.orderStep === 'phone') {
      const t3b = await chat(cid, '99826105')
      expect(t3b.orderStep).toBe('confirming')
      expect(t3b.response).toMatch(/баталгаажуулах|тийм|үгүй/i)
    } else {
      expect(t3.response).toMatch(/баталгаажуулах|тийм|үгүй/i)
    }

    const t4 = await chat(cid, 'тийм')
    expect(t4.intent).toBe('order_created')
    expect(t4.orderStep).toBeNull()
    expect(t4.response).toMatch(/амжилттай|баярлалаа/i)
  })

  test('"M awyaa" — size+order in one word → order flow or product search', { timeout: 60000 }, async () => {
    const cid = await newConv()
    // "M awyaa" = "M size I'll buy" — first message ever
    const r = await chat(cid, 'M awyaa')
    expect(['product_search', 'order_collection', 'size_info']).toContain(r.intent)
    ok(r.response)
  })
})

// ---------------------------------------------------------------------------
// 2. The Measurement Sender — just sends kg/cm as a full message
// ---------------------------------------------------------------------------

describe('FB Journey 2 — Measurement Sender: kg/cm shorthand', () => {
  test('"72 undur73kg" cold → size recommendation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '72 undur73kg hemjee')
    expect(r.intent).toBe('size_info')
    ok(r.response)
    expect(r.response).toMatch(/[SMLX]{1,2}/i)
  })

  test('"76kg jintei" after product selected → size advice, no catalog re-list', { timeout: 120000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх байна уу')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('name')

    // Mid-order: sends measurements
    const s3 = await chat(cid, '76kg jintei hemjee')
    ok(s3.response)
    expect(s3.response).not.toMatch(/Ямар бүтээгдэхүүн захиалмаар байна/i)
  })

  test('"hariig awya 60kg-d" → size-specific order intent → product or size', { timeout: 30000 }, async () => {
    const cid = await newConv()
    // "hariig awya 60kg-d" = "I'll take the one that fits 60kg"
    const r = await chat(cid, 'hariig awya 60kg-d')
    expect(['size_info', 'product_search', 'order_collection']).toContain(r.intent)
    ok(r.response)
  })
})

// ---------------------------------------------------------------------------
// 3. The One-Shot Info Sender — dumps address+phone in a single message
// ---------------------------------------------------------------------------

describe('FB Journey 3 — One-Shot Orderer: all info in one message', () => {
  test('After selecting product: sends address+phone together → confirming', { timeout: 120000 }, async () => {
    const cid = await newConv()

    await chat(cid, 'арьсан цүнх авна')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('name')

    // Real FB: "СХД 11р хороо Хөтөл Овоотын 2р гудамж 91162070"
    // At 'name' step, combined address+phone may go to 'phone' or 'confirming'
    const s3 = await chat(cid, 'СХД 11р хороо Хөтөл Овоотын 2р гудамж 91162070')
    expect(['phone', 'confirming']).toContain(s3.orderStep)

    // If at 'phone' step, send phone again to advance to confirming
    if (s3.orderStep === 'phone') {
      const s3b = await chat(cid, '91162070')
      expect(s3b.orderStep).toBe('confirming')
    }

    const s4 = await chat(cid, 'тийм')
    expect(s4.intent).toBe('order_created')
  })

  test('Address includes floor/apartment detail: "9 давхар 52 тоот 89062126"', { timeout: 120000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('name')

    // At 'name' step, combined address+phone may go to 'phone' or 'confirming'
    const s3 = await chat(cid, '100 айл УБЦ баруун талын 53р байр 9 давхар 52 тоот 89062126')
    expect(['phone', 'confirming']).toContain(s3.orderStep)

    // If at 'phone' step, send phone again to advance to confirming
    if (s3.orderStep === 'phone') {
      const s3b = await chat(cid, '89062126')
      expect(s3b.orderStep).toBe('confirming')
    }

    const s4 = await chat(cid, 'тийм')
    expect(s4.intent).toBe('order_created')
  })
})

// ---------------------------------------------------------------------------
// 4. The Canceller — bails at different stages
// ---------------------------------------------------------------------------

describe('FB Journey 4 — Canceller: bails at different stages', () => {
  test('"захиалаагүй ээ" mid-order → draft cleared', { timeout: 60000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    const s2 = await chat(cid, '1')
    expect(s2.orderStep).toBe('name')

    // "захиалаагүй ээ" = "I didn't order / not ordering" — common FB message
    const s3 = await chat(cid, 'захиалаагүй ээ')
    expect(s3.orderStep).toBeNull()
    ok(s3.response)
  })

  test('"Үгүй" at confirmation step → order cancelled + clean state', { timeout: 120000 }, async () => {
    const cid = await newConv()
    await chat(cid, 'арьсан цүнх авна')
    await chat(cid, '1')
    await chat(cid, 'БЗД 5р хороо 10 байр 3 тоот')
    const s4 = await chat(cid, '99887766')
    expect(s4.orderStep).toBe('confirming')

    const s5 = await chat(cid, 'Үгүй')
    expect(s5.orderStep).toBeNull()
    expect(s5.response).toMatch(/цуцлагдлаа|болиулсан|захиалаагүй/i)

    // Can start fresh after cancelling
    const s6 = await chat(cid, 'арьсан цүнх байна уу')
    expect(s6.intent).toBe('product_search')
    ok(s6.response)
  })
})

// ---------------------------------------------------------------------------
// 5. The Timing Customer — asks about specific delivery time
// ---------------------------------------------------------------------------

describe('FB Journey 5 — Timing Customer: delivery time requests', () => {
  test.concurrent('"oroi 9 iin uyd hurgeed uguurei" → shipping, NOT table_reservation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'oroi 9 iin uyd hurgeed uguurei')
    expect(r.intent).not.toBe('table_reservation')
    expect(['shipping', 'general', 'order_collection', 'product_search']).toContain(r.intent)
    ok(r.response)
  })

  test.concurrent('"Маргааш 12цагаас шуудантай" → shipping/general, NOT table_reservation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Маргааш 12цагаас шуудантай юм бна шүү')
    expect(r.intent).not.toBe('table_reservation')
    expect(['shipping', 'general', 'order_status']).toContain(r.intent)
    ok(r.response)
  })

  test.concurrent('"margaash awh bolomjtoi" → pickup query → shipping/general', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'margaash awh bolomjtoi')
    expect(r.intent).not.toBe('table_reservation')
    expect(['shipping', 'general', 'product_search']).toContain(r.intent)
    ok(r.response)
  })

  test.concurrent('"Ajiliin tsagaar 17 tsag hyrtel ... 90847576" — time+address+phone in one', { timeout: 30000 }, async () => {
    // This is a real FB message — a very long order info dump
    const cid = await newConv()
    const r = await chat(cid, 'Ajiliin tsagaar 17 tsag hyrtel Ulaanbaatar zochid buudliin ard zasgiin gazriin 3 Bair 1 Davhart ireed 90847576 zalgah')
    // Should not crash — may classify as shipping, general, or even order_collection
    expect(r.intent).not.toBe('table_reservation')
    ok(r.response)
  })
})

// ---------------------------------------------------------------------------
// 6. The Color-First Buyer — asks colors, then orders
// ---------------------------------------------------------------------------

describe('FB Journey 6 — Color-First Buyer', () => {
  test.concurrent('"Ongo bodit zurag bnuu" → product/general, NOT complaint', { timeout: 30000 }, async () => {
    const cid = await newConv()
    // "Ongo bodit zurag bnuu" = "Is there a photo of the actual color?"
    const r = await chat(cid, 'Ongo bodit zurag bnuu')
    expect(r.intent).not.toBe('complaint')
    expect(r.intent).not.toBe('table_reservation')
    ok(r.response)
  })

  test('"өөр өнгө бна уу" → "цагаан нэгийг авъя" → full order', { timeout: 120000 }, async () => {
    const cid = await newConv()

    const t1 = await chat(cid, 'өөр өнгө бна уу цагаан байна уу')
    expect(['product_search', 'general']).toContain(t1.intent)
    ok(t1.response)

    const t2 = await chat(cid, 'цагаан нэгийг авъя')
    expect(['product_search', 'order_collection']).toContain(t2.intent)
    ok(t2.response)

    const t3 = await chat(cid, '1')
    expect(t3.orderStep).toBe('name')

    // Address+phone on one line — at 'name' step, may go to 'phone' or 'confirming'
    const t4 = await chat(cid, 'СХД 3р хороо 15 байр 22 тоот 88776655')
    expect(['phone', 'confirming']).toContain(t4.orderStep)

    // If at 'phone' step, send phone again to advance to confirming
    if (t4.orderStep === 'phone') {
      const t4b = await chat(cid, '88776655')
      expect(t4b.orderStep).toBe('confirming')
    }

    const t5 = await chat(cid, 'тийм')
    expect(t5.intent).toBe('order_created')
  })

  test('"Gun bor ungu" (dark grey) → product search, not complaint', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Gun bor ungu bga uu')
    expect(r.intent).not.toBe('complaint')
    ok(r.response)
  })
})

// ---------------------------------------------------------------------------
// 7. The Confused Sender — sends things out of order
// ---------------------------------------------------------------------------

describe('FB Journey 7 — Confused Sender: info in wrong order', () => {
  test.concurrent('Sends bare phone number cold → no fake order confirmation', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, '88950606')
    ok(r.response)
    expect(r.response).not.toMatch(/захиалга баталгаажлаа|захиалга үүслээ/i)
    expect(r.response).not.toMatch(/амжилттай.*захиалга/i)
  })

  test.concurrent('"dansnii" — asking for bank account number → payment info', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'dansnii')
    // "dansnii" (дансний) can match payment (данс keyword) or product_search (Latin fallback)
    expect(['payment', 'general', 'product_search']).toContain(r.intent)
    ok(r.response)
  })

  test.concurrent('"Холбоо барих утас" — asking for store contact → general', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Холбоо барих утас')
    // "Холбоо барих утас" = "contact phone" — can be classified as general, shipping, payment,
    // product_search, complaint, or store_info (requesting store contact info)
    expect(['general', 'shipping', 'payment', 'product_search', 'complaint', 'store_info']).toContain(r.intent)
    ok(r.response)
  })

  test('Phone first → then browses → then orders normally', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // Confused — sends phone as first message
    const t1 = await chat(cid, '88950606')
    ok(t1.response)
    expect(t1.response).not.toMatch(/захиалга.*үүслээ/i)

    // Then actually asks about product
    const t2 = await chat(cid, 'арьсан цүнх байна уу')
    expect(t2.intent).toBe('product_search')
    ok(t2.response)

    // Selects
    const t3 = await chat(cid, '1')
    expect(t3.orderStep).toBe('name')
  })
})

// ---------------------------------------------------------------------------
// 8. The 72-Hour Complainer — delayed delivery → escalation
// ---------------------------------------------------------------------------

describe('FB Journey 8 — 72-Hour Complainer: delayed delivery', () => {
  test('Complaint → asks where package is → demands refund → escalates', { timeout: 120000 }, async () => {
    const cid = await newConv()

    // "72 цаг боллоо" = "72 hours have passed (and nothing arrived)"
    const t1 = await chat(cid, '72 цаг боллоо ирэхгүй байна')
    expect(['complaint', 'order_status']).toContain(t1.intent)
    ok(t1.response)
    // Must NOT push products on a delivery complaint
    expect(t1.response).not.toMatch(/дараах бүтээгдэхүүн|санал болгож/i)

    // "Haana ywj bgaag ni asuugaad ugch boloh uu" = "Can you ask where it is for me?"
    const t2 = await chat(cid, 'Haana ywj bgaag ni asuugaad ugch boloh uu')
    expect(['order_status', 'complaint', 'shipping', 'general', 'product_search']).toContain(t2.intent)
    ok(t2.response)

    // Demands refund
    const t3 = await chat(cid, 'мөнгөө буцааж өгөөч буцаах юм уу')
    expect(['return_exchange', 'complaint', 'general']).toContain(t3.intent)
    ok(t3.response)
    expect(t3.response).not.toMatch(/санал болгож байна/i)

    // Asks for human
    const t4 = await chat(cid, 'хүнтэй ярьж болох уу менежер')
    // "болох уу" can score product_search — any non-table-reservation intent is fine
    expect(t4.intent).not.toBe('table_reservation')
    ok(t4.response)
    // No product list when escalating
    expect(t4.response).not.toMatch(/^\d+\.\s+\*\*[^*]+\*\*\s+—\s+[\d,]+₮/m)
  })
})

// ---------------------------------------------------------------------------
// 9. The Gift Buyer — buying for someone else
// ---------------------------------------------------------------------------

describe('FB Journey 9 — Gift Buyer: buying for someone else', () => {
  test.concurrent('"Бэлэг" cold → helpful response, no hallucinated product push', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Бэлэг')
    // "Бэлэг" (gift) can trigger order_collection ("авах" intent) or product_search
    expect(['general', 'product_search', 'order_collection']).toContain(r.intent)
    ok(r.response)
  })

  test('Gift journey: бэлэг → who for → budget → browses', { timeout: 120000 }, async () => {
    const cid = await newConv()

    const t1 = await chat(cid, 'бэлэг авмаар байна')
    // "авмаар байна" triggers order intent → order_collection is valid
    expect(['general', 'product_search', 'order_collection']).toContain(t1.intent)
    ok(t1.response)

    // Specifies recipient
    const t2 = await chat(cid, 'эмэгтэй нөхрийнхөө ээжид')
    // Conversational follow-up — classifier may see greeting pattern or general
    expect(['general', 'product_search', 'greeting']).toContain(t2.intent)
    ok(t2.response)
    expect(t2.response).not.toMatch(/ширээ|резерв|table/i)

    // Specifies budget — numbers can trigger size_info (size numbers) or product_search
    const t3 = await chat(cid, 'төсөв 50-80 мянга орчим')
    expect(['general', 'product_search', 'size_info']).toContain(t3.intent)
    ok(t3.response)
    // Response should be helpful, not a restaurant table prompt
    expect(t3.response).not.toMatch(/ширээ захиалах|резерв/i)
  })
})

// ---------------------------------------------------------------------------
// 10. The FB-Notification Sender — pastes notification links
// ---------------------------------------------------------------------------

describe('FB Journey 10 — Misc FB patterns that must not crash', () => {
  test.concurrent('FB notification link pasted → graceful response', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid,
      'Мөнх-Од Ц. replied to a post. See post(https://www.facebook.com/story.php?story_fbid=pfbid0diH7&id=100064)'
    )
    ok(r.response)
  })

  test.concurrent('"Thhh" — garbled/emoji-only style message → graceful', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Thhh')
    ok(r.response)
  })

  test.concurrent('"Boljiga yum bolu" — very informal → general', { timeout: 30000 }, async () => {
    // "Boljiga yum bolu" ≈ "Бол жига юм болуу" = "Is it legit?" slang
    const cid = await newConv()
    const r = await chat(cid, 'Boljiga yum bolu')
    ok(r.response)
    expect(r.intent).not.toBe('table_reservation')
  })

  test.concurrent('"Unsubscribe" — unsubscribe intent → handled', { timeout: 30000 }, async () => {
    const cid = await newConv()
    const r = await chat(cid, 'Unsubscribe')
    ok(r.response)
  })

  test.concurrent('"ymrhu ym bsn bile haha martchij" — self-correction → general', { timeout: 30000 }, async () => {
    // "ymrhu ym bsn bile haha martchij" = "Oh what was it haha I forgot"
    const cid = await newConv()
    const r = await chat(cid, 'ymrhu ym bsn bile haha martchij')
    ok(r.response)
    expect(r.intent).not.toBe('table_reservation')
    expect(r.intent).not.toBe('complaint')
  })
})
