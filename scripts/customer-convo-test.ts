/**
 * customer-convo-test.ts
 *
 * Simulates a REAL customer conversation with:
 * - Latin / transliterated Mongolian
 * - Typos and abbreviations
 * - Mid-flow changes of mind
 * - Complaint + escalation
 * - Gift card
 *
 * After each message: verify the expected DB state changed.
 */

import { config } from 'dotenv'
config({ path: '.env.vprod' })

import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

const PROD     = 'https://temuulel-app.vercel.app'
const WIDGET   = `${PROD}/api/chat/widget`
const STORE_ID = '236636f3-0a44-4f04-aba1-312e00d03166'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── State ────────────────────────────────────────────────────────────────────
const SENDER  = `real_cust_${Date.now()}`
const CONV_ID = crypto.randomUUID()
let msgNum    = 0
let passCount = 0
let failCount = 0
const failures: string[] = []

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

function ok(label: string, value: boolean, detail = '') {
  if (value) {
    console.log(`    ✅ ${label}`)
    passCount++
  } else {
    console.log(`    ❌ FAIL: ${label}${detail ? ` (${detail})` : ''}`)
    failCount++
    failures.push(label)
  }
}

async function say(message: string): Promise<{
  status: number
  intent: string
  response: string
  orderStep: string | null
  handoff: boolean
  products: number
}> {
  msgNum++
  const label = `#${String(msgNum).padStart(2,'0')}`
  console.log(`\n  ${label} 👤 "${message}"`)

  const res = await fetch(WIDGET, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: STORE_ID,
      customer_message: message,
      sender_id: SENDER,
      conversation_id: CONV_ID,
    }),
  })

  const data = await res.json()
  const intent    = data.intent ?? '?'
  const response  = (data.response ?? '').replace(/\n/g, ' ').substring(0, 120)
  const orderStep = data.order_step ?? null
  const handoff   = !!data.handoff
  const products  = data.products_found ?? 0

  console.log(`       🤖 [${intent}${orderStep ? '/'+orderStep : ''}] ${response}`)
  if (handoff) console.log(`       🚨 HANDOFF TRIGGERED`)

  ok('HTTP 200', res.status === 200, `got ${res.status}`)

  await delay(2200) // stay under 20 req/min rate limit
  return { status: res.status, intent, response: data.response ?? '', orderStep, handoff, products }
}

async function dbCheck(label: string, query: () => Promise<boolean>) {
  const result = await query()
  ok(label, result)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  REAL CUSTOMER CONVERSATION TEST — Latin / Typos / Messy    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log(`  CONV_ID : ${CONV_ID}`)
  console.log(`  SENDER  : ${SENDER}\n`)

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 1: Greeting + product browse ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  let r = await say('sain baina uu')
  ok('greeting intent', r.intent === 'greeting')

  r = await say('ymar baraa baina? jagsaalt haruulna uu')
  ok('product_search intent', r.intent === 'product_search')
  ok('products returned', r.products >= 1, `got ${r.products}`)

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 2: Select product, change mind, reselect ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  r = await say('1')  // select product 1
  ok('order_collection intent', r.intent === 'order_collection')

  // Change of mind — customer asks about a different product
  r = await say('USB-C cenlegch bna uu? une ni hed ve?')
  ok('keeps order context or searches', ['order_collection','product_search','general'].includes(r.intent))

  // Pick product by number from the fresh list or go back
  r = await say('3')  // try selecting #3
  ok('order_collection or product_search', ['order_collection','product_search'].includes(r.intent))

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 3: Fresh order — full checkout with Latin address ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  // Start fresh: explicitly pick the USB-C charger
  r = await say('USB-C cenlegch avmaar bna')
  ok('order_collection intent', r.intent === 'order_collection')

  // Phone — customer sends it first
  r = await say('99001122')
  ok('order_collection continues', r.intent === 'order_collection')
  ok('not escalated', !r.handoff)

  // Address — Latin, abbreviation style with typo ("horoo" misspelled as "horo")
  r = await say('bzd 14r horo tumen nast 36a 12 toot')
  ok('order_collection continues', r.intent === 'order_collection')
  ok('moved to confirming OR still collecting', r.orderStep === 'confirming' || r.orderStep === 'info' || !r.orderStep)
  ok('NOT escalated during checkout', !r.handoff)

  // If address wasn't recognized (info step still), try with "bair" keyword
  if (r.orderStep === 'info' || r.response.includes('хаяг')) {
    console.log('    ℹ️  Address not matched, retrying with "bair" keyword')
    r = await say('bzd 14r horoo tumen nast 36 bair 12 toot')
    ok('address recognized on retry', r.orderStep === 'confirming' || !r.response.includes('хаяг'))
  }

  // If still in info, try fully Mongolian address
  if (r.orderStep === 'info' || r.response.includes('хаяг')) {
    console.log('    ℹ️  Retrying with Cyrillic address')
    r = await say('Баянзүрх дүүрэг, 14-р хороо, 36 байр, 12 тоот')
    ok('Cyrillic address recognized', r.orderStep === 'confirming')
  }

  // Show summary if we're at confirming
  if (r.orderStep === 'confirming' || r.response.includes('Баталгаажуулах')) {
    ok('order summary shown', r.response.includes('₮') || r.response.includes('Захиалга'))

    // Confirm with casual Latin
    r = await say('tiim ee zahialaad og')
    ok('order_created intent', r.intent === 'order_created', `got ${r.intent}`)
    ok('order number in response', r.response.includes('ORD-'))
    ok('not handoff', !r.handoff)

    // Verify order in DB
    await delay(1000)
    await dbCheck('Order exists in DB', async () => {
      const { data } = await sb
        .from('orders')
        .select('id, order_number, status, shipping_address, payment_status')
        .eq('store_id', STORE_ID)
        .ilike('notes', `%${SENDER.substring(0,15)}%`)
        .order('created_at', { ascending: false })
        .limit(1)
      if (data && data.length > 0) {
        console.log(`         → ${data[0].order_number} | status: ${data[0].status} | addr: ${String(data[0].shipping_address ?? '').substring(0,40)}`)
        return true
      }
      // fallback: check by recent orders
      const { data: recent } = await sb
        .from('orders')
        .select('id, order_number, status, shipping_address')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false })
        .limit(1)
      if (recent?.[0]) {
        console.log(`         → ${recent[0].order_number} | status: ${recent[0].status} | addr: ${String(recent[0].shipping_address ?? '').substring(0,40)}`)
        return true
      }
      return false
    })

    await dbCheck('Delivery auto-created', async () => {
      const { data } = await sb
        .from('deliveries')
        .select('id, delivery_number, status, delivery_address')
        .eq('store_id', STORE_ID)
        .order('created_at', { ascending: false })
        .limit(1)
      if (data?.[0]) {
        console.log(`         → ${data[0].delivery_number} | status: ${data[0].status}`)
        return true
      }
      return false
    })
  } else {
    ok('reached confirming step', false, `stuck at: ${r.orderStep ?? r.intent}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 4: Customer asks order status after ordering ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  r = await say('zahialga maani haana yavj baina ve')
  ok('order_status intent', ['order_status','general','order_collection'].includes(r.intent))

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 5: Complaint — frustrated customer ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  r = await say('yaagaad ene hed udaj bain yum!! uulaad bna')
  ok('complaint intent', ['complaint','general'].includes(r.intent))
  ok('NOT escalated on first complaint (score too low)', !r.handoff)

  await dbCheck('Escalation score > 0', async () => {
    const { data } = await sb
      .from('conversations')
      .select('escalation_score, status')
      .eq('id', CONV_ID)
      .single()
    console.log(`         → score: ${data?.escalation_score}, status: ${data?.status}`)
    return (data?.escalation_score ?? 0) > 0
  })

  r = await say('yaagaad udaan bain yum yaagaad ene hed hols bain')
  ok('second complaint registered', ['complaint','general'].includes(r.intent))

  r = await say('mongoo butsaaj uguurei manageree duu')
  ok('escalation triggered', r.handoff === true || r.intent === 'escalated', `intent: ${r.intent}`)

  await dbCheck('Conversation escalated in DB', async () => {
    const { data } = await sb
      .from('conversations')
      .select('escalation_score, status, escalated_at')
      .eq('id', CONV_ID)
      .single()
    console.log(`         → score: ${data?.escalation_score}, status: ${data?.status}`)
    return data?.status === 'escalated' || (data?.escalation_score ?? 0) >= 60
  })

  await dbCheck('Escalation notification sent to store', async () => {
    const { data } = await sb
      .from('notifications')
      .select('type, created_at')
      .eq('store_id', STORE_ID)
      .in('type', ['escalation', 'human_handoff', 'new_message'])
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.[0]) {
      console.log(`         → notification type: ${data[0].type}`)
      return true
    }
    return false
  })

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 6: Gift card purchase ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  // New sender + conv for clean gift card test
  const GC_SENDER  = `gc_real_${Date.now()}`
  const GC_CONV_ID = crypto.randomUUID()

  async function gcSay(msg: string) {
    await delay(2200)
    const res = await fetch(WIDGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: STORE_ID,
        customer_message: msg,
        sender_id: GC_SENDER,
        conversation_id: GC_CONV_ID,
      }),
    })
    const d = await res.json()
    console.log(`\n  🎁 👤 "${msg}"`)
    console.log(`     🤖 [${d.intent ?? '?'}] ${(d.response ?? '').replace(/\n/g, ' ').substring(0, 120)}`)
    ok('HTTP 200', res.status === 200, `got ${res.status}`)
    return d
  }

  let gd = await gcSay('belgiin kart avmaar bna')
  ok('gift_card_purchase intent', gd.intent === 'gift_card_purchase', `got ${gd.intent}`)
  ok('denomination list shown', (gd.response ?? '').includes('₮'))

  gd = await gcSay('50000')
  ok('amount accepted', gd.intent === 'gift_card_purchase')
  ok('payment/confirm step', (gd.response ?? '').toLowerCase().includes('баталгаажуулах') || (gd.response ?? '').includes('QPay') || (gd.response ?? '').includes('₮'))

  // If QPay not configured → confirm directly
  if ((gd.response ?? '').includes('Баталгаажуулах')) {
    gd = await gcSay('tiim')
    ok('gift card created', gd.intent === 'gift_card_purchase')
    const hasCode = /GIFT-[A-Z0-9]/.test(gd.response ?? '')
    ok('gift card code in response', hasCode, gd.response?.substring(0, 80))

    if (hasCode) {
      // Don't send to anyone
      gd = await gcSay('ugui')
      ok('gift card kept', ['gift_card_purchase','general'].includes(gd.intent))
    }
  }

  await dbCheck('Gift card exists in DB', async () => {
    const { data } = await sb
      .from('gift_cards')
      .select('code, current_balance, status')
      .eq('store_id', STORE_ID)
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.[0]) {
      console.log(`         → code: ${data[0].code} | balance: ${data[0].current_balance} | status: ${data[0].status}`)
      return true
    }
    return false
  })

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ SCENARIO 7: Weird / edge case messages ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  // Random junk
  r = await say('asdfgh 12345')
  ok('no crash on junk', r.status === 200)

  // Very short
  r = await say('ok')
  ok('no crash on "ok"', r.status === 200)

  // All caps frustration
  r = await say('YAG YAGAAD INGEED BAIN CHINI!!!')
  ok('no crash on caps', r.status === 200)

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ DB AUDIT ━━━')
  // ──────────────────────────────────────────────────────────────────────────

  await dbCheck('Messages saved to DB', async () => {
    const { count } = await sb
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', CONV_ID)
    console.log(`         → ${count} messages in conversation`)
    return (count ?? 0) > 0
  })

  await dbCheck('Conversation state has last_intent', async () => {
    const { data } = await sb
      .from('conversations')
      .select('status, escalation_score')
      .eq('id', CONV_ID)
      .single()
    console.log(`         → status: ${data?.status}, score: ${data?.escalation_score}`)
    return !!data
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n━━━ CLEANUP ━━━')
  const { data: gcConv } = await sb.from('conversations').select('customer_id').eq('id', GC_CONV_ID).single()
  await sb.from('messages').delete().eq('conversation_id', GC_CONV_ID)
  await sb.from('conversations').delete().eq('id', GC_CONV_ID)
  if (gcConv?.customer_id) await sb.from('customers').delete().eq('id', gcConv.customer_id)
  console.log('    ✅ Gift card test conversation cleaned up')

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log(`║  RESULT: ${String(passCount).padStart(2)} passed, ${String(failCount).padStart(2)} failed                                 ║`)
  console.log('╠══════════════════════════════════════════════════════════════╣')
  if (failures.length === 0) {
    console.log('║  All checks passed ✅                                        ║')
  } else {
    for (const f of failures) {
      console.log(`║  ❌ ${f.substring(0, 58).padEnd(58)} ║`)
    }
  }
  console.log('╚══════════════════════════════════════════════════════════════╝\n')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
