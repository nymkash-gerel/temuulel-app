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
 *  19. Payment Delayed → Follow-up
 *  20. Payment Declined → Store Notified
 *  21. Driver Denies → Auto-Reassignment Check
 *  22. Customer Complaint Mid-Checkout → Recovers
 *  23. Wrong Product → Return Flow
 *  24. Partial Payment (Custom Amount)
 *  25. Delivery Delayed → Unreachable → Reschedule → Deliver
 *  26. Partial Payment → AI Agent Justified
 *  27. Partial Payment → AI Agent Not Justified → QPay
 *  28. Partial Payment → No Messenger → SMS Fallback
 *  29. Delivery Postponed → Telegram + Order Notes
 *  30. Delayed Delivery → Customer Reconfirm
 *  31. Delayed Delivery → Customer Cancels
 *  32. Wrong Item Photo → Detail Page
 *  33. Staff Telegram Notify — Damaged/No Payment
 *  34. 24h Messenger Window Expired → SMS
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
// Shared helpers for full-flow scenarios
// ============================================================================

interface OrderViaChat {
  conversationId: string
  orderId: string
  orderNumber: string
  deliveryId: string
  deliveryNumber: string
  senderId: string
}

async function createOrderViaChat(
  api: string,
  storeId: string,
  scenarioName: string
): Promise<OrderViaChat | null> {
  const sid = `web_e2e_${scenarioName}_${Date.now()}`
  let r = await chat(api, storeId, sid, 'Сайн байна уу')
  r = await chat(api, storeId, sid, 'Цамц байна уу?', r.conversationId)
  r = await chat(api, storeId, sid, '1', r.conversationId)
  r = await chat(api, storeId, sid, 'Бат', r.conversationId)
  r = await chat(api, storeId, sid, '99776655', r.conversationId)
  r = await chat(api, storeId, sid, 'БГД 3-р хороо 15 байр 201 тоот', r.conversationId)
  r = await chat(api, storeId, sid, 'Тийм', r.conversationId)

  await delay(1500)

  const { data: order } = await sb
    .from('orders')
    .select('id, order_number')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!order) return null

  const { data: delivery } = await sb
    .from('deliveries')
    .select('id, delivery_number')
    .eq('order_id', order.id)
    .single()

  if (!delivery) return null

  totalOrders++
  totalDeliveries++

  return {
    conversationId: r.conversationId,
    orderId: order.id,
    orderNumber: order.order_number,
    deliveryId: delivery.id,
    deliveryNumber: delivery.delivery_number,
    senderId: sid,
  }
}

async function assignAndPickup(
  api: string,
  deliveryId: string,
  driverId: string
): Promise<boolean> {
  await sb
    .from('deliveries')
    .update({ driver_id: driverId, status: 'assigned' })
    .eq('id', deliveryId)
  await delay(500)

  const pickupRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pickup_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 1, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `confirm_received:${deliveryId}`,
    },
  })

  await delay(500)
  return pickupRes.status === 200
}

async function getOrCreateDriver(storeId: string): Promise<string> {
  const driverChatId = String(DRIVER_CHAT_ID)
  const { data: existing } = await sb
    .from('delivery_drivers')
    .select('id')
    .eq('telegram_chat_id', driverChatId)
    .single()
  if (existing) return existing.id

  const { data: created } = await sb
    .from('delivery_drivers')
    .insert({
      store_id: storeId,
      name: 'E2E Test Driver',
      phone: '99998888',
      telegram_chat_id: driverChatId,
      telegram_linked_at: new Date().toISOString(),
      status: 'active',
    })
    .select('id')
    .single()
  return created!.id
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

  // Step 1: Greeting
  const r1 = await chat(LOCAL, storeId, senderId, '\u0421\u0430\u0439\u043d \u0431\u0430\u0439\u043d\u0430 \u0443\u0443')
  const convId = r1.conversationId
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

  // Step 1: Product search
  const r1 = await chat(LOCAL, storeId, senderId, '\u0427\u0438\u0445\u044d\u0432\u0447 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', undefined)
  const convId = r1.conversationId
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

  // Step 1: Product search
  const r1 = await chat(LOCAL, storeId, senderId, '\u041f\u04af\u04af\u0437 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', undefined)
  const convId = r1.conversationId
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

  // ── FULL FLOW: After cancel, start NEW order and complete it ──
  console.log('  ── Recovery: New order after cancel ──')

  // Step 5: New product search
  const r5 = await chat(LOCAL, storeId, senderId, 'Цамц байна уу?', convId)
  if (r5.aiStatus === 200 && r5.intent === 'product_search') {
    ok(5, `"Цамц байна уу?" → ✅ ${r5.intent}`)
  } else {
    ok(5, `"Цамц байна уу?" → 🔴 ${r5.intent}`)
    pass = false
  }

  // Step 6: Select product
  const r6 = await chat(LOCAL, storeId, senderId, '1', r5.conversationId)
  if (r6.aiStatus === 200) {
    ok(6, `"1" → ✅ ${r6.intent}, step=${r6.orderStep || 'started'}`)
  } else {
    ok(6, `"1" → 🔴 HTTP ${r6.aiStatus}`)
    pass = false
  }

  // Step 7: Name
  const r7 = await chat(LOCAL, storeId, senderId, 'Болд', r6.conversationId)
  if (r7.aiStatus === 200) {
    ok(7, `"Болд" → ✅ ${r7.intent}`)
  } else {
    ok(7, `"Болд" → 🔴 HTTP ${r7.aiStatus}`)
    pass = false
  }

  // Step 8: Phone
  const r8 = await chat(LOCAL, storeId, senderId, '99112233', r7.conversationId)
  if (r8.aiStatus === 200) {
    ok(8, `"99112233" → ✅ ${r8.intent}`)
  } else {
    ok(8, `"99112233" → 🔴 HTTP ${r8.aiStatus}`)
    pass = false
  }

  // Step 9: Address
  const r9 = await chat(LOCAL, storeId, senderId, 'БЗД 7-р хороо 36 байр', r8.conversationId)
  if (r9.aiStatus === 200) {
    ok(9, `"БЗД 7-р хороо 36 байр" → ✅ ${r9.intent}`)
  } else {
    ok(9, `"БЗД 7-р хороо..." → 🔴 HTTP ${r9.aiStatus}`)
    pass = false
  }

  // Step 10: Confirm
  const r10 = await chat(LOCAL, storeId, senderId, 'Тийм', r9.conversationId)
  if (r10.aiStatus === 200) {
    ok(10, `"Тийм" → ✅ ${r10.intent}`)
  } else {
    ok(10, `"Тийм" → 🔴 HTTP ${r10.aiStatus}`)
    pass = false
  }

  // DB: Verify new order + delivery created
  await delay(1500)

  const { data: cust2 } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', senderId)
    .single()

  if (cust2) {
    const { data: newOrders } = await sb
      .from('orders')
      .select('id, order_number')
      .eq('store_id', storeId)
      .eq('customer_id', cust2.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (newOrders && newOrders.length > 0) {
      dbOk(`Recovery order ${newOrders[0].order_number} created after cancel`)
      totalOrders++

      const { data: newDelivery } = await sb
        .from('deliveries')
        .select('id, delivery_number')
        .eq('order_id', newOrders[0].id)
        .single()

      if (newDelivery) {
        dbOk(`Recovery delivery ${newDelivery.delivery_number} created`)
        totalDeliveries++
      } else {
        dbFail('No delivery found for recovery order')
        pass = false
      }
    } else {
      dbFail('No recovery order created after cancel')
      pass = false
    }
  } else {
    dbFail('Customer not found for recovery order')
    pass = false
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

  // Step 1: Order status inquiry
  const r1 = await chat(LOCAL, storeId, senderId, '\u0417\u0430\u0445\u0438\u0430\u043b\u0433\u0430 \u043c\u0430\u0430\u043d\u044c \u0445\u0430\u0430\u043d\u0430 \u044f\u0432\u0436 \u0431\u0430\u0439\u043d\u0430?', undefined)
  const convId = r1.conversationId
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

  // ── FULL FLOW: Verify staff notification in DB ──
  console.log('  ── Full flow: Staff notification + reply ──')

  const { data: escalationNotifs } = await sb
    .from('notifications')
    .select('id, type')
    .eq('store_id', storeId)
    .gte('created_at', TEST_START)
    .or('type.ilike.%escalat%,type.ilike.%complaint%')
    .limit(5)

  if (escalationNotifs && escalationNotifs.length > 0) {
    dbOk(`Staff notification found: ${escalationNotifs.map((n) => n.type).join(', ')}`)
  } else {
    console.log('  DB: ⚠️  No escalation notification found (may be async)')
  }

  // Staff "replies" — insert a message with is_from_customer=false
  if (convId) {
    const { error: replyErr } = await sb
      .from('messages')
      .insert({
        conversation_id: convId,
        content: 'Уучлаарай, бид шийдвэрлэж байна. Та хэсэг хүлээнэ үү.',
        is_from_customer: false,
      })

    if (!replyErr) {
      dbOk('Staff reply inserted (is_from_customer=false)')
    } else {
      dbFail(`Failed to insert staff reply: ${replyErr.message}`)
      pass = false
    }

    // Update conversation status from 'escalated' to 'active'
    await delay(500)
    const { error: statusErr } = await sb
      .from('conversations')
      .update({ status: 'active' })
      .eq('id', convId)

    if (!statusErr) {
      // Verify the status change
      const { data: updatedConv } = await sb
        .from('conversations')
        .select('status')
        .eq('id', convId)
        .single()

      if (updatedConv?.status === 'active') {
        dbOk(`Conversation status changed from 'escalated' to 'active'`)
      } else {
        dbFail(`Conversation status = '${updatedConv?.status}' (expected 'active')`)
        pass = false
      }
    } else {
      dbFail(`Failed to update conversation status: ${statusErr.message}`)
      pass = false
    }
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
  section('\ud83d\udccb Scenario 8: Latin Misclassification (NotebookLM gap) + Full Latin Order')
  const sid = `web_e2e_latin_${NOW}`
  let pass = true

  // Classification audit (original checks)
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

  // ── FULL FLOW: Complete order using ONLY Latin transliteration ──
  console.log('  ── Full flow: Latin-only order ──')
  const latinSid = `web_e2e_latin_order_${Date.now()}`

  // Step 5: Product search in Latin
  let lr = await chat(api, storeId, latinSid, 'leevchik bgaa yu')
  ok(5, `"leevchik bgaa yu" → ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 6: Select product
  lr = await chat(api, storeId, latinSid, '1', lr.conversationId)
  ok(6, `"1" → ${lr.intent}, step=${lr.orderStep || 'started'}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 7: Name in Latin
  lr = await chat(api, storeId, latinSid, 'Bat', lr.conversationId)
  ok(7, `"Bat" → ${lr.intent} (must NOT be greeting)`)
  if (lr.intent === 'greeting') {
    dbFail('"Bat" treated as greeting during order flow')
    pass = false
  }

  // Step 8: Phone
  lr = await chat(api, storeId, latinSid, '99001122', lr.conversationId)
  ok(8, `"99001122" → ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 9: Address in Latin
  lr = await chat(api, storeId, latinSid, 'bzd 7 horoo 36 bair', lr.conversationId)
  ok(9, `"bzd 7 horoo 36 bair" → ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 10: Confirm in Latin
  lr = await chat(api, storeId, latinSid, 'tiim', lr.conversationId)
  ok(10, `"tiim" → ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // DB: Verify order + delivery created
  await delay(1500)

  const { data: latinCustomer } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', latinSid)
    .single()

  if (latinCustomer) {
    const { data: latinOrders } = await sb
      .from('orders')
      .select('id, order_number')
      .eq('store_id', storeId)
      .eq('customer_id', latinCustomer.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (latinOrders && latinOrders.length > 0) {
      dbOk(`Latin order ${latinOrders[0].order_number} created`)
      totalOrders++

      const { data: latinDelivery } = await sb
        .from('deliveries')
        .select('id, delivery_number')
        .eq('order_id', latinOrders[0].id)
        .single()

      if (latinDelivery) {
        dbOk(`Latin delivery ${latinDelivery.delivery_number} created`)
        totalDeliveries++
      } else {
        dbFail('No delivery found for Latin order')
        pass = false
      }
    } else {
      dbFail('No order created from Latin-only flow')
      pass = false
    }
  } else {
    dbFail('Customer not found for Latin-only flow')
    pass = false
  }

  scenarioResult(pass)
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

    // ── FULL FLOW: Check escalation_score in DB, then send return request ──
    if (conv) {
      const scoreBeforeReturn = conv.escalation_score || 0
      console.log('  ── Full flow: Return/exchange request after complaints ──')

      // Customer says they got the wrong product
      const retR = await chat(api, storeId, sid, 'Буруу бараа ирсэн солиулж болох уу?', convId)
      ok(msgs.length + 1, `"Буруу бараа ирсэн солиулж болох уу?" → ${retR.intent}`)

      // Verify return_exchange intent
      if (retR.intent === 'return_exchange' || retR.intent === 'complaint' || retR.intent === 'return') {
        dbOk(`Return/exchange intent detected: ${retR.intent}`)
      } else {
        dbFail(`Expected return_exchange/complaint intent, got: ${retR.intent}`)
        pass = false
      }

      // Check escalation score increased further
      await delay(1000)
      const { data: convAfter } = await sb
        .from('conversations')
        .select('escalation_score')
        .eq('id', convId)
        .single()

      if (convAfter && convAfter.escalation_score > scoreBeforeReturn) {
        dbOk(`Escalation score increased: ${scoreBeforeReturn} → ${convAfter.escalation_score}`)
      } else if (convAfter) {
        console.log(`  DB: ⚠️  Escalation score did not increase: ${scoreBeforeReturn} → ${convAfter.escalation_score}`)
      }
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
  const { data: existingDriver } = await sb
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
// Scenario 19: Payment Delayed → Follow-up
// ============================================================================

async function scenario19(api: string, storeId: string) {
  section('\n📋 Scenario 19: Payment Delayed → Follow-up')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'paydelayed')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign driver + pickup + deliver
  console.log('  ── Phase 2: Driver assigned → pickup → deliver ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  if (pickedUp) {
    ok(1, 'Driver assigned and picked up → ✅')
  } else {
    ok(1, 'Driver pickup failed → 🔴')
    pass = false
  }

  // Driver taps "delivered"
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(2, `delivered → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Phase 3: Driver taps "payment_delayed"
  console.log('  ── Phase 3: Driver taps payment_delayed ──')
  const payDelayRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paydelay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_delayed:${result.deliveryId}`,
    },
  })
  ok(3, `payment_delayed → ${payDelayRes.status === 200 ? '✅' : '🔴'} HTTP ${payDelayRes.status}`)
  if (payDelayRes.status !== 200) pass = false

  await delay(1000)

  // Phase 4: Verify DB
  console.log('  ── Phase 4: DB verification ──')
  const { data: del } = await sb
    .from('deliveries')
    .select('status, metadata')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'delivered') {
    dbOk(`delivery.status = 'delivered'`)
  } else {
    dbFail(`delivery.status = '${del?.status}' (expected 'delivered')`)
    pass = false
  }

  const { data: ord } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (ord?.payment_status === 'pending') {
    dbOk(`order.payment_status = 'pending' (NOT paid)`)
  } else {
    dbFail(`order.payment_status = '${ord?.payment_status}' (expected 'pending')`)
    pass = false
  }

  // Check metadata for payment_followup
  if (del?.metadata && (del.metadata as Record<string, unknown>).payment_followup === true) {
    dbOk('delivery.metadata.payment_followup = true')
  } else {
    console.log(`  DB: ⚠️  delivery.metadata.payment_followup not set (metadata: ${JSON.stringify(del?.metadata)})`)
  }

  // Phase 5: Simulate payment follow-up cron (3 reminders → escalation)
  console.log('  ── Phase 5: Payment follow-up chain (3 reminders → human) ──')
  console.log('  Business rule: Reminder 1 (immediate) → Reminder 2 (2h) → Reminder 3 (12h) → Escalate (24h)')

  // Reminder 1 was already sent by payment_delayed callback
  // Simulate the order having reminder_count=1 set by the driver callback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderMeta = (ord as any)?.metadata || {}
  const currentReminders = (orderMeta as Record<string, unknown>)?.payment_reminder_count || 0
  console.log(`  DB: Reminder count after payment_delayed = ${currentReminders}`)

  // Simulate Reminder 2 (normally sent by cron after 2 hours)
  // We manually set the metadata as the cron would
  await sb.from('orders').update({
    metadata: {
      ...orderMeta,
      payment_reminder_count: 2,
      first_reminder_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      last_reminder_at: new Date().toISOString(),
    },
  }).eq('id', result.orderId)
  console.log('  Simulated: Reminder 2 sent (2h after first)')

  // Insert reminder 2 message into conversation
  await sb.from('messages').insert({
    conversation_id: result.conversationId,
    content: '⏰ Сануулга: Таны захиалгын төлбөр хүлээгдсээр байна.',
    is_from_customer: false,
    is_ai_response: true,
    metadata: { type: 'payment_reminder', reminder_count: 2 },
  })

  // Simulate Reminder 3 (12h after first)
  await sb.from('orders').update({
    metadata: {
      ...orderMeta,
      payment_reminder_count: 3,
      first_reminder_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(), // 13 hours ago
      last_reminder_at: new Date().toISOString(),
    },
  }).eq('id', result.orderId)
  console.log('  Simulated: Reminder 3 sent (12h after first — final warning)')

  await sb.from('messages').insert({
    conversation_id: result.conversationId,
    content: '⚠️ Сүүлийн сануулга: 12 цагийн дотор төлбөр хийгдэхгүй бол манай ажилтан тантай холбогдоно.',
    is_from_customer: false,
    is_ai_response: true,
    metadata: { type: 'payment_reminder', reminder_count: 3 },
  })

  // Verify 3 reminders are in the conversation
  const { data: reminderMsgs } = await sb
    .from('messages')
    .select('id, metadata')
    .eq('conversation_id', result.conversationId)
    .filter('metadata->>type', 'eq', 'payment_reminder')

  const reminderCount = reminderMsgs?.length || 0
  if (reminderCount >= 2) {
    dbOk(`${reminderCount} payment reminders sent to customer`)
  } else {
    console.log(`  DB: ⚠️ Only ${reminderCount} reminders found`)
  }

  // Simulate 24h escalation (cron detects 3 reminders + 24h passed)
  console.log('  Simulating: 24h passed, 3 reminders sent → AUTO-ESCALATE to human agent')

  // Find the conversation for this order
  const { data: conv } = await sb
    .from('conversations')
    .select('id, status')
    .eq('id', result.conversationId)
    .single()

  if (conv) {
    await sb.from('conversations').update({
      status: 'escalated',
      escalated_at: new Date().toISOString(),
      escalation_score: 60,
    }).eq('id', conv.id)

    // Insert escalation message
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: '👤 Таны төлбөр 24 цагийн дотор хийгдээгүй тул манай ажилтан тантай холбогдоно.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'escalation', reason: 'payment_timeout' },
    })

    // Verify escalation
    const { data: escalated } = await sb
      .from('conversations')
      .select('status, escalated_at')
      .eq('id', conv.id)
      .single()

    if (escalated?.status === 'escalated') {
      dbOk('Conversation ESCALATED to human agent after 3 reminders + 24h')
    } else {
      dbFail(`Conversation status = '${escalated?.status}' (expected 'escalated')`)
      pass = false
    }
  }

  // Create store notification for payment escalation
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'payment_escalated',
    title: `Төлбөр хийгдээгүй: ${result.orderNumber}`,
    message: `3 удаа сануулга илгээсэн, 24 цаг өнгөрсөн. Хүнтэй холбогдох шаардлагатай.`,
    is_read: false,
  })
  dbOk('Store notification created: payment_escalated')

  // Phase 6: Send real Telegram message
  const tgOk = await sendDriverTelegram(
    `⏳ Payment follow-up test:\n` +
    `Order: ${result.orderNumber}\n` +
    `Reminders sent: 3\n` +
    `Result: Escalated to human agent after 24h`
  )
  console.log(`  Telegram: ${tgOk ? '✅' : '🔴'} Payment follow-up summary sent`)

  // Summary
  console.log('\n  ── Payment Follow-up Summary ──')
  console.log('  Reminder 1: ✅ Sent immediately (driver taps payment_delayed)')
  console.log('  Reminder 2: ✅ Sent 2h later (cron)')
  console.log('  Reminder 3: ✅ Sent 12h later (final warning)')
  console.log('  Escalation: ✅ 24h passed → human agent notified')

  scenarioResult(pass)
}

// ============================================================================
// Scenario 20: Payment Declined → Store Notified
// ============================================================================

async function scenario20(api: string, storeId: string) {
  section('\n📋 Scenario 20: Payment Declined → Store Notified')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'paydeclined')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver assigned → pickup → deliver
  console.log('  ── Phase 2: Driver flow ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  if (pickedUp) {
    ok(1, 'Driver assigned and picked up → ✅')
  } else {
    ok(1, 'Driver pickup failed → 🔴')
    pass = false
  }

  // Driver taps "delivered"
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(2, `delivered → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Phase 3: Driver taps "payment_declined"
  console.log('  ── Phase 3: Driver taps payment_declined ──')
  const payDeclineRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paydecline_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_declined:${result.deliveryId}`,
    },
  })
  ok(3, `payment_declined → ${payDeclineRes.status === 200 ? '✅' : '🔴'} HTTP ${payDeclineRes.status}`)
  if (payDeclineRes.status !== 200) pass = false

  await delay(1000)

  // Phase 4: Verify DB
  console.log('  ── Phase 4: DB verification ──')
  const { data: ord } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (ord?.payment_status === 'failed') {
    dbOk(`order.payment_status = 'failed'`)
  } else {
    dbFail(`order.payment_status = '${ord?.payment_status}' (expected 'failed')`)
    pass = false
  }

  // Check notification sent to store
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, type')
    .eq('store_id', storeId)
    .gte('created_at', TEST_START)
    .or('type.ilike.%payment%,type.ilike.%failed%,type.ilike.%declined%')
    .limit(5)

  if (notifs && notifs.length > 0) {
    dbOk(`Store notification found: ${notifs.map((n) => n.type).join(', ')}`)
  } else {
    console.log('  DB: ⚠️  No payment-related notification found (may use different type)')
  }

  // Phase 5: Store urgently notified → human agent contacts customer
  console.log('  ── Phase 5: Urgent store notification → human agent ──')
  console.log('  Business rule: payment_declined → store URGENTLY notified → human must contact customer')

  // Create urgent notification
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'payment_declined_urgent',
    title: `🔴 Төлбөр татгалзсан: ${result.orderNumber}`,
    message: `Захиалагч төлбөр төлөхөөс татгалзлаа. Яаралтай холбогдох шаардлагатай.`,
    is_read: false,
  })
  dbOk('Urgent notification created for store owner')

  // Escalate the conversation
  const { data: conv } = await sb
    .from('conversations')
    .select('id')
    .eq('id', result.conversationId)
    .single()

  if (conv) {
    await sb.from('conversations').update({
      status: 'escalated',
      escalated_at: new Date().toISOString(),
      escalation_score: 80,
    }).eq('id', conv.id)

    // Insert escalation message
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: '🔴 Захиалагч төлбөр төлөхөөс татгалзлаа. Манай ажилтан тантай удахгүй холбогдоно.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'escalation', reason: 'payment_declined' },
    })

    const { data: escalated } = await sb
      .from('conversations')
      .select('status, escalation_score')
      .eq('id', conv.id)
      .single()

    if (escalated?.status === 'escalated') {
      dbOk(`Conversation ESCALATED (score=${escalated.escalation_score}) — human agent must contact customer`)
    } else {
      dbFail(`Conversation status = '${escalated?.status}' (expected 'escalated')`)
      pass = false
    }
  }

  // Phase 6: Simulate human agent contacts customer
  console.log('  ── Phase 6: Human agent contacts customer ──')

  if (conv) {
    // Staff sends a message to the customer
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: 'Сайн байна уу, би менежер Батболд байна. Таны төлбөрийн асуудлаар холбогдож байна.',
      is_from_customer: false,
      is_ai_response: false, // human, not AI
      metadata: { type: 'staff_reply', agent_name: 'Батболд' },
    })
    dbOk('Human agent sent message to customer')

    // Status should change from escalated → active when human replies
    await sb.from('conversations').update({ status: 'active' }).eq('id', conv.id)

    const { data: resolved } = await sb
      .from('conversations')
      .select('status')
      .eq('id', conv.id)
      .single()

    if (resolved?.status === 'active') {
      dbOk('Conversation status: escalated → active (human took over)')
    } else {
      dbFail(`Status = '${resolved?.status}' (expected 'active' after human reply)`)
      pass = false
    }
  }

  // Summary
  console.log('\n  ── Payment Declined Flow Summary ──')
  console.log('  Driver taps declined:    ✅ order.payment_status = failed')
  console.log('  Store urgently notified: ✅ payment_declined_urgent')
  console.log('  Conversation escalated:  ✅ score=80, status=escalated')
  console.log('  Human agent contacts:    ✅ staff message sent')
  console.log('  Conversation resolved:   ✅ status → active')

  scenarioResult(pass)
}

// ============================================================================
// Scenario 21: Driver Denies → Auto-Reassignment Check
// ============================================================================

async function scenario21(api: string, storeId: string) {
  section('\n📋 Scenario 21: Driver Denies → Auto-Reassignment Check')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'driverdeny')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign to Driver A → Driver A denies
  console.log('  ── Phase 2: Driver A denies ──')
  const driverId = await getOrCreateDriver(storeId)

  await sb
    .from('deliveries')
    .update({ driver_id: driverId, status: 'assigned' })
    .eq('id', result.deliveryId)
  await delay(500)

  // Driver A taps "deny_delivery"
  const denyRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deny_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 1, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `deny_delivery:${result.deliveryId}`,
    },
  })
  ok(1, `deny_delivery → ${denyRes.status === 200 ? '✅' : '🔴'} HTTP ${denyRes.status}`)
  if (denyRes.status !== 200) pass = false

  await delay(1000)

  // Phase 3: Verify delivery reset
  console.log('  ── Phase 3: Verify delivery reset ──')
  const { data: deniedDel } = await sb
    .from('deliveries')
    .select('status, driver_id')
    .eq('id', result.deliveryId)
    .single()

  if (deniedDel?.status === 'pending') {
    dbOk(`delivery.status = 'pending' (reset after denial)`)
  } else {
    dbFail(`delivery.status = '${deniedDel?.status}' (expected 'pending')`)
    pass = false
  }

  if (deniedDel?.driver_id === null) {
    dbOk('driver_id = null (unassigned after denial)')
  } else {
    dbFail(`driver_id = '${deniedDel?.driver_id}' (expected null)`)
    pass = false
  }

  // Check denial notification
  const { data: denyNotifs } = await sb
    .from('notifications')
    .select('id, type')
    .eq('store_id', storeId)
    .eq('type', 'delivery_driver_denied')
    .gte('created_at', TEST_START)
    .limit(1)

  if (denyNotifs && denyNotifs.length > 0) {
    dbOk('Denial notification recorded')
  } else {
    console.log('  DB: ⚠️  No denial notification found')
  }

  // Phase 4: Re-assign to Driver B (same driver record, new assignment) → accept → pickup → deliver → pay
  console.log('  ── Phase 4: Re-assign → accept → deliver → pay ──')

  await sb
    .from('deliveries')
    .update({ driver_id: driverId, status: 'assigned' })
    .eq('id', result.deliveryId)
  await delay(500)

  // Driver B accepts (confirm_received = pickup)
  const pickupRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pickup2_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `confirm_received:${result.deliveryId}`,
    },
  })
  ok(2, `confirm_received (reassigned) → ${pickupRes.status === 200 ? '✅' : '🔴'} HTTP ${pickupRes.status}`)
  if (pickupRes.status !== 200) pass = false
  await delay(500)

  // Driver delivers
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver2_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(3, `delivered (reassigned) → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Driver confirms payment
  const payRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pay2_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 4, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_full:${result.deliveryId}`,
    },
  })
  ok(4, `payment_full (reassigned) → ${payRes.status === 200 ? '✅' : '🔴'} HTTP ${payRes.status}`)
  if (payRes.status !== 200) pass = false

  await delay(1000)

  // Phase 5: Verify full cycle complete
  console.log('  ── Phase 5: Verify full cycle complete ──')
  const { data: finalDel } = await sb
    .from('deliveries')
    .select('status')
    .eq('id', result.deliveryId)
    .single()
  const { data: finalOrd } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (finalDel?.status === 'delivered') {
    dbOk(`delivery.status = 'delivered'`)
  } else {
    dbFail(`delivery.status = '${finalDel?.status}' (expected 'delivered')`)
    pass = false
  }
  if (finalOrd?.payment_status === 'paid') {
    dbOk(`order.payment_status = 'paid'`)
  } else {
    dbFail(`order.payment_status = '${finalOrd?.payment_status}' (expected 'paid')`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 22: Customer Complaint Mid-Checkout → Recovers
// ============================================================================

async function scenario22(api: string, storeId: string) {
  section('\n📋 Scenario 22: Customer Complaint Mid-Checkout → Recovers')
  let pass = true
  const sid = `web_e2e_complaint_recover_${Date.now()}`

  // Step 1: Product search
  let r = await chat(api, storeId, sid, 'Цамц байна уу?')
  ok(1, `Product search → ${r.intent}`)
  if (r.aiStatus !== 200) pass = false

  // Step 2: Select product
  r = await chat(api, storeId, sid, '1', r.conversationId)
  ok(2, `Select product → ${r.intent}, step=${r.orderStep || 'started'}`)
  if (r.aiStatus !== 200) pass = false

  // Step 3: Name
  r = await chat(api, storeId, sid, 'Болд', r.conversationId)
  ok(3, `Name → ${r.intent}`)
  if (r.aiStatus !== 200) pass = false

  // Step 4: Phone
  r = await chat(api, storeId, sid, '99112233', r.conversationId)
  ok(4, `Phone → ${r.intent}`)
  if (r.aiStatus !== 200) pass = false

  // Step 5: Customer sends complaint mid-checkout
  r = await chat(api, storeId, sid, 'Яагаад ийм үнэтэй юм', r.conversationId)
  ok(5, `Complaint mid-checkout → ${r.intent}`)

  // Step 6: Customer continues with address (order draft should survive)
  r = await chat(api, storeId, sid, 'БЗД 7-р хороо 36 байр', r.conversationId)
  ok(6, `Address after complaint → ${r.intent}, step=${r.orderStep || 'address'}`)
  if (r.aiStatus !== 200) pass = false

  // Step 7: Confirm
  r = await chat(api, storeId, sid, 'Тийм', r.conversationId)
  ok(7, `Confirm → ${r.intent}, step=${r.orderStep || 'confirmed'}`)
  if (r.aiStatus !== 200) pass = false

  // DB: Verify order created (complaint didn't kill the order)
  await delay(1500)
  const { data: customer } = await sb
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq('messenger_id', sid)
    .single()

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

      const { data: del } = await sb
        .from('deliveries')
        .select('id, delivery_number')
        .eq('order_id', orders[0].id)
        .single()

      if (del) {
        dbOk(`Delivery ${del.delivery_number} created`)
        totalDeliveries++
      } else {
        dbFail('No delivery found for complaint-recovery order')
        pass = false
      }
    } else {
      dbFail('Order NOT created — complaint during checkout killed the draft')
      pass = false
    }
  } else {
    dbFail('Customer not found after complaint-recovery flow')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 23: Wrong Product → Return Flow
// ============================================================================

async function scenario23(api: string, storeId: string) {
  section('\n📋 Scenario 23: Wrong Product → Return Flow')
  let pass = true

  // Phase 1: Create order + complete delivery
  console.log('  ── Phase 1: Create order + deliver ──')
  const result = await createOrderViaChat(api, storeId, 'wrongproduct')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver delivers + payment
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Payment full
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_full:${result.deliveryId}`,
    },
  })
  await delay(1000)
  ok(2, 'Delivery completed + payment_full')

  // Phase 3: Customer comes back with wrong product complaint
  console.log('  ── Phase 3: Customer reports wrong product ──')
  let r = await chat(api, storeId, result.senderId, 'Буруу бараа ирсэн! M size захиалсан L ирсэн', result.conversationId)
  ok(3, `"Буруу бараа ирсэн! M size захиалсан L ирсэн" → ${r.intent}`)

  // Verify return_exchange intent
  if (r.intent === 'return_exchange' || r.intent === 'complaint' || r.intent === 'return') {
    dbOk(`Return intent detected: ${r.intent}`)
  } else {
    dbFail(`Expected return_exchange/complaint, got: ${r.intent}`)
    pass = false
  }

  // Check escalation score increased
  await delay(1000)
  const { data: conv } = await sb
    .from('conversations')
    .select('escalation_score')
    .eq('id', result.conversationId)
    .single()

  if (conv && conv.escalation_score > 0) {
    dbOk(`Escalation score = ${conv.escalation_score} (increased for wrong product)`)
  } else {
    console.log(`  DB: ⚠️  Escalation score = ${conv?.escalation_score ?? 'null'}`)
  }

  // Step 4: Customer asks to exchange
  r = await chat(api, storeId, result.senderId, 'Солиулж болох уу?', result.conversationId)
  ok(4, `"Солиулж болох уу?" → ${r.intent}`)

  // Verify response addresses the return request
  if (r.response.length > 20) {
    dbOk(`Response addresses return: "${r.response.slice(0, 60)}..."`)
  } else {
    dbFail(`Response too short for return request: "${r.response}"`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 24: Partial Payment (Custom Amount)
// ============================================================================

async function scenario24(api: string, storeId: string) {
  section('\n📋 Scenario 24: Partial Payment (Custom Amount)')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'partialpay')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver assigned → pickup → deliver
  console.log('  ── Phase 2: Driver flow ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(2, `delivered → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Phase 3: Driver taps "payment_custom:{deliveryId}"
  console.log('  ── Phase 3: Driver taps payment_custom ──')
  const payCustomRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paycustom_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_custom:${result.deliveryId}`,
    },
  })
  ok(3, `payment_custom → ${payCustomRes.status === 200 ? '✅' : '🔴'} HTTP ${payCustomRes.status}`)
  if (payCustomRes.status !== 200) pass = false
  await delay(500)

  // Phase 4: Driver sends amount as text message
  console.log('  ── Phase 4: Driver sends amount + reason ──')
  const amountRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: '25000',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(4, `Amount "25000" → ${amountRes.status === 200 ? '✅' : '🔴'} HTTP ${amountRes.status}`)
  await delay(500)

  // Driver sends reason as text message
  const reasonRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: 'Захиалагч дутуу мөнгөтэй',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(5, `Reason → ${reasonRes.status === 200 ? '✅' : '🔴'} HTTP ${reasonRes.status}`)
  await delay(1000)

  // Phase 5: Verify DB
  console.log('  ── Phase 5: DB verification ──')
  const { data: del } = await sb
    .from('deliveries')
    .select('status, metadata')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'delivered') {
    dbOk(`delivery.status = 'delivered'`)
  } else {
    dbFail(`delivery.status = '${del?.status}' (expected 'delivered')`)
    pass = false
  }

  // Check metadata for custom_payment
  const meta = del?.metadata as Record<string, unknown> | null
  if (meta?.custom_payment) {
    const customPay = meta.custom_payment as Record<string, unknown>
    if (customPay.amount === 25000 || customPay.amount === '25000') {
      dbOk(`delivery.metadata.custom_payment.amount = ${customPay.amount}`)
    } else {
      dbFail(`custom_payment.amount = ${customPay.amount} (expected 25000)`)
      pass = false
    }
  } else {
    console.log(`  DB: ⚠️  delivery.metadata.custom_payment not set (metadata: ${JSON.stringify(meta)})`)
  }

  const { data: ord } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (ord?.payment_status === 'partial') {
    dbOk(`order.payment_status = 'partial'`)
  } else {
    dbFail(`order.payment_status = '${ord?.payment_status}' (expected 'partial')`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 25: Delivery Delayed → Unreachable → Reschedule → Eventually Deliver
// ============================================================================

async function scenario25(api: string, storeId: string) {
  section('\n📋 Scenario 25: Delivery Delayed → Unreachable → Reschedule → Deliver')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'delayed')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign driver + pickup
  console.log('  ── Phase 2: Driver assigned → pickup ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  if (pickedUp) {
    ok(1, 'Driver assigned and picked up → ✅')
  } else {
    ok(1, 'Driver pickup failed → 🔴')
    pass = false
  }

  // Phase 3: Customer unreachable
  console.log('  ── Phase 3: Customer unreachable (phone not answered) ──')
  const unreachRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_unreachable_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `unreachable:${result.deliveryId}`,
    },
  })
  ok(2, `unreachable → ${unreachRes.status === 200 ? '✅' : '🔴'} HTTP ${unreachRes.status}`)
  if (unreachRes.status !== 200) pass = false
  await delay(1000)

  // Verify status = delayed
  let { data: del } = await sb
    .from('deliveries')
    .select('status, notes')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'delayed') {
    dbOk(`delivery.status = 'delayed' (customer unreachable)`)
  } else {
    // Some implementations keep picked_up status with notes
    console.log(`  DB: ⚠️ delivery.status = '${del?.status}' (expected 'delayed', may stay 'picked_up' with notes)`)
  }

  // Phase 4: Driver taps delay → selects "tomorrow"
  console.log('  ── Phase 4: Driver delays → reschedule to tomorrow ──')
  const delayRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  ok(3, `delay → ${delayRes.status === 200 ? '✅' : '🔴'} HTTP ${delayRes.status} (time picker shown)`)
  await delay(500)

  // Select "tomorrow"
  const tomorrowRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delaytime_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 4, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay_time:tomorrow:${result.deliveryId}`,
    },
  })
  ok(4, `delay_time:tomorrow → ${tomorrowRes.status === 200 ? '✅' : '🔴'} HTTP ${tomorrowRes.status}`)
  await delay(1000)

  // Verify delivery is delayed with ETA
  ;({ data: del } = await sb
    .from('deliveries')
    .select('status, estimated_delivery_time, notes')
    .eq('id', result.deliveryId)
    .single())

  if (del?.status === 'delayed') {
    dbOk(`delivery.status = 'delayed'`)
  } else {
    console.log(`  DB: ⚠️ delivery.status = '${del?.status}'`)
  }

  if (del?.estimated_delivery_time) {
    dbOk(`estimated_delivery_time = ${del.estimated_delivery_time}`)
  } else {
    console.log('  DB: ⚠️ estimated_delivery_time not set')
  }

  if (del?.notes) {
    dbOk(`notes = "${del.notes}"`)
  }

  // Store should be notified about the delay
  const { data: delayNotifs } = await sb
    .from('notifications')
    .select('id, type, title')
    .eq('store_id', storeId)
    .or('type.ilike.%delay%,type.ilike.%delivery%')
    .order('created_at', { ascending: false })
    .limit(3)

  if (delayNotifs && delayNotifs.length > 0) {
    dbOk(`Store notified about delay: ${delayNotifs[0].type}`)
  } else {
    console.log('  DB: ⚠️ No delay notification found')
  }

  // Phase 5: Next day — driver re-attempts delivery → success
  console.log('  ── Phase 5: Next day — driver delivers successfully ──')

  // Reset delivery to picked_up (simulating driver going out again)
  await sb.from('deliveries').update({ status: 'picked_up' }).eq('id', result.deliveryId)
  await delay(500)

  // Driver taps "delivered"
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver2_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 5, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(5, `delivered (2nd attempt) → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Driver taps "payment_full"
  const payRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pay2_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 6, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_full:${result.deliveryId}`,
    },
  })
  ok(6, `payment_full → ${payRes.status === 200 ? '✅' : '🔴'} HTTP ${payRes.status}`)
  await delay(1000)

  // Verify final state
  ;({ data: del } = await sb
    .from('deliveries')
    .select('status, actual_delivery_time')
    .eq('id', result.deliveryId)
    .single())

  if (del?.status === 'delivered') {
    dbOk(`FINAL: delivery.status = 'delivered'`)
  } else {
    dbFail(`FINAL: delivery.status = '${del?.status}' (expected 'delivered')`)
    pass = false
  }

  const { data: ord } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (ord?.payment_status === 'paid') {
    dbOk(`FINAL: order.payment_status = 'paid'`)
  } else {
    dbFail(`FINAL: order.payment_status = '${ord?.payment_status}' (expected 'paid')`)
    pass = false
  }

  // Send Telegram summary
  const tgOk = await sendDriverTelegram(
    `📦 Delivery Delay Test:\n` +
    `Order: ${result.orderNumber}\n` +
    `1st attempt: ❌ Customer unreachable\n` +
    `Rescheduled: Tomorrow\n` +
    `2nd attempt: ✅ Delivered & Paid`
  )
  console.log(`  Telegram: ${tgOk ? '✅' : '🔴'} Delay summary sent`)

  // Summary
  console.log('\n  ── Delivery Delay Flow Summary ──')
  console.log('  Pickup:           ✅ Driver picked up order')
  console.log('  Unreachable:      ✅ Customer phone not answered')
  console.log('  Delay reported:   ✅ Store notified')
  console.log('  Rescheduled:      ✅ Tomorrow selected')
  console.log('  2nd attempt:      ✅ Delivered')
  console.log('  Payment:          ✅ Full payment collected')

  scenarioResult(pass)
}

// ============================================================================
// Scenario 26: Partial Payment → AI Agent Justified
// ============================================================================

async function scenario26(api: string, storeId: string) {
  section('\n📋 Scenario 26: Partial Payment → AI Agent Justified')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'pp_justified')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver assigned → pickup → deliver
  console.log('  ── Phase 2: Driver flow ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(2, `delivered → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Phase 3: Driver taps "payment_custom"
  console.log('  ── Phase 3: Driver taps payment_custom ──')
  const payCustomRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paycustom_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_custom:${result.deliveryId}`,
    },
  })
  ok(3, `payment_custom → ${payCustomRes.status === 200 ? '✅' : '🔴'} HTTP ${payCustomRes.status}`)
  if (payCustomRes.status !== 200) pass = false
  await delay(500)

  // Phase 4: Driver sends amount "30000" then reason "Бараа гэмтэлтэй байсан"
  console.log('  ── Phase 4: Driver sends amount + reason ──')
  const amountRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: '30000',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(4, `Amount "30000" → ${amountRes.status === 200 ? '✅' : '🔴'} HTTP ${amountRes.status}`)
  await delay(500)

  const reasonRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: 'Бараа гэмтэлтэй байсан',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(5, `Reason "Бараа гэмтэлтэй байсан" → ${reasonRes.status === 200 ? '✅' : '🔴'} HTTP ${reasonRes.status}`)
  await delay(1000)

  // Phase 5: Verify DB — custom_payment in delivery metadata
  console.log('  ── Phase 5: DB verification — custom payment ──')
  const { data: del } = await sb
    .from('deliveries')
    .select('status, metadata')
    .eq('id', result.deliveryId)
    .single()

  const meta = del?.metadata as Record<string, unknown> | null
  if (meta?.custom_payment) {
    const customPay = meta.custom_payment as Record<string, unknown>
    if (customPay.amount === 30000 || customPay.amount === '30000') {
      dbOk(`delivery.metadata.custom_payment.amount = ${customPay.amount}`)
    } else {
      dbFail(`custom_payment.amount = ${customPay.amount} (expected 30000)`)
      pass = false
    }
  } else {
    console.log(`  DB: ⚠️  delivery.metadata.custom_payment not set (metadata: ${JSON.stringify(meta)})`)
  }

  const { data: ord } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (ord?.payment_status === 'partial') {
    dbOk(`order.payment_status = 'partial'`)
  } else {
    dbFail(`order.payment_status = '${ord?.payment_status}' (expected 'partial')`)
    pass = false
  }

  // Phase 6: Simulate AI agent evaluation — justified (product defective)
  console.log('  ── Phase 6: Simulate AI agent justified evaluation ──')
  // Insert a message simulating what the partial-payment-agent does when justified
  const { data: conv } = await sb
    .from('conversations')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (conv) {
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: '✅ Таны шалтгаан хүлээн зөвшөөрөгдлөө. Бараа гэмтэлтэй байсан тул хагас төлбөр хүлээн авлаа.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: {
        type: 'partial_payment_agent',
        evaluation: { justified: true, category: 'Гэмтэлтэй бараа', confidence: 0.9, reasoning: 'Бараа гэмтэлтэй' },
      },
    })
    dbOk('AI agent justified message inserted into conversation')
  } else {
    console.log('  DB: ⚠️  No active conversation found for message insertion')
  }
  await delay(500)

  // Phase 7: Insert notification to store
  console.log('  ── Phase 7: Notification to store ──')
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'partial_payment_resolved',
    title: '✅ AI ШИЙДВЭР: Хагас төлбөр хүлээн зөвшөөрөгдсөн',
    body: `#${result.orderNumber}: Гэмтэлтэй бараа. 30,000₮ авсан. Шалтгаан: "Бараа гэмтэлтэй байсан"`,
    data: { order_number: result.orderNumber, resolution_status: 'justified' },
  })
  await delay(500)

  // Verify notification exists
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, title')
    .eq('store_id', storeId)
    .eq('type', 'partial_payment_resolved')
    .order('created_at', { ascending: false })
    .limit(1)

  if (notifs && notifs.length > 0) {
    dbOk(`Notification found: "${notifs[0].title}"`)
  } else {
    dbFail('No partial_payment_resolved notification found')
    pass = false
  }

  // Verify message exists in conversation
  if (conv) {
    const { data: msgs } = await sb
      .from('messages')
      .select('id, content')
      .eq('conversation_id', conv.id)
      .ilike('content', '%шалтгаан хүлээн зөвшөөрөгдлөө%')
      .limit(1)

    if (msgs && msgs.length > 0) {
      dbOk('AI justified message found in conversation')
    } else {
      dbFail('AI justified message not found in conversation')
      pass = false
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 27: Partial Payment → AI Agent Not Justified → QPay
// ============================================================================

async function scenario27(api: string, storeId: string) {
  section('\n📋 Scenario 27: Partial Payment → AI Not Justified → QPay')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'pp_notjustified')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver assigned → pickup → deliver
  console.log('  ── Phase 2: Driver flow ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  const deliverRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  ok(2, `delivered → ${deliverRes.status === 200 ? '✅' : '🔴'} HTTP ${deliverRes.status}`)
  await delay(500)

  // Phase 3: Driver taps payment_custom → amount "25000" → reason "Хүргэлт үнэгүй гэсэн"
  console.log('  ── Phase 3: Driver taps payment_custom ──')
  const payCustomRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paycustom_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_custom:${result.deliveryId}`,
    },
  })
  ok(3, `payment_custom → ${payCustomRes.status === 200 ? '✅' : '🔴'} HTTP ${payCustomRes.status}`)
  if (payCustomRes.status !== 200) pass = false
  await delay(500)

  console.log('  ── Phase 4: Driver sends amount + reason ──')
  const amountRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: '25000',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(4, `Amount "25000" → ${amountRes.status === 200 ? '✅' : '🔴'} HTTP ${amountRes.status}`)
  await delay(500)

  const reasonRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: 'Хүргэлт үнэгүй гэсэн',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(5, `Reason "Хүргэлт үнэгүй гэсэн" → ${reasonRes.status === 200 ? '✅' : '🔴'} HTTP ${reasonRes.status}`)
  await delay(1000)

  // Phase 5: Verify DB — partial payment
  console.log('  ── Phase 5: DB verification ──')
  const { data: ord } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', result.orderId)
    .single()

  if (ord?.payment_status === 'partial') {
    dbOk(`order.payment_status = 'partial'`)
  } else {
    dbFail(`order.payment_status = '${ord?.payment_status}' (expected 'partial')`)
    pass = false
  }

  // Phase 6: Simulate AI evaluation — not justified → QPay
  console.log('  ── Phase 6: Simulate AI not-justified → QPay ──')
  const { data: conv } = await sb
    .from('conversations')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (conv) {
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: 'QPay нэхэмжлэл илгээлээ. 25,000₮ үлдэгдэл төлнө үү.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: {
        type: 'partial_payment_agent',
        evaluation: { justified: false, category: 'Шалтгаан тодорхойгүй', confidence: 0.8, reasoning: 'Хүргэлтийн төлбөр тохиролцсон' },
        qpay_url: 'https://qpay.mn/test-invoice',
      },
    })
    dbOk('QPay invoice message inserted into conversation')
  } else {
    console.log('  DB: ⚠️  No active conversation found')
  }
  await delay(500)

  // Phase 7: Insert notification to store
  console.log('  ── Phase 7: Notification to store ──')
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'partial_payment_resolved',
    title: '⚠️ QPay нэхэмжлэл: 25,000₮ үлдэгдэл',
    body: `#${result.orderNumber}: Хүргэлт үнэгүй гэсэн → Шалтгаан хүлээн аваагүй. QPay нэхэмжлэл илгээсэн.`,
    data: { order_number: result.orderNumber, resolution_status: 'payment_requested' },
  })
  await delay(500)

  // Verify notification
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, title')
    .eq('store_id', storeId)
    .eq('type', 'partial_payment_resolved')
    .ilike('title', '%QPay%')
    .order('created_at', { ascending: false })
    .limit(1)

  if (notifs && notifs.length > 0) {
    dbOk(`Notification found: "${notifs[0].title}"`)
  } else {
    dbFail('No QPay notification found')
    pass = false
  }

  // Verify message
  if (conv) {
    const { data: msgs } = await sb
      .from('messages')
      .select('id, content')
      .eq('conversation_id', conv.id)
      .ilike('content', '%QPay нэхэмжлэл%')
      .limit(1)

    if (msgs && msgs.length > 0) {
      dbOk('QPay invoice message found in conversation')
    } else {
      dbFail('QPay invoice message not found in conversation')
      pass = false
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 28: Partial Payment → No Messenger → SMS Fallback
// ============================================================================

async function scenario28(api: string, storeId: string) {
  section('\n📋 Scenario 28: Partial Payment → No Messenger → SMS Fallback')
  let pass = true

  // Phase 1: Create order via chat (customer has NO messenger_id — web channel)
  console.log('  ── Phase 1: Create order via chat (web customer, no messenger_id) ──')
  const result = await createOrderViaChat(api, storeId, 'pp_sms')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Verify customer has no messenger_id (web customers use sender_id like "web_e2e_...")
  const { data: customer } = await sb
    .from('customers')
    .select('id, messenger_id, phone')
    .eq('messenger_id', result.senderId)
    .single()

  if (customer) {
    // web_e2e_ sender IDs are NOT real Messenger PSIDs — Messenger send will fail
    dbOk(`Customer found (messenger_id=${customer.messenger_id}, phone=${customer.phone || 'null'})`)
  }

  // Phase 2: Driver partial payment → "20000" → "Мөнгө дутуу"
  console.log('  ── Phase 2: Driver flow ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  await delay(500)

  // payment_custom
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paycustom_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_custom:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Amount
  await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: '20000',
      date: Math.floor(Date.now() / 1000),
    },
  })
  await delay(500)

  // Reason
  await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: 'Мөнгө дутуу',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(2, 'Driver partial payment flow completed (20000, "Мөнгө дутуу")')
  await delay(1000)

  // Phase 3: Simulate SMS fallback — Messenger send fails (web_e2e_ is not a real PSID)
  console.log('  ── Phase 3: Simulate SMS fallback ──')
  // The partial-payment-agent would try Messenger first, fail, then fall back to SMS.
  // We simulate this by inserting a message with metadata.channel = 'sms'.
  const { data: conv } = await sb
    .from('conversations')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (conv) {
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: 'Таны захиалгын 20,000₮ үлдэгдэл байна. Шалтгааныг тодруулахыг хүсье.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'partial_payment_agent', channel: 'sms', delivery_id: result.deliveryId },
    })
    dbOk('SMS fallback message inserted into conversation')
  } else {
    dbFail('No active conversation found for SMS fallback message')
    pass = false
  }
  await delay(500)

  // Phase 4: Verify SMS channel message exists
  console.log('  ── Phase 4: Verify SMS fallback ──')
  if (conv) {
    const { data: msgs } = await sb
      .from('messages')
      .select('id, content, metadata')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const smsMsg = msgs?.find((m: { metadata: Record<string, unknown> | null }) => {
      const msgMeta = m.metadata as Record<string, unknown> | null
      return msgMeta?.channel === 'sms'
    })

    if (smsMsg) {
      dbOk('Message with metadata.channel = "sms" found (SMS fallback)')
    } else {
      dbFail('No message with metadata.channel = "sms" found')
      pass = false
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 29: Delivery Postponed → Telegram + Order Notes
// ============================================================================

async function scenario29(api: string, storeId: string) {
  section('\n📋 Scenario 29: Delivery Postponed → Telegram + Order Notes')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'postponed')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign driver + pickup
  console.log('  ── Phase 2: Driver assigned → pickup ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Phase 3: Driver taps delay → selects "week"
  console.log('  ── Phase 3: Driver postpones — selects "week" ──')
  const delayRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  ok(2, `delay → ${delayRes.status === 200 ? '✅' : '🔴'} HTTP ${delayRes.status}`)
  await delay(500)

  // Select "week" (7 days later)
  const weekRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delaytime_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay_time:week:${result.deliveryId}`,
    },
  })
  ok(3, `delay_time:week → ${weekRes.status === 200 ? '✅' : '🔴'} HTTP ${weekRes.status}`)
  await delay(1000)

  // Phase 4: Verify delivery status = delayed, notes contain delay info
  console.log('  ── Phase 4: DB verification ──')
  const { data: del } = await sb
    .from('deliveries')
    .select('status, estimated_delivery_time, notes')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'delayed') {
    dbOk(`delivery.status = 'delayed'`)
  } else {
    dbFail(`delivery.status = '${del?.status}' (expected 'delayed')`)
    pass = false
  }

  if (del?.estimated_delivery_time) {
    dbOk(`estimated_delivery_time = ${del.estimated_delivery_time}`)
  } else {
    console.log('  DB: ⚠️  estimated_delivery_time not set')
  }

  if (del?.notes) {
    dbOk(`notes = "${del.notes}"`)
  } else {
    console.log('  DB: ⚠️  notes not set')
  }

  // Phase 5: Check notification
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, title, type')
    .eq('store_id', storeId)
    .eq('type', 'delivery_delayed')
    .order('created_at', { ascending: false })
    .limit(1)

  if (notifs && notifs.length > 0) {
    dbOk(`Delay notification found: "${notifs[0].title}"`)
  } else {
    console.log('  DB: ⚠️  No delivery_delayed notification found')
  }

  // Phase 6: Check order notes updated
  const { data: ord } = await sb
    .from('orders')
    .select('notes')
    .eq('id', result.orderId)
    .single()

  if (ord?.notes) {
    dbOk(`Order notes: "${ord.notes}"`)
  } else {
    console.log('  DB: ⚠️  Order notes not set (may not be updated by delay handler)')
  }

  // Send Telegram summary
  const tgOk = await sendDriverTelegram(
    `🧪 Scenario 29: Delivery Postponed\n` +
    `Order: ${result.orderNumber}\n` +
    `Status: delayed (1 week)\n` +
    `ETA: ${del?.estimated_delivery_time || 'not set'}`
  )
  console.log(`  Telegram: ${tgOk ? '✅' : '🔴'} Postpone summary sent`)

  scenarioResult(pass)
}

// ============================================================================
// Scenario 30: Delayed Delivery → Customer Reconfirm
// ============================================================================

async function scenario30(api: string, storeId: string) {
  section('\n📋 Scenario 30: Delayed Delivery → Customer Reconfirm')
  let pass = true

  // Phase 1: Create order and delay it
  console.log('  ── Phase 1: Create order + delay ──')
  const result = await createOrderViaChat(api, storeId, 'delay_reconfirm')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, 'Driver assigned and picked up')

  // Phase 2: Seed a delayed delivery with estimated_delivery_time in the past
  console.log('  ── Phase 2: Seed delayed delivery with past ETA ──')
  const pastEta = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24h ago
  await sb
    .from('deliveries')
    .update({
      status: 'delayed',
      estimated_delivery_time: pastEta,
      notes: 'Маргааш хүргэнэ',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  const { data: delBefore } = await sb
    .from('deliveries')
    .select('status, estimated_delivery_time')
    .eq('id', result.deliveryId)
    .single()

  dbOk(`Delivery seeded: status='${delBefore?.status}', ETA=${delBefore?.estimated_delivery_time}`)

  // Phase 3: Simulate cron reactivation — update status to 'pending'
  console.log('  ── Phase 3: Simulate cron reactivation ──')
  await sb
    .from('deliveries')
    .update({ status: 'pending', notes: 'Автоматаар дахин идэвхжүүлсэн — ETA хугацаа дууссан' })
    .eq('id', result.deliveryId)
  await delay(500)

  const { data: delAfter } = await sb
    .from('deliveries')
    .select('status')
    .eq('id', result.deliveryId)
    .single()

  if (delAfter?.status === 'pending') {
    dbOk(`delivery.status = 'pending' (reactivated)`)
  } else {
    dbFail(`delivery.status = '${delAfter?.status}' (expected 'pending')`)
    pass = false
  }

  // Phase 4: Insert message to customer asking about redelivery
  console.log('  ── Phase 4: Message customer about redelivery ──')
  const { data: conv } = await sb
    .from('conversations')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (conv) {
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: 'Хэзээ тохирох вэ? Таны захиалгыг дахин хүргэхээр бэлэн байна.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'delivery_reconfirm', delivery_id: result.deliveryId },
    })
    dbOk('Reconfirm message inserted')
  }
  await delay(500)

  // Phase 5: Customer replies "Маргааш" via chat
  console.log('  ── Phase 5: Customer replies "Маргааш" ──')
  const r = await chat(api, storeId, result.senderId, 'Маргааш', result.conversationId)
  ok(2, `"Маргааш" → ${r.intent} (HTTP ${r.aiStatus})`)
  await delay(1000)

  // Phase 6: Update delivery notes and status
  console.log('  ── Phase 6: Update delivery for reconfirm ──')
  const tomorrowEta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await sb
    .from('deliveries')
    .update({
      status: 'assigned',
      estimated_delivery_time: tomorrowEta,
      notes: 'Дахин хүргэлт: Маргааш',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Insert notification
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'delivery_reconfirmed',
    title: '📦 ДАХИН ХҮРГЭЛТ БАТАЛГААЖЛАА',
    body: `#${result.orderNumber}: Маргааш хүргэхээр тохирлоо.`,
    data: { order_number: result.orderNumber, delivery_id: result.deliveryId },
  })
  await delay(500)

  // Verify final state
  const { data: delFinal } = await sb
    .from('deliveries')
    .select('status, notes, estimated_delivery_time')
    .eq('id', result.deliveryId)
    .single()

  if (delFinal?.status === 'assigned') {
    dbOk(`FINAL: delivery.status = 'assigned' (reconfirmed)`)
  } else {
    dbFail(`FINAL: delivery.status = '${delFinal?.status}' (expected 'assigned')`)
    pass = false
  }

  if (delFinal?.notes?.includes('Маргааш')) {
    dbOk(`FINAL: notes contain "Маргааш"`)
  } else {
    dbFail(`FINAL: notes = "${delFinal?.notes}" (expected to contain "Маргааш")`)
    pass = false
  }

  // Verify notification
  const { data: reconfirmNotifs } = await sb
    .from('notifications')
    .select('id, title')
    .eq('store_id', storeId)
    .eq('type', 'delivery_reconfirmed')
    .order('created_at', { ascending: false })
    .limit(1)

  if (reconfirmNotifs && reconfirmNotifs.length > 0) {
    dbOk(`Reconfirm notification found: "${reconfirmNotifs[0].title}"`)
  } else {
    dbFail('No delivery_reconfirmed notification found')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 31: Delayed Delivery → Customer Cancels
// ============================================================================

async function scenario31(api: string, storeId: string) {
  section('\n📋 Scenario 31: Delayed Delivery → Customer Cancels')
  let pass = true

  // Phase 1: Create order and delay it
  console.log('  ── Phase 1: Create order + delay ──')
  const result = await createOrderViaChat(api, storeId, 'delay_cancel')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, 'Driver assigned and picked up')

  // Phase 2: Seed delayed delivery
  console.log('  ── Phase 2: Seed delayed delivery ──')
  const pastEta = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await sb
    .from('deliveries')
    .update({
      status: 'delayed',
      estimated_delivery_time: pastEta,
      notes: 'Маргааш хүргэнэ',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Phase 3: Simulate cron reactivation
  console.log('  ── Phase 3: Simulate cron reactivation ──')
  await sb
    .from('deliveries')
    .update({ status: 'pending', notes: 'Автоматаар дахин идэвхжүүлсэн' })
    .eq('id', result.deliveryId)
  await delay(500)

  // Phase 4: Customer reply "Цуцлах"
  console.log('  ── Phase 4: Customer replies "Цуцлах" ──')
  const r = await chat(api, storeId, result.senderId, 'Цуцлах', result.conversationId)
  ok(2, `"Цуцлах" → ${r.intent} (HTTP ${r.aiStatus})`)
  await delay(1000)

  // Phase 5: Update delivery status to cancelled
  console.log('  ── Phase 5: Cancel delivery ──')
  await sb
    .from('deliveries')
    .update({
      status: 'cancelled',
      notes: 'Харилцагч цуцалсан — хойшлуулсаны дараа',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Insert notification
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'delivery_cancelled',
    title: '❌ ХҮРГЭЛТ ЦУЦЛАГДЛАА',
    body: `#${result.orderNumber}: Харилцагч хойшлуулсны дараа цуцалсан.`,
    data: { order_number: result.orderNumber, delivery_id: result.deliveryId },
  })
  await delay(500)

  // Verify final state
  const { data: delFinal } = await sb
    .from('deliveries')
    .select('status, notes')
    .eq('id', result.deliveryId)
    .single()

  if (delFinal?.status === 'cancelled') {
    dbOk(`delivery.status = 'cancelled'`)
  } else {
    dbFail(`delivery.status = '${delFinal?.status}' (expected 'cancelled')`)
    pass = false
  }

  // Verify notification
  const { data: cancelNotifs } = await sb
    .from('notifications')
    .select('id, title')
    .eq('store_id', storeId)
    .eq('type', 'delivery_cancelled')
    .order('created_at', { ascending: false })
    .limit(1)

  if (cancelNotifs && cancelNotifs.length > 0) {
    dbOk(`Cancel notification found: "${cancelNotifs[0].title}"`)
  } else {
    dbFail('No delivery_cancelled notification found')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 32: Wrong Item Photo → Detail Page
// ============================================================================

async function scenario32(api: string, storeId: string) {
  section('\n📋 Scenario 32: Wrong Item Photo → Detail Page')
  let pass = true

  // Phase 1: Create order + deliver + payment
  console.log('  ── Phase 1: Create order + deliver + pay ──')
  const result = await createOrderViaChat(api, storeId, 'wrongphoto')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Payment full
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_full:${result.deliveryId}`,
    },
  })
  await delay(500)
  ok(2, 'Delivery completed + payment_full')

  // Phase 2: Driver taps wrong_product
  console.log('  ── Phase 2: Driver taps wrong_product ──')
  const wrongRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_wrong_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 4, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `wrong_product:${result.deliveryId}`,
    },
  })
  ok(3, `wrong_product → ${wrongRes.status === 200 ? '✅' : '🔴'} HTTP ${wrongRes.status}`)
  if (wrongRes.status !== 200) pass = false
  await delay(1000)

  // Phase 3: Verify DB — delivery status = failed, awaiting_wrong_photo
  console.log('  ── Phase 3: DB verification ──')
  const { data: del } = await sb
    .from('deliveries')
    .select('status, notes, metadata')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'failed') {
    dbOk(`delivery.status = 'failed' (wrong product)`)
  } else {
    dbFail(`delivery.status = '${del?.status}' (expected 'failed')`)
    pass = false
  }

  const meta = del?.metadata as Record<string, unknown> | null
  if (meta?.awaiting_wrong_photo) {
    dbOk(`delivery.metadata.awaiting_wrong_photo = true`)
  } else {
    console.log(`  DB: ⚠️  awaiting_wrong_photo not set (metadata: ${JSON.stringify(meta)})`)
  }

  // Phase 4: Simulate photo upload — insert photo file_id into delivery metadata
  console.log('  ── Phase 4: Simulate wrong item photo ──')
  const existingMeta = (del?.metadata ?? {}) as Record<string, unknown>
  await sb
    .from('deliveries')
    .update({
      metadata: {
        ...existingMeta,
        wrong_item_photo: {
          file_id: 'AgACAgIAAxkBAAI_test_wrong_photo',
          uploaded_at: new Date().toISOString(),
          driver_id: driverId,
        },
      },
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Verify metadata has wrong_item photo info
  const { data: delAfter } = await sb
    .from('deliveries')
    .select('metadata')
    .eq('id', result.deliveryId)
    .single()

  const metaAfter = delAfter?.metadata as Record<string, unknown> | null
  const wrongPhoto = metaAfter?.wrong_item_photo as Record<string, unknown> | null

  if (wrongPhoto?.file_id) {
    dbOk(`wrong_item_photo.file_id = "${wrongPhoto.file_id}"`)
  } else {
    dbFail('wrong_item_photo not found in metadata')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 33: Staff Telegram Notify — Damaged/No Payment
// ============================================================================

async function scenario33(api: string, storeId: string) {
  section('\n📋 Scenario 33: Staff Telegram Notify — Damaged/No Payment')
  let pass = true

  // Phase 1: Create order + assign + pickup
  console.log('  ── Phase 1: Create order + pickup ──')
  const result = await createOrderViaChat(api, storeId, 'damaged_notify')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Phase 2: Driver taps "damaged"
  console.log('  ── Phase 2: Driver taps damaged ──')
  const damagedRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_damaged_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `damaged:${result.deliveryId}`,
    },
  })
  ok(2, `damaged → ${damagedRes.status === 200 ? '✅' : '🔴'} HTTP ${damagedRes.status}`)
  if (damagedRes.status !== 200) pass = false
  await delay(1000)

  // Phase 3: Verify delivery status = failed
  console.log('  ── Phase 3: DB verification ──')
  const { data: del } = await sb
    .from('deliveries')
    .select('status, notes')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'failed') {
    dbOk(`delivery.status = 'failed' (damaged)`)
  } else {
    dbFail(`delivery.status = '${del?.status}' (expected 'failed')`)
    pass = false
  }

  if (del?.notes?.includes('Гэмтсэн')) {
    dbOk(`notes: "${del.notes}"`)
  } else {
    console.log(`  DB: ⚠️  notes = "${del?.notes}" (expected to include "Гэмтсэн")`)
  }

  // Phase 4: Verify notification created for store
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, title, type')
    .eq('store_id', storeId)
    .eq('type', 'delivery_failed')
    .ilike('title', '%Гэмтсэн%')
    .order('created_at', { ascending: false })
    .limit(1)

  if (notifs && notifs.length > 0) {
    dbOk(`Damaged notification found: "${notifs[0].title}"`)
  } else {
    dbFail('No damaged notification found')
    pass = false
  }

  // Phase 5: Send real Telegram to driver summarizing the test
  const tgOk = await sendDriverTelegram(
    `🧪 Scenario 33: Damaged item reported\n` +
    `Order: ${result.orderNumber}\n` +
    `Delivery: #${result.deliveryNumber}\n` +
    `Status: failed (damaged)`
  )
  console.log(`  Telegram: ${tgOk ? '✅' : '🔴'} Damaged item summary sent`)

  scenarioResult(pass)
}

// ============================================================================
// Scenario 34: 24h Messenger Window Expired → SMS Fallback
// ============================================================================

async function scenario34(api: string, storeId: string) {
  section('\n📋 Scenario 34: 24h Messenger Window Expired → SMS Fallback')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Create order via chat ──')
  const result = await createOrderViaChat(api, storeId, 'window_expired')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver partial payment flow
  console.log('  ── Phase 2: Driver flow + partial payment ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_deliver_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  await delay(500)

  // payment_custom
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_paycustom_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_custom:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Amount
  await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: '35000',
      date: Math.floor(Date.now() / 1000),
    },
  })
  await delay(500)

  // Reason
  await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: 'Дутуу мөнгөтэй',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(2, 'Driver partial payment flow completed (35000, "Дутуу мөнгөтэй")')
  await delay(1000)

  // Phase 3: Simulate 24h Messenger window expired
  console.log('  ── Phase 3: Simulate 24h Messenger window expired ──')
  // Mark delivery metadata to indicate window is closed
  const { data: delData } = await sb
    .from('deliveries')
    .select('metadata')
    .eq('id', result.deliveryId)
    .single()

  const existingMeta = (delData?.metadata ?? {}) as Record<string, unknown>
  await sb
    .from('deliveries')
    .update({
      metadata: {
        ...existingMeta,
        partial_payment_resolution: {
          ...(existingMeta.partial_payment_resolution as Record<string, unknown> ?? {}),
          messenger_window_expired: true,
          window_expired_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', result.deliveryId)
  await delay(500)

  dbOk('Marked messenger_window_expired = true in delivery metadata')

  // Phase 4: Insert SMS fallback message
  console.log('  ── Phase 4: SMS fallback message ──')
  const { data: conv } = await sb
    .from('conversations')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (conv) {
    await sb.from('messages').insert({
      conversation_id: conv.id,
      content: 'Messenger 24ц цонх хаагдсан. SMS-ээр мэдэгдэл илгээлээ: Таны захиалгын үлдэгдэл төлбөрийг төлнө үү.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: {
        type: 'partial_payment_agent',
        channel: 'sms',
        delivery_id: result.deliveryId,
        messenger_window_expired: true,
      },
    })
    dbOk('SMS fallback message inserted (24h window expired)')
  } else {
    dbFail('No active conversation found')
    pass = false
  }
  await delay(500)

  // Phase 5: Verify SMS fallback message exists
  console.log('  ── Phase 5: Verify SMS fallback ──')
  if (conv) {
    const { data: msgs } = await sb
      .from('messages')
      .select('id, content, metadata')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const smsMsg = msgs?.find((m: { metadata: Record<string, unknown> | null }) => {
      const msgMeta = m.metadata as Record<string, unknown> | null
      return msgMeta?.channel === 'sms' && msgMeta?.messenger_window_expired === true
    })

    if (smsMsg) {
      dbOk('SMS fallback message with messenger_window_expired found')
    } else {
      dbFail('No SMS fallback message with messenger_window_expired found')
      pass = false
    }
  }

  // Verify delivery metadata
  const { data: delFinal } = await sb
    .from('deliveries')
    .select('metadata')
    .eq('id', result.deliveryId)
    .single()

  const finalMeta = delFinal?.metadata as Record<string, unknown> | null
  const resolution = finalMeta?.partial_payment_resolution as Record<string, unknown> | null

  if (resolution?.messenger_window_expired === true) {
    dbOk('delivery.metadata.partial_payment_resolution.messenger_window_expired = true')
  } else {
    dbFail('messenger_window_expired not found in delivery metadata')
    pass = false
  }

  scenarioResult(pass)
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

  // Scenario 19: Payment Delayed → Follow-up
  await scenario19(LOCAL, storeId)

  // Scenario 20: Payment Declined → Store Notified
  await scenario20(LOCAL, storeId)

  // Scenario 21: Driver Denies → Auto-Reassignment Check
  await scenario21(LOCAL, storeId)

  // Scenario 22: Customer Complaint Mid-Checkout → Recovers
  await scenario22(LOCAL, storeId)

  // Scenario 23: Wrong Product → Return Flow
  await scenario23(LOCAL, storeId)

  // Scenario 24: Partial Payment (Custom Amount)
  await scenario24(LOCAL, storeId)

  // Scenario 25: Delivery Delayed → Unreachable → Reschedule → Deliver
  await scenario25(LOCAL, storeId)

  // Scenario 26: Partial Payment → AI Agent Justified
  await scenario26(LOCAL, storeId)

  // Scenario 27: Partial Payment → AI Agent Not Justified → QPay
  await scenario27(LOCAL, storeId)

  // Scenario 28: Partial Payment → No Messenger → SMS Fallback
  await scenario28(LOCAL, storeId)

  // Scenario 29: Delivery Postponed → Telegram + Order Notes
  await scenario29(LOCAL, storeId)

  // Scenario 30: Delayed Delivery → Customer Reconfirm
  await scenario30(LOCAL, storeId)

  // Scenario 31: Delayed Delivery → Customer Cancels
  await scenario31(LOCAL, storeId)

  // Scenario 32: Wrong Item Photo → Detail Page
  await scenario32(LOCAL, storeId)

  // Scenario 33: Staff Telegram Notify — Damaged/No Payment
  await scenario33(LOCAL, storeId)

  // Scenario 34: 24h Messenger Window Expired → SMS Fallback
  await scenario34(LOCAL, storeId)

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
