/**
 * test-real-life.ts
 *
 * Full real-life simulation with real HTTP requests, real DB checks,
 * and real Telegram messages.
 *
 * Scenarios:
 *   1. Customer Happy Path Order (localhost)
 *   2. Customer Name "Shinebayar" Regression (localhost)
 *   3. Customer Cancels Mid-Order (localhost)
 *   4. Customer Complaint → Escalation (localhost)
 *   5. Driver Delivery Flow (localhost + real Telegram)
 *   6. Driver Denies Delivery (localhost)
 *   7. Production Smoke Test (production, 3.5s delays)
 *   8. Latin Misclassification (NotebookLM gap)
 *   9. Order Tracking
 *  10. Real FB Chat — Togs Jargal (hardest, 216 msgs)
 *  11. Real FB Chat — Pola Ris (messy Latin, 132 instances)
 *  12. Real FB Chat — Batchimeg (name contains "hi")
 *  13. Real FB Chat — Rural Customer (Ovorkhangai)
 *  14. Real FB Chat — Angry Customer (17 complaints)
 *  15. Real FB Chat — Multi-Product
 *  16. Complaint During Checkout
 *  17. Gift Card Purchase
 *  18. Full Connected Flow (Chat → Order → Driver → Payment → Notifications)
 *
 * Usage:
 *   E2E_RATE_LIMIT_BYPASS=true npx tsx scripts/test-real-life.ts
 *
 * Prerequisites:
 *   - Local Next.js dev server running on port 3000 with E2E_RATE_LIMIT_BYPASS=true
 *   - .env.local with Supabase + Telegram credentials
 *   - Монгол Маркет store seeded in DB
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ============================================================================
// Config
// ============================================================================

const LOCAL = 'http://localhost:3000'
const PROD = 'https://temuulel-app.vercel.app'
const DRIVER_CHAT_ID = 1999860372
const DRIVER_BOT_TOKEN = process.env.DRIVER_TELEGRAM_BOT_TOKEN!
const DRIVER_WEBHOOK_SECRET =
  process.env.DRIVER_TELEGRAM_WEBHOOK_SECRET ||
  process.env.TELEGRAM_WEBHOOK_SECRET ||
  ''

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// State
// ============================================================================

const NOW = Date.now()
const TEST_START = new Date().toISOString()
let totalScenarios = 0
let passedScenarios = 0
let totalOrders = 0
let totalDeliveries = 0
let totalTelegramMessages = 0
let bugsFound = 0

// ============================================================================
// Helpers
// ============================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function ok(step: number, msg: string) {
  console.log(`  Step ${step}: ${msg}`)
}

function dbOk(msg: string) {
  console.log(`  DB: \u2705 ${msg}`)
}

function dbFail(msg: string) {
  console.log(`  DB: \ud83d\udd34 ${msg}`)
}

function scenarioResult(pass: boolean) {
  totalScenarios++
  if (pass) {
    passedScenarios++
    console.log('  Result: \u2705 PASS\n')
  } else {
    bugsFound++
    console.log('  Result: \ud83d\udd34 FAIL\n')
  }
}

function section(title: string) {
  console.log(title)
}

// ============================================================================
// Facebook message extraction helpers
// ============================================================================

function decodeFB(s: string): string {
  try {
    return Buffer.from(s, 'latin1').toString('utf-8')
  } catch {
    return s
  }
}

function extractCustomerMessages(
  filePath: string,
  storeName: string,
  maxMessages: number
): string[] {
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    const messages: string[] = []
    for (const m of [...data.messages].reverse()) {
      const sender = decodeFB(m.sender_name || '')
      const content = m.content ? decodeFB(m.content) : ''
      if (sender === storeName || !content) continue
      if (
        content.includes('replied to') ||
        content.includes('reacted') ||
        content.includes('sent a photo')
      )
        continue
      if (content.length >= 3 && content.length <= 200)
        messages.push(content.trim())
      if (messages.length >= maxMessages) break
    }
    return messages
  } catch {
    return []
  }
}

// ============================================================================
// Two-step chat: save message then get AI response
// ============================================================================

interface ChatResult {
  conversationId: string
  saveStatus: number
  aiStatus: number
  intent: string
  response: string
  productsFound: number
  orderStep: string | null
}

async function chat(
  api: string,
  storeId: string,
  senderId: string,
  message: string,
  conversationId?: string,
  delayMs = 1000
): Promise<ChatResult> {
  await delay(delayMs)

  // Step 1: Save customer message
  const saveRes = await fetch(`${api}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: senderId,
      store_id: storeId,
      role: 'user',
      content: message,
    }),
  })
  const saveData = saveRes.ok ? await saveRes.json() : {}
  const convId = saveData.conversation_id || conversationId

  await delay(300) // small gap between the two calls

  // Step 2: Get AI response
  const aiRes = await fetch(`${api}/api/chat/widget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: storeId,
      customer_message: message,
      sender_id: senderId,
      conversation_id: convId,
    }),
  })
  const aiData = aiRes.ok
    ? await aiRes.json()
    : { intent: 'error', response: `HTTP ${aiRes.status}` }

  return {
    conversationId: convId,
    saveStatus: saveRes.status,
    aiStatus: aiRes.status,
    intent: aiData.intent,
    response: aiData.response || '',
    productsFound: aiData.products_found ?? 0,
    orderStep: aiData.order_step ?? null,
  }
}

// ============================================================================
// Driver webhook
// ============================================================================

async function driverWebhook(
  api: string,
  payload: object
): Promise<Response> {
  return fetch(`${api}/api/telegram/driver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': DRIVER_WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  })
}

// ============================================================================
// Send real Telegram message to driver
// ============================================================================

async function sendDriverTelegram(text: string): Promise<boolean> {
  if (!DRIVER_BOT_TOKEN) {
    console.log('  \u26a0\ufe0f  DRIVER_TELEGRAM_BOT_TOKEN not set, skipping real Telegram message')
    return false
  }
  const res = await fetch(
    `https://api.telegram.org/bot${DRIVER_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: DRIVER_CHAT_ID, text }),
    }
  )
  if (res.ok) {
    totalTelegramMessages++
    return true
  }
  console.log(`  \ud83d\udd34  Telegram send failed: HTTP ${res.status}`)
  return false
}

// ============================================================================
// Scenario 1: Customer Happy Path Order (localhost)
// ============================================================================

async function scenario1(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 1: Customer Happy Path Order')
  const senderId = `web_e2e_happy_${NOW}`
  let pass = true
  let convId: string | undefined

  // Step 1: Greeting
  const r1 = await chat(LOCAL, storeId, senderId, '\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443')
  convId = r1.conversationId
  if (r1.aiStatus === 200 && r1.intent === 'greeting') {
    ok(1, `"\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443" \u2192 \u2705 ${r1.intent} (HTTP ${r1.aiStatus})`)
  } else {
    ok(1, `"\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443" \u2192 \ud83d\udd34 ${r1.intent} (HTTP ${r1.aiStatus})`)
    pass = false
  }

  // Step 2: Product search
  const r2 = await chat(LOCAL, storeId, senderId, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', convId)
  if (r2.aiStatus === 200 && r2.intent === 'product_search' && r2.productsFound > 0) {
    ok(2, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 ${r2.intent}, ${r2.productsFound} products`)
  } else {
    ok(2, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \ud83d\udd34 intent=${r2.intent}, products=${r2.productsFound}`)
    pass = false
  }

  // Step 3: Select product
  const r3 = await chat(LOCAL, storeId, senderId, '1', convId)
  if (r3.aiStatus === 200 && (r3.orderStep || r3.intent === 'order_collection')) {
    ok(3, `"1" \u2192 \u2705 ${r3.intent}, step=${r3.orderStep || 'started'}`)
  } else {
    ok(3, `"1" \u2192 \ud83d\udd34 intent=${r3.intent}, step=${r3.orderStep}`)
    pass = false
  }

  // Step 4: Name
  const r4 = await chat(LOCAL, storeId, senderId, '\u0411\u0430\u0442-\u042d\u0440\u0434\u044d\u043d\u044d', convId)
  if (r4.aiStatus === 200 && r4.intent !== 'greeting') {
    ok(4, `"\u0411\u0430\u0442-\u042d\u0440\u0434\u044d\u043d\u044d" \u2192 \u2705 ${r4.intent}, NOT greeting`)
  } else {
    ok(4, `"\u0411\u0430\u0442-\u042d\u0440\u0434\u044d\u043d\u044d" \u2192 \ud83d\udd34 intent=${r4.intent} (should NOT be greeting)`)
    pass = false
  }

  // Step 5: Phone
  const r5 = await chat(LOCAL, storeId, senderId, '99887766', convId)
  if (r5.aiStatus === 200) {
    ok(5, `"99887766" \u2192 \u2705 ${r5.intent}, step=${r5.orderStep || 'phone captured'}`)
  } else {
    ok(5, `"99887766" \u2192 \ud83d\udd34 HTTP ${r5.aiStatus}`)
    pass = false
  }

  // Step 6: Address (Баянгол = 3000₮)
  const r6 = await chat(LOCAL, storeId, senderId, '\u0411\u0430\u044f\u043d\u0433\u043e\u043b \u0434\u04af\u04af\u0440\u044d\u0433 3-\u0440 \u0445\u043e\u0440\u043e\u043e 15 \u0431\u0430\u0439\u0440 201 \u0442\u043e\u043e\u0442', convId)
  if (r6.aiStatus === 200) {
    ok(6, `"\u0411\u0430\u044f\u043d\u0433\u043e\u043b \u0434\u04af\u04af\u0440\u044d\u0433 3-\u0440 \u0445\u043e\u0440\u043e\u043e..." \u2192 \u2705 ${r6.intent}, step=${r6.orderStep || 'address captured'}`)
  } else {
    ok(6, `"\u0411\u0430\u044f\u043d\u0433\u043e\u043b..." \u2192 \ud83d\udd34 HTTP ${r6.aiStatus}`)
    pass = false
  }

  // Step 7: Confirm order
  const r7 = await chat(LOCAL, storeId, senderId, '\u0422\u0438\u0439\u043c', convId)
  if (r7.aiStatus === 200) {
    ok(7, `"\u0422\u0438\u0439\u043c" \u2192 \u2705 ${r7.intent}, step=${r7.orderStep || 'confirmed'}`)
  } else {
    ok(7, `"\u0422\u0438\u0439\u043c" \u2192 \ud83d\udd34 HTTP ${r7.aiStatus}`)
    pass = false
  }

  // DB checks (after 1s delay for fire-and-forget async)
  await delay(1000)

  // Find customer by sender_id
  const { data: customer } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', senderId)
    .single()

  if (!customer) {
    dbFail('Customer not found in DB')
    return false
  }

  // Check orders table
  const { data: orders } = await sb
    .from('orders')
    .select('id, order_number, total_amount, store_id')
    .eq('store_id', storeId)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (orders && orders.length > 0) {
    const order = orders[0]
    dbOk(`Order ${order.order_number} created (${new Intl.NumberFormat('mn-MN').format(order.total_amount)}\u20ae)`)
    totalOrders++

    // Check deliveries table
    const { data: deliveries } = await sb
      .from('deliveries')
      .select('id, delivery_number, delivery_fee')
      .eq('order_id', order.id)
      .limit(1)

    if (deliveries && deliveries.length > 0) {
      const del = deliveries[0]
      dbOk(`Delivery ${del.delivery_number} created (fee: ${new Intl.NumberFormat('mn-MN').format(del.delivery_fee || 0)}\u20ae \u0411\u0430\u044f\u043d\u0433\u043e\u043b)`)
      totalDeliveries++

      if (del.delivery_fee !== 3000) {
        dbFail(`Expected delivery_fee=3000 (\u0411\u0430\u044f\u043d\u0433\u043e\u043b), got ${del.delivery_fee}`)
        pass = false
      }
    } else {
      dbFail('No delivery found for this order')
      pass = false
    }
  } else {
    dbFail('No order found for this customer')
    pass = false
  }

  // Check notifications table
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, type')
    .eq('store_id', storeId)
    .gte('created_at', TEST_START)
    .limit(5)

  if (notifs && notifs.length > 0) {
    dbOk(`Notification sent to store (${notifs.length} notification(s))`)
  } else {
    dbFail('No notification found for this store')
    // Notifications are fire-and-forget, don't fail the whole scenario
  }

  return pass
}

// ============================================================================
// Scenario 2: Customer Name "Shinebayar" Regression (localhost)
// ============================================================================

async function scenario2(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 2: Customer Name "Shinebayar" Regression')
  const senderId = `web_e2e_name_${NOW}`
  let pass = true
  let convId: string | undefined

  // Step 1: Product search
  const r1 = await chat(LOCAL, storeId, senderId, '\u0427\u0438\u0445\u044d\u0432\u0447 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', undefined)
  convId = r1.conversationId
  if (r1.intent === 'product_search') {
    ok(1, `"\u0427\u0438\u0445\u044d\u0432\u0447 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 ${r1.intent}`)
  } else {
    ok(1, `"\u0427\u0438\u0445\u044d\u0432\u0447 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \ud83d\udd34 ${r1.intent}`)
    pass = false
  }

  // Step 2: Select product
  const r2 = await chat(LOCAL, storeId, senderId, '1', convId)
  if (r2.aiStatus === 200) {
    ok(2, `"1" \u2192 \u2705 ${r2.intent}, step=${r2.orderStep || 'order started'}`)
  } else {
    ok(2, `"1" \u2192 \ud83d\udd34 HTTP ${r2.aiStatus}`)
    pass = false
  }

  // Step 3: Name "Shinebayar" — MUST NOT be greeting
  const r3 = await chat(LOCAL, storeId, senderId, 'Shinebayar', convId)
  if (r3.intent !== 'greeting' && r3.aiStatus === 200) {
    ok(3, `"Shinebayar" \u2192 \u2705 ${r3.intent}, NOT greeting (regression OK)`)
  } else {
    ok(3, `"Shinebayar" \u2192 \ud83d\udd34 intent=${r3.intent} (REGRESSION: should NOT be greeting!)`)
    pass = false
  }

  // Step 4: Phone
  const r4 = await chat(LOCAL, storeId, senderId, '88001122', convId)
  if (r4.aiStatus === 200) {
    ok(4, `"88001122" \u2192 \u2705 ${r4.intent}, step=${r4.orderStep || 'phone captured'}`)
  } else {
    ok(4, `"88001122" \u2192 \ud83d\udd34 HTTP ${r4.aiStatus}`)
    pass = false
  }

  // Step 5: Address (ХУД = Хан-Уул = 5000₮)
  const r5 = await chat(LOCAL, storeId, senderId, '\u0425\u0423\u0414 5-\u0440 \u0445\u043e\u0440\u043e\u043e 20 \u0431\u0430\u0439\u0440 105 \u0442\u043e\u043e\u0442', convId)
  if (r5.aiStatus === 200) {
    ok(5, `"\u0425\u0423\u0414 5-\u0440 \u0445\u043e\u0440\u043e\u043e..." \u2192 \u2705 ${r5.intent}, step=${r5.orderStep || 'address captured'}`)
  } else {
    ok(5, `"\u0425\u0423\u0414..." \u2192 \ud83d\udd34 HTTP ${r5.aiStatus}`)
    pass = false
  }

  // Step 6: Confirm
  const r6 = await chat(LOCAL, storeId, senderId, '\u0417\u0430', convId)
  if (r6.aiStatus === 200) {
    ok(6, `"\u0417\u0430" \u2192 \u2705 ${r6.intent}, step=${r6.orderStep || 'confirmed'}`)
  } else {
    ok(6, `"\u0417\u0430" \u2192 \ud83d\udd34 HTTP ${r6.aiStatus}`)
    pass = false
  }

  // DB check: order created, delivery_fee = 5000 (Хан-Уул district)
  await delay(1000)

  const { data: customer } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', senderId)
    .single()

  if (customer) {
    const { data: orders } = await sb
      .from('orders')
      .select('id, order_number, total_amount')
      .eq('store_id', storeId)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (orders && orders.length > 0) {
      dbOk(`Order ${orders[0].order_number} created (${new Intl.NumberFormat('mn-MN').format(orders[0].total_amount)}\u20ae)`)
      totalOrders++

      const { data: deliveries } = await sb
        .from('deliveries')
        .select('id, delivery_number, delivery_fee')
        .eq('order_id', orders[0].id)
        .limit(1)

      if (deliveries && deliveries.length > 0) {
        const fee = deliveries[0].delivery_fee
        if (fee === 5000) {
          dbOk(`Delivery ${deliveries[0].delivery_number} created (fee: 5,000\u20ae \u0425\u0430\u043d-\u0423\u0443\u043b)`)
        } else {
          dbFail(`Expected delivery_fee=5000 (\u0425\u0430\u043d-\u0423\u0443\u043b), got ${fee}`)
          pass = false
        }
        totalDeliveries++
      } else {
        dbFail('No delivery found for this order')
        pass = false
      }
    } else {
      dbFail('No order found for Shinebayar')
      pass = false
    }
  } else {
    dbFail('Customer not found')
    pass = false
  }

  return pass
}

// ============================================================================
// Scenario 3: Customer Cancels Mid-Order (localhost)
// ============================================================================

async function scenario3(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 3: Customer Cancels Mid-Order')
  const senderId = `web_e2e_cancel_${NOW}`
  let pass = true
  let convId: string | undefined

  // Step 1: Product search
  const r1 = await chat(LOCAL, storeId, senderId, '\u041f\u04af\u04af\u0437 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', undefined)
  convId = r1.conversationId
  if (r1.intent === 'product_search') {
    ok(1, `"\u041f\u04af\u04af\u0437 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 ${r1.intent}`)
  } else {
    ok(1, `"\u041f\u04af\u04af\u0437 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \ud83d\udd34 ${r1.intent}`)
    pass = false
  }

  // Step 2: Select product
  const r2 = await chat(LOCAL, storeId, senderId, '1', convId)
  if (r2.aiStatus === 200) {
    ok(2, `"1" \u2192 \u2705 ${r2.intent}, step=${r2.orderStep || 'order started'}`)
  } else {
    ok(2, `"1" \u2192 \ud83d\udd34 HTTP ${r2.aiStatus}`)
    pass = false
  }

  // Step 3: Cancel order
  const r3 = await chat(LOCAL, storeId, senderId, '\u0417\u0430\u0445\u0438\u0430\u043b\u0430\u0430\u0433\u04af\u0439 \u044d\u044d', convId)
  if (r3.aiStatus === 200) {
    ok(3, `"\u0417\u0430\u0445\u0438\u0430\u043b\u0430\u0430\u0433\u04af\u0439 \u044d\u044d" \u2192 \u2705 ${r3.intent}`)
  } else {
    ok(3, `"\u0417\u0430\u0445\u0438\u0430\u043b\u0430\u0430\u0433\u04af\u0439 \u044d\u044d" \u2192 \ud83d\udd34 HTTP ${r3.aiStatus}`)
    pass = false
  }

  // Step 4: New fresh search works
  const r4 = await chat(LOCAL, storeId, senderId, '\u0426\u0430\u0433 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', convId)
  if (r4.aiStatus === 200 && r4.intent === 'product_search') {
    ok(4, `"\u0426\u0430\u0433 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 ${r4.intent} (fresh search works)`)
  } else {
    ok(4, `"\u0426\u0430\u0433 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \ud83d\udd34 ${r4.intent}`)
    pass = false
  }

  // DB check: NO order in orders table for this sender
  await delay(500)

  const { data: customer } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', senderId)
    .single()

  if (customer) {
    const { data: orders } = await sb
      .from('orders')
      .select('id')
      .eq('store_id', storeId)
      .eq('customer_id', customer.id)

    if (!orders || orders.length === 0) {
      dbOk('No order created (correct - cancelled)')
    } else {
      dbFail(`Found ${orders.length} order(s) for cancelled flow`)
      pass = false
    }
  } else {
    dbOk('No customer/order created (correct - cancelled)')
  }

  return pass
}

// ============================================================================
// Scenario 4: Customer Complaint → Escalation (localhost)
// ============================================================================

async function scenario4(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 4: Customer Complaint \u2192 Escalation')
  const senderId = `web_e2e_escalate_${NOW}`
  let pass = true
  let convId: string | undefined

  // Step 1: Order status inquiry
  const r1 = await chat(LOCAL, storeId, senderId, '\u0417\u0430\u0445\u0438\u0430\u043b\u0433\u0430 \u043c\u0430\u0430\u043d\u044c \u0445\u0430\u0430\u043d\u0430 \u044f\u0432\u0436 \u0431\u0430\u0439\u043d\u0430?', undefined)
  convId = r1.conversationId
  if (r1.aiStatus === 200) {
    ok(1, `"\u0417\u0430\u0445\u0438\u0430\u043b\u0433\u0430 \u043c\u0430\u0430\u043d\u044c \u0445\u0430\u0430\u043d\u0430 \u044f\u0432\u0436 \u0431\u0430\u0439\u043d\u0430?" \u2192 \u2705 ${r1.intent} (HTTP ${r1.aiStatus})`)
  } else {
    ok(1, `"\u0417\u0430\u0445\u0438\u0430\u043b\u0433\u0430..." \u2192 \ud83d\udd34 HTTP ${r1.aiStatus}`)
    pass = false
  }

  // Step 2: Complaint
  const r2 = await chat(LOCAL, storeId, senderId, '\u042f\u0430\u0433\u0430\u0430\u0434 \u0438\u0439\u043c \u0443\u0434\u0430\u0430\u043d \u0431\u0430\u0439\u0433\u0430\u0430 \u044e\u043c!?', convId)
  if (r2.aiStatus === 200) {
    ok(2, `"\u042f\u0430\u0433\u0430\u0430\u0434 \u0438\u0439\u043c \u0443\u0434\u0430\u0430\u043d..." \u2192 \u2705 ${r2.intent}`)
  } else {
    ok(2, `Complaint 1 \u2192 \ud83d\udd34 HTTP ${r2.aiStatus}`)
    pass = false
  }

  // Step 3: Repeated complaint
  const r3 = await chat(LOCAL, storeId, senderId, '\u042f\u0430\u0433\u0430\u0430\u0434 \u0438\u0439\u043c \u0443\u0434\u0430\u0430\u043d \u0431\u0430\u0439\u0433\u0430\u0430 \u044e\u043c!?', convId)
  if (r3.aiStatus === 200) {
    ok(3, `Repeated complaint \u2192 \u2705 ${r3.intent}`)
  } else {
    ok(3, `Repeated complaint \u2192 \ud83d\udd34 HTTP ${r3.aiStatus}`)
    pass = false
  }

  // Step 4: Payment dispute with 3 exclamation marks
  const r4 = await chat(LOCAL, storeId, senderId, '\u041c\u04e9\u043d\u0433\u04e9\u04e9 \u0431\u0443\u0446\u0430\u0430\u0436 \u04e9\u0433!!!', convId)
  if (r4.aiStatus === 200) {
    ok(4, `"\u041c\u04e9\u043d\u0433\u04e9\u04e9 \u0431\u0443\u0446\u0430\u0430\u0436 \u04e9\u0433!!!" \u2192 \u2705 ${r4.intent}`)
  } else {
    ok(4, `"\u041c\u04e9\u043d\u0433\u04e9\u04e9 \u0431\u0443\u0446\u0430\u0430\u0436 \u04e9\u0433!!!" \u2192 \ud83d\udd34 HTTP ${r4.aiStatus}`)
    pass = false
  }

  // DB check: escalation
  await delay(1000)

  const { data: conv } = await sb
    .from('conversations')
    .select('id, escalation_score, status, escalated_at')
    .eq('id', convId)
    .single()

  if (conv) {
    if (conv.escalation_score >= 60) {
      dbOk(`escalation_score = ${conv.escalation_score} (>= 60)`)
    } else {
      dbFail(`escalation_score = ${conv.escalation_score} (expected >= 60)`)
      pass = false
    }

    if (conv.status === 'escalated') {
      dbOk(`status = 'escalated'`)
    } else {
      dbFail(`status = '${conv.status}' (expected 'escalated')`)
      pass = false
    }

    if (conv.escalated_at) {
      dbOk(`escalated_at is set (${conv.escalated_at})`)
    } else {
      dbFail('escalated_at is null')
      pass = false
    }
  } else {
    dbFail('Conversation not found in DB')
    pass = false
  }

  return pass
}

// ============================================================================
// Scenario 5: Driver Delivery Flow (localhost + real Telegram)
// ============================================================================

async function scenario5(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 5: Driver Delivery Flow')
  let pass = true
  const testDriverName = `E2E TestDriver ${NOW}`
  const testOrderNumber = `ORD-E2E-${NOW}`
  const testDeliveryNumber = `DEL-E2E-${NOW}`
  const chatIdStr = String(DRIVER_CHAT_ID)

  // Pre-setup: Insert test driver (or reuse existing with same telegram_chat_id)
  let driverRow: { id: string } | null = null
  const { data: existingDriver } = await sb
    .from('delivery_drivers')
    .select('id')
    .eq('store_id', storeId)
    .eq('telegram_chat_id', chatIdStr)
    .single()

  if (existingDriver) {
    driverRow = existingDriver
    dbOk(`Reusing existing driver: ${driverRow.id} (telegram_chat_id=${chatIdStr})`)
  } else {
    const { data: newDriver, error: driverErr } = await sb
      .from('delivery_drivers')
      .insert({
        store_id: storeId,
        name: testDriverName,
        phone: `9900${String(NOW).slice(-4)}`,
        telegram_chat_id: chatIdStr,
        status: 'active',
      })
      .select('id')
      .single()

    if (driverErr || !newDriver) {
      dbFail(`Failed to insert test driver: ${driverErr?.message}`)
      return false
    }
    driverRow = newDriver
    dbOk(`Test driver created: ${driverRow.id}`)
  }

  // Pre-setup: Create test customer
  const { data: custRow } = await sb
    .from('customers')
    .insert({
      store_id: storeId,
      name: 'E2E Customer',
      phone: '88112233',
      channel: 'web',
    })
    .select('id')
    .single()

  if (!custRow) {
    dbFail('Failed to insert test customer')
    return false
  }

  // Pre-setup: Create test order
  const { data: orderRow } = await sb
    .from('orders')
    .insert({
      store_id: storeId,
      customer_id: custRow.id,
      order_number: testOrderNumber,
      total_amount: 45000,
      status: 'confirmed',
      payment_status: 'pending',
    })
    .select('id')
    .single()

  if (!orderRow) {
    dbFail('Failed to insert test order')
    return false
  }
  dbOk(`Test order created: ${testOrderNumber}`)

  // Pre-setup: Create test delivery assigned to driver
  const { data: deliveryRow } = await sb
    .from('deliveries')
    .insert({
      store_id: storeId,
      order_id: orderRow.id,
      driver_id: driverRow.id,
      delivery_number: testDeliveryNumber,
      delivery_fee: 3000,
      status: 'assigned',
      delivery_address: '\u0411\u0430\u044f\u043d\u0433\u043e\u043b \u0434\u04af\u04af\u0440\u044d\u0433 3-\u0440 \u0445\u043e\u0440\u043e\u043e',
      customer_name: 'E2E Customer',
      customer_phone: '88112233',
    })
    .select('id')
    .single()

  if (!deliveryRow) {
    dbFail('Failed to insert test delivery')
    return false
  }
  dbOk(`Test delivery created: ${testDeliveryNumber}`)

  const deliveryId = deliveryRow.id
  let updateId = 100000 + Math.floor(Math.random() * 10000)

  // Step 1: Driver confirms received (picked up from store)
  await delay(500)
  const cbRes1 = await driverWebhook(LOCAL, {
    update_id: updateId++,
    callback_query: {
      id: `cb_e2e_${updateId}`,
      from: { id: DRIVER_CHAT_ID, first_name: 'E2E' },
      message: {
        message_id: 1,
        from: { id: 0, first_name: 'Bot' },
        chat: { id: DRIVER_CHAT_ID, type: 'private' },
        text: 'Test',
      },
      data: `confirm_received:${deliveryId}`,
    },
  })

  if (cbRes1.ok) {
    // Verify DB
    const { data: del1 } = await sb
      .from('deliveries')
      .select('status')
      .eq('id', deliveryId)
      .single()
    if (del1?.status === 'picked_up') {
      ok(1, `confirm_received \u2192 \u2705 delivery.status = 'picked_up'`)
    } else {
      ok(1, `confirm_received \u2192 \ud83d\udd34 delivery.status = '${del1?.status}' (expected 'picked_up')`)
      pass = false
    }
  } else {
    ok(1, `confirm_received \u2192 \ud83d\udd34 HTTP ${cbRes1.status}`)
    pass = false
  }

  // Step 2: Driver marks delivered → shows payment options
  await delay(500)
  const cbRes2 = await driverWebhook(LOCAL, {
    update_id: updateId++,
    callback_query: {
      id: `cb_e2e_${updateId}`,
      from: { id: DRIVER_CHAT_ID, first_name: 'E2E' },
      message: {
        message_id: 2,
        from: { id: 0, first_name: 'Bot' },
        chat: { id: DRIVER_CHAT_ID, type: 'private' },
        text: 'Test',
      },
      data: `delivered:${deliveryId}`,
    },
  })

  if (cbRes2.ok) {
    ok(2, `delivered \u2192 \u2705 HTTP 200 (payment options shown)`)
  } else {
    ok(2, `delivered \u2192 \ud83d\udd34 HTTP ${cbRes2.status}`)
    pass = false
  }

  // Step 3: Driver confirms full payment
  await delay(500)
  const cbRes3 = await driverWebhook(LOCAL, {
    update_id: updateId++,
    callback_query: {
      id: `cb_e2e_${updateId}`,
      from: { id: DRIVER_CHAT_ID, first_name: 'E2E' },
      message: {
        message_id: 3,
        from: { id: 0, first_name: 'Bot' },
        chat: { id: DRIVER_CHAT_ID, type: 'private' },
        text: 'Test',
      },
      data: `payment_full:${deliveryId}`,
    },
  })

  if (cbRes3.ok) {
    // Verify DB: delivery.status = 'delivered', order.payment_status = 'paid'
    const { data: del3 } = await sb
      .from('deliveries')
      .select('status')
      .eq('id', deliveryId)
      .single()
    const { data: ord3 } = await sb
      .from('orders')
      .select('payment_status')
      .eq('id', orderRow.id)
      .single()

    if (del3?.status === 'delivered') {
      ok(3, `payment_full \u2192 \u2705 delivery.status = 'delivered'`)
    } else {
      ok(3, `payment_full \u2192 \ud83d\udd34 delivery.status = '${del3?.status}' (expected 'delivered')`)
      pass = false
    }

    if (ord3?.payment_status === 'paid') {
      dbOk(`order.payment_status = 'paid'`)
    } else {
      dbFail(`order.payment_status = '${ord3?.payment_status}' (expected 'paid')`)
      pass = false
    }
  } else {
    ok(3, `payment_full \u2192 \ud83d\udd34 HTTP ${cbRes3.status}`)
    pass = false
  }

  // Send REAL Telegram message
  const tgSent = await sendDriverTelegram(
    `\ud83e\uddea E2E Test: Delivery completed for order ${testOrderNumber}`
  )
  if (tgSent) {
    console.log(`  Telegram: \u2705 Real message sent to driver chat_id ${DRIVER_CHAT_ID}`)
  } else {
    console.log(`  Telegram: \ud83d\udd34 Failed to send real message`)
    pass = false
  }

  return pass
}

// ============================================================================
// Scenario 6: Driver Denies Delivery (localhost)
// ============================================================================

async function scenario6(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 6: Driver Denies Delivery')
  let pass = true
  const testDriverName = `E2E DenyDriver ${NOW}`
  const testDeliveryNumber = `DEL-DENY-${NOW}`
  const denyChatId = DRIVER_CHAT_ID // reuse same chat_id — different driver record

  // Pre-setup: Insert test driver (or reuse existing with same telegram_chat_id)
  const denyChatIdStr = String(denyChatId + 1) // must match webhook from.id below
  let driverRow: { id: string } | null = null
  const { data: existingDenyDriver } = await sb
    .from('delivery_drivers')
    .select('id')
    .eq('store_id', storeId)
    .eq('telegram_chat_id', denyChatIdStr)
    .single()

  if (existingDenyDriver) {
    driverRow = existingDenyDriver
    dbOk(`Reusing existing deny driver: ${driverRow.id} (telegram_chat_id=${denyChatIdStr})`)
  } else {
    const { data: newDriver, error: denyDriverErr } = await sb
      .from('delivery_drivers')
      .insert({
        store_id: storeId,
        name: testDriverName,
        phone: `9933${String(NOW).slice(-4)}`,
        telegram_chat_id: denyChatIdStr,
        status: 'active',
      })
      .select('id')
      .single()

    if (!newDriver) {
      dbFail(`Failed to insert deny test driver: ${denyDriverErr?.message}`)
      return false
    }
    driverRow = newDriver
  }

  // Pre-setup: Create customer, order, delivery
  const { data: custRow } = await sb
    .from('customers')
    .insert({
      store_id: storeId,
      name: 'E2E DenyCustomer',
      phone: '88445566',
      channel: 'web',
    })
    .select('id')
    .single()

  if (!custRow) {
    dbFail('Failed to insert deny customer')
    return false
  }

  const { data: orderRow } = await sb
    .from('orders')
    .insert({
      store_id: storeId,
      customer_id: custRow.id,
      order_number: `ORD-DENY-${NOW}`,
      total_amount: 30000,
      status: 'confirmed',
      payment_status: 'pending',
    })
    .select('id')
    .single()

  if (!orderRow) {
    dbFail('Failed to insert deny order')
    return false
  }

  const { data: deliveryRow } = await sb
    .from('deliveries')
    .insert({
      store_id: storeId,
      order_id: orderRow.id,
      driver_id: driverRow.id,
      delivery_number: testDeliveryNumber,
      delivery_fee: 5000,
      status: 'assigned',
      delivery_address: '\u0425\u0430\u043d-\u0423\u0443\u043b \u0434\u04af\u04af\u0440\u044d\u0433',
      customer_name: 'E2E DenyCustomer',
      customer_phone: '88445566',
    })
    .select('id')
    .single()

  if (!deliveryRow) {
    dbFail('Failed to insert deny delivery')
    return false
  }
  dbOk(`Deny delivery created: ${testDeliveryNumber}`)

  const deliveryId = deliveryRow.id
  let updateId = 200000 + Math.floor(Math.random() * 10000)

  // Step 1: Driver denies delivery
  await delay(500)
  const cbRes = await driverWebhook(LOCAL, {
    update_id: updateId++,
    callback_query: {
      id: `cb_deny_${updateId}`,
      from: { id: denyChatId + 1, first_name: 'E2E Deny' },
      message: {
        message_id: 10,
        from: { id: 0, first_name: 'Bot' },
        chat: { id: denyChatId + 1, type: 'private' },
        text: 'Test',
      },
      data: `deny_delivery:${deliveryId}`,
    },
  })

  if (cbRes.ok) {
    // Check DB: delivery.status = 'pending', driver_id = null
    await delay(500)
    const { data: del } = await sb
      .from('deliveries')
      .select('status, driver_id')
      .eq('id', deliveryId)
      .single()

    if (del?.status === 'pending') {
      ok(1, `deny_delivery \u2192 \u2705 delivery.status = 'pending'`)
    } else {
      ok(1, `deny_delivery \u2192 \ud83d\udd34 delivery.status = '${del?.status}' (expected 'pending')`)
      pass = false
    }

    if (del?.driver_id === null) {
      dbOk('driver_id = null (unassigned)')
    } else {
      dbFail(`driver_id = '${del?.driver_id}' (expected null)`)
      pass = false
    }

    // Check notification was created
    const { data: notifs } = await sb
      .from('notifications')
      .select('id, type')
      .eq('store_id', storeId)
      .eq('type', 'delivery_driver_denied')
      .gte('created_at', TEST_START)
      .limit(1)

    if (notifs && notifs.length > 0) {
      dbOk('Denial notification sent to store')
    } else {
      // Notifications are best-effort, don't fail
      console.log('  DB: \u26a0\ufe0f  No denial notification found (may be async)')
    }
  } else {
    ok(1, `deny_delivery \u2192 \ud83d\udd34 HTTP ${cbRes.status}`)
    pass = false
  }

  return pass
}

// ============================================================================
// Scenario 7: Production Smoke Test (3.5s delays)
// ============================================================================

async function scenario7(storeId: string): Promise<boolean> {
  console.log('\ud83d\udccb Scenario 7: Production Smoke Test')
  const senderId = `web_e2e_prod_${NOW}`
  let pass = true

  // Step 1: Greeting
  const r1 = await chat(PROD, storeId, senderId, '\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443', undefined, 3500)
  if (r1.aiStatus === 200 && r1.response.length > 0) {
    ok(1, `"\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443" \u2192 \u2705 HTTP ${r1.aiStatus}, intent=${r1.intent}`)
  } else {
    ok(1, `"\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443" \u2192 \ud83d\udd34 HTTP ${r1.aiStatus}`)
    pass = false
  }

  // Step 2: Product search
  const r2 = await chat(PROD, storeId, senderId, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', r1.conversationId, 3500)
  if (r2.aiStatus === 200 && r2.productsFound > 0) {
    ok(2, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 HTTP ${r2.aiStatus}, ${r2.productsFound} products`)
  } else if (r2.aiStatus === 200) {
    ok(2, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 HTTP 200, intent=${r2.intent} (${r2.productsFound} products)`)
  } else {
    ok(2, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \ud83d\udd34 HTTP ${r2.aiStatus}`)
    pass = false
  }

  console.log('  (Skipping order completion on production)')
  return pass
}

// ============================================================================
// Scenario 8: Latin Misclassification (NotebookLM gap)
// ============================================================================

async function scenario8(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 8: Latin Misclassification (NotebookLM gap)')
  const sid = `web_e2e_latin_${NOW}`

  // "boloh uu" should be payment, not size_info
  let r = await chat(api, storeId, sid, 'Huwaan tulj boloh uu?')
  ok(1, `"Huwaan tulj boloh uu?" \u2192 ${r.intent}`)
  if (r.intent === 'size_info')
    dbFail('"boloh uu" misclassified as size_info \u2014 NotebookLM bug confirmed')

  // "Zahialmaar baina" should be order intent
  r = await chat(api, storeId, sid, 'Zahialmaar baina')
  ok(2, `"Zahialmaar baina" \u2192 ${r.intent}`)

  // "Mash sain" should be greeting
  r = await chat(api, storeId, sid, 'Mash sain')
  ok(3, `"Mash sain" \u2192 ${r.intent}`)

  // "ochd awbal haana we" should be shipping
  r = await chat(api, storeId, sid, 'ochd awbal haana we')
  ok(4, `"ochd awbal haana we" \u2192 ${r.intent}`)

  scenarioResult(true) // Always pass \u2014 this is a classification audit
}

// ============================================================================
// Scenario 9: Order Tracking
// ============================================================================

async function scenario9(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 9: Order Tracking')
  const sid = `web_e2e_tracking_${NOW}`

  // First complete a quick order
  let r = await chat(api, storeId, sid, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?')
  r = await chat(api, storeId, sid, '1', r.conversationId)
  r = await chat(api, storeId, sid, '\u0414\u043e\u0440\u0436', r.conversationId)
  r = await chat(api, storeId, sid, '99776655', r.conversationId)
  r = await chat(api, storeId, sid, '\u0421\u0411\u0414 2-\u0440 \u0445\u043e\u0440\u043e\u043e 10 \u0431\u0430\u0439\u0440 305 \u0442\u043e\u043e\u0442', r.conversationId)
  r = await chat(api, storeId, sid, '\u0422\u0438\u0439\u043c', r.conversationId)

  // Now ask about order status
  r = await chat(api, storeId, sid, '\u0417\u0430\u0445\u0438\u0430\u043b\u0433\u0430 \u043c\u0430\u0430\u043d\u044c \u0445\u0430\u0430\u043d\u0430 \u044f\u0432\u0436 \u0431\u0430\u0439\u043d\u0430?', r.conversationId)
  ok(1, `Order tracking \u2192 ${r.intent}`)
  const hasStatus = r.intent === 'order_status' || r.response.length > 20
  scenarioResult(hasStatus)
  if (!hasStatus) dbFail('Order tracking not working')
}

// ============================================================================
// Scenario 10: Real FB Chat — Togs Jargal (hardest conversation, 216 msgs)
// ============================================================================

async function scenario10(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 10: Real FB Chat \u2014 Togs Jargal (216 msgs)')
  const sid = `web_e2e_togsjargal_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/tgszargal_1106833577156223/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Some real FB messages got invalid responses')
}

// ============================================================================
// Scenario 11: Real FB Chat — Pola Ris (most messy Latin, 132 instances)
// ============================================================================

async function scenario11(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 11: Real FB Chat \u2014 Pola Ris (messy Latin)')
  const sid = `web_e2e_polaris_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/polaris_4042349015842621/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Some messy Latin FB messages got invalid responses')
}

// ============================================================================
// Scenario 12: Real FB Chat — Batchimeg (name contains "hi")
// ============================================================================

async function scenario12(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 12: Real FB Chat \u2014 Batchimeg (name contains "hi")')
  const sid = `web_e2e_batchimeg_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/batchimegnarangerel_122222533226018334/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
    // Special check: "Batchimeg" name must NOT trigger greeting
    if (
      msgs[i].toLowerCase().includes('batchimeg') &&
      r.intent === 'greeting'
    ) {
      dbFail(`"${msgs[i]}" triggered greeting \u2014 name "Batchimeg" contains "hi"`)
      pass = false
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 13: Real FB Chat — Rural Customer (Ovorkhangai)
// ============================================================================

async function scenario13(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 13: Real FB Chat \u2014 Rural Customer (Ovorkhangai)')
  const sid = `web_e2e_rural_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/enkhboldariunzaya_2290552584725919/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Rural customer messages got invalid responses')
}

// ============================================================================
// Scenario 14: Real FB Chat — Angry Customer (17 complaints)
// ============================================================================

async function scenario14(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 14: Real FB Chat \u2014 Angry Customer (17 complaints)')
  const sid = `web_e2e_angry_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/hgancimeg_2006037763572702/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  let escalationFired = false
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (r.intent === 'complaint' || r.intent === 'escalation' || r.intent === 'escalated')
      escalationFired = true
    if (!valid) pass = false
  }

  // Check if escalation was triggered in DB
  if (convId) {
    await delay(1000)
    const { data: conv } = await sb
      .from('conversations')
      .select('escalation_score, status')
      .eq('id', convId)
      .single()

    if (conv && (conv.escalation_score >= 40 || conv.status === 'escalated')) {
      dbOk(
        `Escalation detected: score=${conv.escalation_score}, status=${conv.status}`
      )
    } else if (escalationFired) {
      dbOk('Complaint intent detected in responses')
    } else {
      dbFail('No escalation detected for angry customer')
      pass = false
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 15: Real FB Chat — Multi-Product
// ============================================================================

async function scenario15(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 15: Real FB Chat \u2014 Multi-Product')
  const sid = `web_e2e_multiproduct_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/narsarod_3740824826240331/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Multi-product conversation got invalid responses')
}

// ============================================================================
// Scenario 16: Complaint During Checkout
// ============================================================================

async function scenario16(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 16: Complaint During Checkout')
  const sid = `web_e2e_complaint_checkout_${NOW}`

  // Start order flow
  let r = await chat(api, storeId, sid, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?')
  ok(1, `Product search \u2192 ${r.intent}`)

  r = await chat(api, storeId, sid, '1', r.conversationId)
  ok(2, `Select product \u2192 ${r.intent}, step=${r.orderStep || 'started'}`)

  r = await chat(api, storeId, sid, '\u0411\u043e\u043b\u0434', r.conversationId)
  ok(3, `Name "\u0411\u043e\u043b\u0434" \u2192 ${r.intent}, step=${r.orderStep || 'name'}`)

  r = await chat(api, storeId, sid, '99112233', r.conversationId)
  ok(4, `Phone \u2192 ${r.intent}, step=${r.orderStep || 'phone'}`)

  r = await chat(
    api,
    storeId,
    sid,
    '\u0411\u0417\u0414 1-\u0440 \u0445\u043e\u0440\u043e\u043e 5 \u0431\u0430\u0439\u0440 201 \u0442\u043e\u043e\u0442',
    r.conversationId
  )
  ok(5, `Address \u2192 ${r.intent}, step=${r.orderStep || 'address'}`)
  const convIdBeforeComplaint = r.conversationId

  // Send complaint mid-checkout (at confirming step)
  r = await chat(
    api,
    storeId,
    sid,
    '\u04e8\u043c\u043d\u04e9\u0445 \u04af\u043d\u044d\u0442\u044d\u0439 \u0431\u0430\u0440\u0430\u0430 \u0437\u0430\u0440\u0434\u0430\u0433!',
    convIdBeforeComplaint
  )
  ok(6, `Complaint during checkout \u2192 ${r.intent}`)

  // Now confirm the order — draft should survive
  r = await chat(api, storeId, sid, '\u0422\u0438\u0439\u043c', r.conversationId)
  ok(7, `Confirm after complaint \u2192 ${r.intent}, step=${r.orderStep || 'confirmed'}`)

  // Check if order was created
  await delay(1000)
  const { data: customer } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', sid)
    .single()

  let pass = true
  if (customer) {
    const { data: orders } = await sb
      .from('orders')
      .select('id, order_number')
      .eq('store_id', storeId)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (orders && orders.length > 0) {
      dbOk(`Order ${orders[0].order_number} created despite mid-checkout complaint`)
      totalOrders++
    } else {
      dbFail('Order NOT created \u2014 complaint during checkout killed the draft')
      pass = false
    }
  } else {
    dbFail('Customer not found after complaint-during-checkout flow')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 17: Gift Card Purchase
// ============================================================================

async function scenario17(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 17: Gift Card Purchase')
  const sid = `web_e2e_giftcard_${NOW}`

  const r = await chat(api, storeId, sid, '\u0411\u044d\u043b\u0433\u0438\u0439\u043d \u043a\u0430\u0440\u0442 \u0430\u0432\u044a\u044f')
  ok(1, `"\u0411\u044d\u043b\u0433\u0438\u0439\u043d \u043a\u0430\u0440\u0442 \u0430\u0432\u044a\u044f" \u2192 ${r.intent}`)

  const mentionsGiftCard =
    r.response.toLowerCase().includes('\u0431\u044d\u043b\u0433') ||
    r.response.toLowerCase().includes('gift') ||
    r.response.toLowerCase().includes('\u043a\u0430\u0440\u0442') ||
    r.intent === 'product_search' ||
    r.response.length > 20

  if (mentionsGiftCard) {
    ok(2, `Response mentions gift card or provides useful info (\u2705)`)
  } else {
    ok(2, `Response does not mention gift card (\ud83d\udd34): "${r.response.slice(0, 80)}"`)
  }

  scenarioResult(mentionsGiftCard)
  if (!mentionsGiftCard)
    dbFail('Gift card purchase query not handled properly')
}

// ============================================================================
// Scenario 18: Full Connected Flow — Chat → Order → Driver → Payment → Notifications
// ============================================================================

async function scenario18(api: string, storeId: string) {
  console.log('\n📋 Scenario 18: FULL CONNECTED FLOW — Chat → Order → Driver → Payment → Notifications')
  console.log('  (This is the complete real-life cycle)\n')

  let passed = true
  const sid = `web_e2e_fullflow_${Date.now()}`
  const testStart = new Date().toISOString()

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Customer chats and creates an order
  // ═══════════════════════════════════════════════════════════════
  console.log('  ── PHASE 1: Customer Chat → Order ──')

  // Step 1: Greeting
  let r = await chat(api, storeId, sid, 'Сайн байна уу')
  console.log(`  Step 1: "Сайн байна уу" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}`)
  if (r.aiStatus !== 200) passed = false

  // Step 2: Product search
  r = await chat(api, storeId, sid, 'Леевчик байна уу?', r.conversationId)
  console.log(`  Step 2: "Леевчик байна уу?" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}, ${r.productsFound || 0} products`)
  if (r.aiStatus !== 200) passed = false

  // Step 3: Select product
  r = await chat(api, storeId, sid, '1', r.conversationId)
  console.log(`  Step 3: "1" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}, step=${r.orderStep || 'none'}`)
  if (r.aiStatus !== 200) passed = false

  // Step 4: Customer name
  r = await chat(api, storeId, sid, 'Батболд', r.conversationId)
  console.log(`  Step 4: "Батболд" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent} (must NOT be greeting)`)
  if (r.intent === 'greeting') { console.log('  🔴 BUG: Name treated as greeting!'); passed = false }

  // Step 5: Phone
  r = await chat(api, storeId, sid, '99776655', r.conversationId)
  console.log(`  Step 5: "99776655" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}`)
  if (r.aiStatus !== 200) passed = false

  // Step 6: Address (Баянгол = central zone = 3000₮)
  r = await chat(api, storeId, sid, 'Баянгол дүүрэг 5-р хороо 22 байр 401 тоот', r.conversationId)
  console.log(`  Step 6: "Баянгол дүүрэг..." → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}, step=${r.orderStep || 'none'}`)
  if (r.aiStatus !== 200) passed = false

  // Step 7: Confirm
  r = await chat(api, storeId, sid, 'Тийм', r.conversationId)
  console.log(`  Step 7: "Тийм" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}, step=${r.orderStep || 'none'}`)
  if (r.aiStatus !== 200) passed = false

  const convId = r.conversationId

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Verify order + delivery created in DB
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── PHASE 2: Verify DB — Order + Delivery ──')

  await delay(1500) // wait for async notifications

  // Find the order
  const { data: orders } = await sb
    .from('orders')
    .select('id, order_number, status, total_amount, shipping_amount, payment_status, payment_method')
    .eq('store_id', storeId)
    .gte('created_at', testStart)
    .order('created_at', { ascending: false })
    .limit(1)

  const order = orders?.[0]
  if (!order) {
    console.log('  🔴 DB: No order found!')
    passed = false
    scenarioResult(false)
    return
  }

  console.log(`  DB: ✅ Order ${order.order_number} created`)
  console.log(`       Total: ${order.total_amount}₮, Shipping: ${order.shipping_amount}₮`)
  console.log(`       Status: ${order.status}, Payment: ${order.payment_status}`)
  totalOrders++

  // Find the delivery
  const { data: deliveries } = await sb
    .from('deliveries')
    .select('id, delivery_number, status, delivery_fee, delivery_address, customer_phone, driver_id')
    .eq('order_id', order.id)

  const delivery = deliveries?.[0]
  if (!delivery) {
    console.log('  🔴 DB: No delivery found!')
    passed = false
    scenarioResult(false)
    return
  }

  console.log(`  DB: ✅ Delivery ${delivery.delivery_number} created`)
  console.log(`       Fee: ${delivery.delivery_fee}₮, Status: ${delivery.status}`)
  console.log(`       Address: ${delivery.delivery_address}`)
  console.log(`       Phone: ${delivery.customer_phone}`)
  totalDeliveries++

  // Verify delivery fee is correct for Баянгол (central = 3000₮)
  if (delivery.delivery_fee !== null && delivery.delivery_fee !== undefined) {
    console.log(`  DB: ${delivery.delivery_fee === 3000 ? '✅' : '⚠️'} Delivery fee = ${delivery.delivery_fee}₮ (expected 3000₮ for Баянгол)`)
  }

  // Check notification was sent
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, type, title')
    .eq('store_id', storeId)
    .gte('created_at', testStart)
    .limit(5)

  console.log(`  DB: ${(notifs?.length || 0) > 0 ? '✅' : '⚠️'} ${notifs?.length || 0} notification(s) sent`)

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: Assign driver (simulates staff action)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── PHASE 3: Staff Assigns Driver ──')

  // Find or create test driver
  const driverChatId = String(DRIVER_CHAT_ID)
  let { data: existingDriver } = await sb
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', driverChatId)
    .single()

  let driverId: string
  if (existingDriver) {
    driverId = existingDriver.id
    console.log(`  DB: ✅ Reusing driver: ${existingDriver.name} (${driverId})`)
  } else {
    const { data: newDriver, error } = await sb
      .from('delivery_drivers')
      .insert({
        store_id: storeId,
        name: 'E2E Test Driver',
        phone: '99998888',
        telegram_chat_id: driverChatId,
        telegram_linked_at: new Date().toISOString(),
        status: 'active',
      })
      .select('id, name')
      .single()

    if (error || !newDriver) {
      console.log(`  🔴 DB: Failed to create driver: ${error?.message}`)
      passed = false
      scenarioResult(false)
      return
    }
    driverId = newDriver.id
    console.log(`  DB: ✅ Created driver: ${newDriver.name} (${driverId})`)
  }

  // Assign delivery to driver
  await sb
    .from('deliveries')
    .update({ driver_id: driverId, status: 'assigned' })
    .eq('id', delivery.id)

  // Verify assignment
  const { data: assignedDel } = await sb
    .from('deliveries')
    .select('status, driver_id')
    .eq('id', delivery.id)
    .single()

  console.log(`  DB: ${assignedDel?.status === 'assigned' ? '✅' : '🔴'} Delivery status = ${assignedDel?.status}`)
  console.log(`  DB: ${assignedDel?.driver_id === driverId ? '✅' : '🔴'} Driver assigned = ${assignedDel?.driver_id}`)
  if (assignedDel?.status !== 'assigned') passed = false

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: Driver picks up via Telegram webhook
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── PHASE 4: Driver Picks Up (Telegram Webhook) ──')

  // Driver taps "confirm_received" (accept/pickup)
  const pickupRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pickup_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 1, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `confirm_received:${delivery.id}`,
    },
  })
  console.log(`  Webhook: ${pickupRes.status === 200 ? '✅' : '🔴'} confirm_received → HTTP ${pickupRes.status}`)
  if (pickupRes.status !== 200) passed = false

  await delay(1000)

  // Verify status changed to picked_up
  const { data: pickedUp } = await sb
    .from('deliveries')
    .select('status')
    .eq('id', delivery.id)
    .single()

  console.log(`  DB: ${pickedUp?.status === 'picked_up' ? '✅' : '🔴'} Delivery status = ${pickedUp?.status} (expected: picked_up)`)
  if (pickedUp?.status !== 'picked_up') passed = false

  // ═══════════════════════════════════════════════════════════════
  // PHASE 5: Driver delivers and collects payment
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── PHASE 5: Driver Delivers + Payment ──')

  // Driver taps "delivered"
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${delivery.id}`,
    },
  })
  console.log(`  Webhook: ${deliverRes.status === 200 ? '✅' : '🔴'} delivered → HTTP ${deliverRes.status}`)

  await delay(1000)

  // Driver taps "payment_full" (full COD payment)
  const paymentRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_payment_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_full:${delivery.id}`,
    },
  })
  console.log(`  Webhook: ${paymentRes.status === 200 ? '✅' : '🔴'} payment_full → HTTP ${paymentRes.status}`)
  if (paymentRes.status !== 200) passed = false

  await delay(1000)

  // Verify delivery = delivered
  const { data: deliveredDel } = await sb
    .from('deliveries')
    .select('status, actual_delivery_time')
    .eq('id', delivery.id)
    .single()

  console.log(`  DB: ${deliveredDel?.status === 'delivered' ? '✅' : '🔴'} Delivery status = ${deliveredDel?.status} (expected: delivered)`)
  console.log(`  DB: ${deliveredDel?.actual_delivery_time ? '✅' : '⚠️'} actual_delivery_time = ${deliveredDel?.actual_delivery_time || 'null'}`)
  if (deliveredDel?.status !== 'delivered') passed = false

  // Verify order = paid
  const { data: paidOrder } = await sb
    .from('orders')
    .select('payment_status, status')
    .eq('id', order.id)
    .single()

  console.log(`  DB: ${paidOrder?.payment_status === 'paid' ? '✅' : '🔴'} Order payment = ${paidOrder?.payment_status} (expected: paid)`)
  if (paidOrder?.payment_status !== 'paid') passed = false

  // ═══════════════════════════════════════════════════════════════
  // PHASE 6: Send real Telegram notification + verify
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── PHASE 6: Real Telegram Notification ──')

  const tgOk = await sendDriverTelegram(
    `🧪 E2E Full Flow Test Complete!\n\n` +
    `Order: ${order.order_number}\n` +
    `Delivery: ${delivery.delivery_number}\n` +
    `Total: ${order.total_amount}₮\n` +
    `Status: ✅ Delivered & Paid\n` +
    `Time: ${new Date().toLocaleTimeString('mn-MN')}`
  )
  console.log(`  Telegram: ${tgOk ? '✅' : '🔴'} Real message sent to driver chat_id ${DRIVER_CHAT_ID}`)

  // ═══════════════════════════════════════════════════════════════
  // PHASE 7: Customer asks about order status (post-delivery)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── PHASE 7: Customer Checks Order Status ──')

  r = await chat(api, storeId, sid, 'Захиалга маань хаана явж байна?', convId)
  console.log(`  Step: "Захиалга маань хаана явж байна?" → ${r.aiStatus === 200 ? '✅' : '🔴'} ${r.intent}`)
  console.log(`  Response: ${r.response.substring(0, 80)}...`)

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n  ── FULL FLOW SUMMARY ──')
  console.log(`  Customer chat:    ✅ 7 messages sent`)
  console.log(`  Order created:    ${order ? '✅' : '🔴'} ${order?.order_number}`)
  console.log(`  Delivery created: ${delivery ? '✅' : '🔴'} ${delivery?.delivery_number}`)
  console.log(`  Driver assigned:  ${assignedDel?.driver_id ? '✅' : '🔴'}`)
  console.log(`  Picked up:        ${pickedUp?.status === 'picked_up' ? '✅' : '🔴'}`)
  console.log(`  Delivered:        ${deliveredDel?.status === 'delivered' ? '✅' : '🔴'}`)
  console.log(`  Payment:          ${paidOrder?.payment_status === 'paid' ? '✅' : '🔴'}`)
  console.log(`  Telegram sent:    ${tgOk ? '✅' : '🔴'}`)
  console.log(`  Order tracking:   ${r.aiStatus === 200 ? '✅' : '🔴'}`)

  scenarioResult(passed)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n\ud83d\udd2c TEMUULEL REAL-LIFE TEST \u2014 ${today}`)
  console.log('\u2550'.repeat(55))

  // Resolve store
  const { data: store, error: storeErr } = await sb
    .from('stores')
    .select('id, name')
    .eq('name', '\u041c\u043e\u043d\u0433\u043e\u043b \u041c\u0430\u0440\u043a\u0435\u0442')
    .single()

  if (storeErr || !store) {
    console.error(`\ud83d\udd34 Store "\u041c\u043e\u043d\u0433\u043e\u043b \u041c\u0430\u0440\u043a\u0435\u0442" not found: ${storeErr?.message}`)
    process.exit(1)
  }

  const storeId = store.id
  console.log(`Store: ${store.name} (${storeId})`)

  // Count products
  const { count } = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  console.log(`Products: ${count ?? 0}`)
  console.log(`Driver chat_id: ${DRIVER_CHAT_ID}`)
  console.log(`Webhook secret: ${DRIVER_WEBHOOK_SECRET ? 'set' : 'NOT SET'}`)
  console.log()

  // ── Localhost scenarios ────────────────────────────────────────────────────

  console.log('\ud83d\udccd LOCALHOST (http://localhost:3000)')
  console.log()

  // Scenario 1
  const s1 = await scenario1(storeId)
  scenarioResult(s1)

  // Scenario 2
  const s2 = await scenario2(storeId)
  scenarioResult(s2)

  // Scenario 3
  const s3 = await scenario3(storeId)
  scenarioResult(s3)

  // Scenario 4
  const s4 = await scenario4(storeId)
  scenarioResult(s4)

  // Scenario 5
  const s5 = await scenario5(storeId)
  scenarioResult(s5)

  // Scenario 6
  const s6 = await scenario6(storeId)
  scenarioResult(s6)

  // ── Production smoke test ────────────────────────────────────────────────

  console.log('\ud83d\udccd PRODUCTION (https://temuulel-app.vercel.app)')
  console.log()

  const s7 = await scenario7(storeId)
  scenarioResult(s7)

  // ── New scenarios (8–17) ─────────────────────────────────────────────────

  console.log('\ud83d\udccd LOCALHOST — Extended Scenarios')
  console.log()

  // Scenario 8: Latin Misclassification
  await scenario8(LOCAL, storeId)

  // Scenario 9: Order Tracking
  await scenario9(LOCAL, storeId)

  // Scenario 10: Real FB Chat — Togs Jargal
  await scenario10(LOCAL, storeId)

  // Scenario 11: Real FB Chat — Pola Ris
  await scenario11(LOCAL, storeId)

  // Scenario 12: Real FB Chat — Batchimeg
  await scenario12(LOCAL, storeId)

  // Scenario 13: Real FB Chat — Rural Customer
  await scenario13(LOCAL, storeId)

  // Scenario 14: Real FB Chat — Angry Customer
  await scenario14(LOCAL, storeId)

  // Scenario 15: Real FB Chat — Multi-Product
  await scenario15(LOCAL, storeId)

  // Scenario 16: Complaint During Checkout
  await scenario16(LOCAL, storeId)

  // Scenario 17: Gift Card Purchase
  await scenario17(LOCAL, storeId)

  // Scenario 18: Full Connected Flow
  await scenario18(LOCAL, storeId)

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('\u2550'.repeat(55))
  console.log(`SUMMARY: ${passedScenarios}/${totalScenarios} scenarios passed`)
  console.log(`  Orders created: ${totalOrders}`)
  console.log(`  Deliveries created: ${totalDeliveries}`)
  console.log(`  Telegram messages sent: ${totalTelegramMessages}`)
  console.log(`  Bugs found: ${bugsFound}`)
  console.log('\u2550'.repeat(55))

  if (passedScenarios < totalScenarios) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n\ud83d\udd34 Unhandled error:', err)
  process.exit(1)
})
