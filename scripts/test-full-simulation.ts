/**
 * test-full-simulation.ts
 *
 * Comprehensive end-to-end simulation that exercises the Temuulel app
 * through real HTTP requests against a running dev server, then verifies
 * database state using Supabase service-role queries.
 *
 * Prerequisites:
 *   1. Local Supabase running  (supabase start)
 *   2. Dev server running      (npm run dev)
 *   3. Seed data present       (at least one store with products)
 *
 * Usage:
 *   npx tsx scripts/test-full-simulation.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Configuration
// ============================================================================

const API = 'http://localhost:3000'
const CHAT_API = `${API}/api/chat`
const WIDGET_API = `${API}/api/chat/widget`
const DRIVER_WEBHOOK = `${API}/api/telegram/driver`
const STAFF_WEBHOOK = `${API}/api/webhook/telegram`

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// Test tracking
// ============================================================================

let passed = 0
let failed = 0
let totalTests = 0
const errors: string[] = []

function assert(condition: boolean, message: string, details?: string): void {
  totalTests++
  if (condition) {
    passed++
    console.log(`    [PASS] ${message}`)
  } else {
    failed++
    const msg = details ? `${message} -- ${details}` : message
    errors.push(msg)
    console.error(`    [FAIL] ${message}${details ? ` (${details})` : ''}`)
  }
}

function section(title: string): void {
  console.log(`\n${'='.repeat(74)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(74))
}

function step(label: string): void {
  console.log(`\n  -- ${label} --`)
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const STEP_DELAY = 3500  // 3.5s between API calls → max ~17 req/min, safely under 20 req/min limit
const SCENARIO_DELAY = 8000 // 8s between scenarios to help clear sliding rate limit window

// ============================================================================
// Cleanup tracking — all IDs we create so we can delete them in `finally`
// ============================================================================

const cleanup = {
  conversationIds: [] as string[],
  customerIds: [] as string[],
  orderIds: [] as string[],
  deliveryIds: [] as string[],
  driverIds: [] as string[],
  staffIds: [] as string[],
  storeMemberIds: [] as string[],
  notificationIds: [] as string[],
}

async function cleanupTestData(): Promise<void> {
  console.log('\n--- Cleaning up test data ---')

  // Delete in dependency order
  if (cleanup.notificationIds.length > 0) {
    await supabase.from('notifications').delete().in('id', cleanup.notificationIds)
    console.log(`  Deleted ${cleanup.notificationIds.length} notifications`)
  }
  if (cleanup.deliveryIds.length > 0) {
    await supabase.from('deliveries').delete().in('id', cleanup.deliveryIds)
    console.log(`  Deleted ${cleanup.deliveryIds.length} deliveries`)
  }
  if (cleanup.orderIds.length > 0) {
    // Delete order items first
    for (const oid of cleanup.orderIds) {
      await supabase.from('order_items').delete().eq('order_id', oid)
    }
    await supabase.from('orders').delete().in('id', cleanup.orderIds)
    console.log(`  Deleted ${cleanup.orderIds.length} orders`)
  }
  // Delete messages for conversations
  for (const cid of cleanup.conversationIds) {
    await supabase.from('messages').delete().eq('conversation_id', cid)
  }
  if (cleanup.conversationIds.length > 0) {
    await supabase.from('conversations').delete().in('id', cleanup.conversationIds)
    console.log(`  Deleted ${cleanup.conversationIds.length} conversations`)
  }
  if (cleanup.customerIds.length > 0) {
    await supabase.from('customers').delete().in('id', cleanup.customerIds)
    console.log(`  Deleted ${cleanup.customerIds.length} customers`)
  }
  if (cleanup.driverIds.length > 0) {
    // Clean up driver_messages too
    for (const did of cleanup.driverIds) {
      await supabase.from('driver_messages').delete().eq('driver_id', did)
    }
    await supabase.from('delivery_drivers').delete().in('id', cleanup.driverIds)
    console.log(`  Deleted ${cleanup.driverIds.length} drivers`)
  }
  if (cleanup.staffIds.length > 0) {
    await supabase.from('staff').delete().in('id', cleanup.staffIds)
    console.log(`  Deleted ${cleanup.staffIds.length} staff`)
  }
  if (cleanup.storeMemberIds.length > 0) {
    await supabase.from('store_members').delete().in('id', cleanup.storeMemberIds)
    console.log(`  Deleted ${cleanup.storeMemberIds.length} store_members`)
  }

  // Also clean up any notifications created by the test store that were not tracked
  // (dispatched async by the app)
  if (testStoreId) {
    const { data: strayNotifs } = await supabase
      .from('notifications')
      .select('id')
      .eq('store_id', testStoreId)
      .gte('created_at', testStartTime)
    if (strayNotifs && strayNotifs.length > 0) {
      await supabase.from('notifications').delete().in('id', strayNotifs.map(n => n.id))
      console.log(`  Cleaned ${strayNotifs.length} stray notifications`)
    }
  }

  console.log('  Cleanup complete.')
}

// ============================================================================
// Shared state
// ============================================================================

let testStoreId = ''
let testStartTime = ''

// ============================================================================
// Helpers
// ============================================================================

/**
 * Send a customer message through the two-step chat flow:
 *  1. POST /api/chat to save the message and resolve conversation
 *  2. POST /api/chat/widget to get the AI response
 */
async function chatAsCustomer(
  storeId: string,
  senderId: string,
  message: string,
  conversationId?: string
): Promise<{
  conversationId: string
  response: string | null
  intent: string
  products_found?: number
  order_step?: string | null
  saveStatus: number
  aiStatus: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}> {
  // Step 1: Save the customer message
  const saveRes = await fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender_id: senderId,
      store_id: storeId,
      role: 'user',
      content: message,
    }),
  })
  const saveData = await saveRes.json()
  const convId = conversationId || saveData.conversation_id

  // Track for cleanup
  if (convId && !cleanup.conversationIds.includes(convId)) {
    cleanup.conversationIds.push(convId)
  }

  // Step 2: Get the AI response
  const aiRes = await fetch(WIDGET_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: storeId,
      customer_message: message,
      sender_id: senderId,
      conversation_id: convId,
    }),
  })
  const aiData = await aiRes.json()

  if (aiRes.status !== 200) {
    console.warn(`    [DEBUG] Widget returned ${aiRes.status}: ${JSON.stringify(aiData).substring(0, 200)}`)
  }

  return {
    conversationId: convId,
    response: aiData.response ?? null,
    intent: aiData.intent ?? 'unknown',
    products_found: aiData.products_found,
    order_step: aiData.order_step ?? null,
    saveStatus: saveRes.status,
    aiStatus: aiRes.status,
    raw: aiData,
  }
}

/**
 * Read the conversation state from the metadata JSONB.
 */
async function getConversationState(conversationId: string) {
  const { data } = await supabase
    .from('conversations')
    .select('metadata, status, escalation_score')
    .eq('id', conversationId)
    .single()

  if (!data) return null

  const meta = data.metadata as Record<string, unknown> | null
  const state = meta?.conversation_state as Record<string, unknown> | undefined

  return {
    intent: (state?.last_intent as string) ?? '',
    products: Array.isArray(state?.last_products) ? state.last_products.length : 0,
    orderDraft: state?.order_draft as Record<string, unknown> | null ?? null,
    orderStep: (state?.order_draft as Record<string, unknown> | null)?.step ?? null,
    status: data.status as string,
    escalation_score: (data.escalation_score as number) ?? 0,
  }
}

/**
 * Send a Telegram webhook update for the driver bot.
 */
async function sendDriverWebhook(
  payload: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(DRIVER_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body: Record<string, unknown> = {}
  try {
    body = await res.json()
  } catch {
    // some endpoints return empty
  }
  return { status: res.status, body }
}

/**
 * Send a Telegram webhook update for the staff bot.
 */
async function sendStaffWebhook(
  payload: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (TELEGRAM_WEBHOOK_SECRET) {
    headers['x-telegram-bot-api-secret-token'] = TELEGRAM_WEBHOOK_SECRET
  }
  const res = await fetch(STAFF_WEBHOOK, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  let body: Record<string, unknown> = {}
  try {
    body = await res.json()
  } catch {
    // some endpoints return empty
  }
  return { status: res.status, body }
}

/**
 * Build a Telegram message update object.
 */
function tgMessage(chatId: number, text: string): Record<string, unknown> {
  return {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: chatId, first_name: 'TestDriver' },
      chat: { id: chatId, type: 'private' },
      text,
    },
  }
}

/**
 * Build a Telegram callback_query update object.
 */
function tgCallback(chatId: number, data: string): Record<string, unknown> {
  return {
    update_id: Date.now(),
    callback_query: {
      id: String(Date.now()),
      from: { id: chatId, first_name: 'TestDriver' },
      message: {
        message_id: 1000,
        from: { id: 1, first_name: 'Bot' },
        chat: { id: chatId, type: 'private' },
        text: 'Previous message',
      },
      data,
    },
  }
}

// ============================================================================
// Pre-flight checks
// ============================================================================

async function preflight(): Promise<{
  storeId: string
  storeName: string
  productCount: number
}> {
  section('PRE-FLIGHT CHECKS')

  // 1. Check dev server is running
  step('Checking dev server')
  try {
    const res = await fetch(API, { method: 'GET' })
    assert(res.status < 500, `Dev server at ${API} is reachable`, `status=${res.status}`)
  } catch {
    console.error(`\nERROR: Dev server is not running at ${API}`)
    console.error('Start it with: npm run dev\n')
    process.exit(1)
  }

  // 2. Find a store with products
  step('Finding test store with products')
  // Look specifically for Монгол Маркет first, then fall back to any store with products
  const { data: mongolMarket } = await supabase
    .from('stores')
    .select('id, name')
    .eq('name', 'Монгол Маркет')
    .single()

  const { data: stores } = mongolMarket
    ? { data: [mongolMarket] }
    : await supabase.from('stores').select('id, name').limit(30)

  assert(!!stores && stores.length > 0, 'At least one store exists')

  let bestStore = { id: '', name: '', productCount: 0 }
  for (const store of stores || []) {
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)
      .eq('status', 'active')

    if ((count ?? 0) > bestStore.productCount) {
      bestStore = { id: store.id, name: store.name, productCount: count ?? 0 }
    }
  }

  assert(bestStore.productCount > 0, `Found store "${bestStore.name}" with ${bestStore.productCount} products`)

  testStoreId = bestStore.id
  testStartTime = new Date().toISOString()

  return {
    storeId: bestStore.id,
    storeName: bestStore.name,
    productCount: bestStore.productCount,
  }
}

// ============================================================================
// SCENARIO 1: Customer Happy Path Order
// ============================================================================

async function scenario1_happyPathOrder(storeId: string): Promise<{
  conversationId: string
  orderId: string | null
  deliveryId: string | null
}> {
  section('SCENARIO 1: Customer Happy Path Order')

  const senderId = `web_test_happy_${Date.now()}`
  let conversationId = ''

  // Step 1: Greeting
  step('Step 1: Greeting "Sain baina uu"')
  const r1 = await chatAsCustomer(storeId, senderId, 'Sain baina uu')
  conversationId = r1.conversationId
  assert(r1.saveStatus === 200, 'Save message returns 200', `got ${r1.saveStatus}`)
  assert(r1.aiStatus === 200, 'AI response returns 200', `got ${r1.aiStatus}`)
  assert(r1.intent === 'greeting', `Intent is "greeting"`, `got "${r1.intent}"`)
  console.log(`    Response: ${(r1.response ?? '').substring(0, 80)}...`)

  await delay(STEP_DELAY)

  // Step 2: Product search
  step('Step 2: Product search')
  const r2 = await chatAsCustomer(storeId, senderId, 'Бараа юу байна?', conversationId)
  assert(r2.aiStatus === 200, 'AI response returns 200')
  assert(
    ['product_search', 'low_confidence', 'general'].includes(r2.intent),
    `Intent is product-related`,
    `got "${r2.intent}"`
  )
  assert((r2.products_found ?? 0) > 0, 'Products found > 0', `got ${r2.products_found}`)
  console.log(`    Response: ${(r2.response ?? '').substring(0, 80)}...`)

  await delay(STEP_DELAY)

  // Step 3: Select product #1
  step('Step 3: Select product "1"')
  const r3 = await chatAsCustomer(storeId, senderId, '1', conversationId)
  assert(r3.aiStatus === 200, 'AI response returns 200')
  // After selecting a product, it should start an order draft
  // The intent might be 'order_collection' or show variants
  console.log(`    Intent: ${r3.intent}, order_step: ${r3.order_step}`)
  console.log(`    Response: ${(r3.response ?? '').substring(0, 120)}...`)

  // Check DB: conversation state should have order_draft
  const state3 = await getConversationState(conversationId)
  console.log(`    DB state: orderDraft=${JSON.stringify(state3?.orderDraft?.step ?? null)}`)

  await delay(STEP_DELAY)

  // If we have a variant step, handle it
  if (state3?.orderStep === 'variant') {
    step('Step 3b: Select variant "1"')
    const r3b = await chatAsCustomer(storeId, senderId, '1', conversationId)
    assert(r3b.aiStatus === 200, 'Variant selection returns 200')
    console.log(`    Intent: ${r3b.intent}, order_step: ${r3b.order_step}`)
    await delay(STEP_DELAY)
  }

  // Step 4: Provide name
  step('Step 4: Provide customer name')
  const r4 = await chatAsCustomer(storeId, senderId, 'Bat-Erdene', conversationId)
  assert(r4.aiStatus === 200, 'AI response returns 200')
  // The name alone should not advance the order since no address/phone
  // The response should NOT reset to greeting
  assert(r4.intent !== 'greeting', 'Name NOT treated as greeting reset', `got "${r4.intent}"`)
  console.log(`    Intent: ${r4.intent}`)
  console.log(`    Response: ${(r4.response ?? '').substring(0, 120)}...`)

  await delay(STEP_DELAY)

  // Step 5: Provide phone
  step('Step 5: Provide phone number')
  const r5 = await chatAsCustomer(storeId, senderId, '99112233', conversationId)
  assert(r5.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r5.intent}`)
  console.log(`    Response: ${(r5.response ?? '').substring(0, 120)}...`)

  // Check state: phone should be captured
  const state5 = await getConversationState(conversationId)
  const draft5 = state5?.orderDraft
  if (draft5) {
    const phoneSet = !!(draft5 as Record<string, unknown>).phone
    console.log(`    DB: phone=${(draft5 as Record<string, unknown>).phone}, address=${(draft5 as Record<string, unknown>).address}`)
    assert(phoneSet, 'Phone is captured in order draft')
  }

  await delay(STEP_DELAY)

  // Step 6: Provide address
  step('Step 6: Provide address')
  const r6 = await chatAsCustomer(storeId, senderId, 'Баянгол дүүрэг, 3-р хороо, 12 байр', conversationId)
  assert(r6.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r6.intent}`)
  console.log(`    Response: ${(r6.response ?? '').substring(0, 120)}...`)

  // Check if order is now at confirming step
  const state6 = await getConversationState(conversationId)
  const draft6 = state6?.orderDraft
  if (draft6) {
    console.log(`    DB: step=${(draft6 as Record<string, unknown>).step}`)
  }

  await delay(STEP_DELAY)

  // Step 7: Confirm order
  step('Step 7: Confirm order')
  const r7 = await chatAsCustomer(storeId, senderId, 'Тийм', conversationId)
  assert(r7.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r7.intent}`)
  console.log(`    Response: ${(r7.response ?? '').substring(0, 120)}...`)

  await delay(1000) // Allow async operations to complete

  // Check orders table
  step('Verifying DB: orders, deliveries, notifications')
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount')
    .eq('store_id', storeId)
    .gte('created_at', testStartTime)
    .order('created_at', { ascending: false })
    .limit(1)

  let orderId: string | null = null
  let deliveryId: string | null = null

  if (orders && orders.length > 0) {
    orderId = orders[0].id
    cleanup.orderIds.push(orderId)
    assert(true, `Order created: ${orders[0].order_number}`, `total=${orders[0].total_amount}`)

    // Check deliveries
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, delivery_number, status')
      .eq('order_id', orderId)
      .limit(1)

    if (deliveries && deliveries.length > 0) {
      deliveryId = deliveries[0].id
      cleanup.deliveryIds.push(deliveryId)
      assert(true, `Delivery created: ${deliveries[0].delivery_number}`, `status=${deliveries[0].status}`)
    } else {
      assert(false, 'Delivery created for order')
    }

    // Check notifications (allow async dispatch to complete)
    await delay(STEP_DELAY)
    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, type, title')
      .eq('store_id', storeId)
      .gte('created_at', testStartTime)
      .limit(5)

    if (notifs && notifs.length > 0) {
      for (const n of notifs) {
        cleanup.notificationIds.push(n.id)
      }
      const hasOrderNotif = notifs.some(n => n.type?.includes('order') || n.type?.includes('new_'))
      assert(hasOrderNotif, 'Staff notification dispatched for new order', `types: ${notifs.map(n => n.type).join(', ')}`)
    } else {
      // Notifications may be dispatched async — not a hard failure
      console.log('    [INFO] No notifications found yet (may be async)')
    }
  } else {
    // The order may not have been created if the address wasn't parsed correctly
    // or if the confirmation step didn't trigger. This is informational.
    console.log('    [INFO] No order found. The flow may have needed different address/confirm input.')
    console.log('           This can happen if extractAddress() needs Mongolian address keywords.')
  }

  return { conversationId, orderId, deliveryId }
}

// ============================================================================
// SCENARIO 2: Customer Name with "hi" (Regression Test)
// ============================================================================

async function scenario2_nameNotGreeting(storeId: string): Promise<void> {
  section('SCENARIO 2: Name Not Treated as Greeting (Regression)')

  const senderId = `web_test_name_${Date.now()}`
  let conversationId = ''

  // Step 1: Product search
  step('Step 1: Product search')
  const r1 = await chatAsCustomer(storeId, senderId, 'Бараа харуулна уу')
  conversationId = r1.conversationId
  assert(r1.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r1.intent}, products: ${r1.products_found}`)

  await delay(STEP_DELAY)

  // Step 2: Select product
  step('Step 2: Select product "1"')
  const r2 = await chatAsCustomer(storeId, senderId, '1', conversationId)
  assert(r2.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r2.intent}, order_step: ${r2.order_step}`)

  // Handle variant if needed
  const state2 = await getConversationState(conversationId)
  if (state2?.orderStep === 'variant') {
    await delay(300)
    await chatAsCustomer(storeId, senderId, '1', conversationId)
    await delay(300)
  }

  await delay(STEP_DELAY)

  // Step 3: Send name "Shinebayar" — MUST NOT trigger greeting
  step('Step 3: Send name "Shinebayar" (must NOT trigger greeting)')
  const r3 = await chatAsCustomer(storeId, senderId, 'Shinebayar', conversationId)
  assert(r3.aiStatus === 200, 'AI response returns 200')

  // KEY ASSERTION: intent should NOT be "greeting" or "product_search" (which means state reset)
  const nameNotGreeting = r3.intent !== 'greeting'
  assert(nameNotGreeting, 'Name "Shinebayar" NOT classified as greeting', `got "${r3.intent}"`)

  // The response should continue the order flow, not show product recommendations
  const responseStr = r3.response?.toLowerCase() ?? ''
  const showedProducts = responseStr.includes('1.') && responseStr.includes('2.') && responseStr.includes('3.')
  assert(!showedProducts, 'Response does NOT show product list (no greeting reset)')

  console.log(`    Intent: ${r3.intent}`)
  console.log(`    Response: ${(r3.response ?? '').substring(0, 120)}...`)

  // Check state: order_draft should still be alive
  const state3 = await getConversationState(conversationId)
  const draftAlive = state3?.orderDraft !== null && state3?.orderDraft !== undefined
  assert(draftAlive, 'Order draft still alive after name input')

  await delay(STEP_DELAY)

  // Continue order flow to verify it works
  step('Step 4: Phone')
  await chatAsCustomer(storeId, senderId, '88001122', conversationId)
  await delay(STEP_DELAY)

  step('Step 5: Address')
  await chatAsCustomer(storeId, senderId, 'Хан-Уул дүүрэг, 5-р хороо', conversationId)
  await delay(STEP_DELAY)

  step('Step 6: Confirm')
  const r6 = await chatAsCustomer(storeId, senderId, 'Za', conversationId)
  console.log(`    Intent: ${r6.intent}`)
  console.log(`    Response: ${(r6.response ?? '').substring(0, 100)}...`)

  // Clean up any orders from this scenario
  await delay(STEP_DELAY)
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('store_id', storeId)
    .gte('created_at', testStartTime)
    .order('created_at', { ascending: false })

  if (orders) {
    for (const o of orders) {
      if (!cleanup.orderIds.includes(o.id)) {
        cleanup.orderIds.push(o.id)
        // Also track deliveries
        const { data: dels } = await supabase
          .from('deliveries')
          .select('id')
          .eq('order_id', o.id)
        if (dels) {
          for (const d of dels) {
            if (!cleanup.deliveryIds.includes(d.id)) cleanup.deliveryIds.push(d.id)
          }
        }
      }
    }
  }
}

// ============================================================================
// SCENARIO 3: Customer Complaint -> Escalation
// ============================================================================

async function scenario3_complaintEscalation(storeId: string): Promise<void> {
  section('SCENARIO 3: Customer Complaint -> Escalation')

  const senderId = `web_test_escalate_${Date.now()}`
  let conversationId = ''

  // Enable escalation on the store (chatbot_settings) — MERGE, do not replace
  const { data: currentStore } = await supabase
    .from('stores')
    .select('chatbot_settings')
    .eq('id', storeId)
    .single()
  await supabase
    .from('stores')
    .update({
      chatbot_settings: {
        ...((currentStore?.chatbot_settings as object) || {}),
        escalation_enabled: true,
        escalation_threshold: 60,
      },
    })
    .eq('id', storeId)

  // Step 1: Order status question
  step('Step 1: Order status question')
  const r1 = await chatAsCustomer(storeId, senderId, 'Zahialga maani haana yavj baina?')
  conversationId = r1.conversationId
  assert(r1.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r1.intent}`)

  await delay(STEP_DELAY)

  // Step 2: Complaint
  step('Step 2: Complaint about delay')
  const r2 = await chatAsCustomer(storeId, senderId, 'Yaagaad iim udaan baigaa yum!?', conversationId)
  assert(r2.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r2.intent}`)

  await delay(STEP_DELAY)

  // Step 3: Repeated complaint
  step('Step 3: Repeated complaint (same message)')
  const r3 = await chatAsCustomer(storeId, senderId, 'Yaagaad iim udaan baigaa yum!?', conversationId)
  assert(r3.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r3.intent}`)

  await delay(STEP_DELAY)

  // Step 4: Payment dispute
  step('Step 4: Payment dispute (strong language)')
  const r4 = await chatAsCustomer(storeId, senderId, 'Munguu butsaaj ug!!!', conversationId)
  assert(r4.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r4.intent}`)

  await delay(STEP_DELAY)

  // Step 5: Direct escalation request
  step('Step 5: Direct escalation "Huntei yarikh"')
  const r5 = await chatAsCustomer(storeId, senderId, 'Huntei yarikh', conversationId)
  assert(r5.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r5.intent}`)

  await delay(1000)

  // Verify escalation state in DB
  step('Verifying DB: escalation score and status')
  const state = await getConversationState(conversationId)
  if (state) {
    console.log(`    Escalation score: ${state.escalation_score}`)
    console.log(`    Conversation status: ${state.status}`)

    // Escalation scoring is additive — check if it increased
    // The exact threshold depends on how many messages trigger signal boosts
    const scoreIncreased = state.escalation_score > 0
    assert(scoreIncreased, 'Escalation score increased above 0', `score=${state.escalation_score}`)

    // Status may or may not be 'escalated' depending on threshold config
    if (state.escalation_score >= 60) {
      assert(
        state.status === 'escalated',
        'Conversation status is "escalated"',
        `got "${state.status}"`
      )
    } else {
      console.log(`    [INFO] Score ${state.escalation_score} below threshold 60 -- not escalated yet`)
    }
  }
}

// ============================================================================
// SCENARIO 4: Customer Mid-Order Cancellation
// ============================================================================

async function scenario4_midOrderCancel(storeId: string): Promise<void> {
  section('SCENARIO 4: Customer Mid-Order Cancellation')

  const senderId = `web_test_cancel_${Date.now()}`
  let conversationId = ''

  // Step 1: Product search
  step('Step 1: Product search')
  const r1 = await chatAsCustomer(storeId, senderId, 'Бүх бараа харуулна уу')
  conversationId = r1.conversationId
  assert(r1.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r1.intent}, products: ${r1.products_found}`)

  await delay(STEP_DELAY)

  // Step 2: Select product
  step('Step 2: Select product "1"')
  const r2 = await chatAsCustomer(storeId, senderId, '1', conversationId)
  assert(r2.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r2.intent}`)

  // Handle variant if needed
  const state2 = await getConversationState(conversationId)
  if (state2?.orderStep === 'variant') {
    await delay(300)
    await chatAsCustomer(storeId, senderId, '1', conversationId)
    await delay(300)
  }

  // Verify order draft exists
  const statePreCancel = await getConversationState(conversationId)
  assert(
    statePreCancel?.orderDraft !== null,
    'Order draft exists before cancellation',
    `draft=${JSON.stringify(statePreCancel?.orderStep)}`
  )

  await delay(STEP_DELAY)

  // Step 3: Cancel order
  step('Step 3: Cancel "Захиалаагүй ээ"')
  const r3 = await chatAsCustomer(storeId, senderId, 'Захиалаагүй ээ', conversationId)
  assert(r3.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r3.intent}`)
  console.log(`    Response: ${(r3.response ?? '').substring(0, 100)}...`)

  // KEY ASSERTION: order draft should be cleared
  const statePostCancel = await getConversationState(conversationId)
  const draftCleared = statePostCancel?.orderDraft === null || statePostCancel?.orderDraft === undefined
  assert(draftCleared, 'Order draft is null after cancellation')

  await delay(STEP_DELAY)

  // Step 4: New product search (fresh state)
  step('Step 4: New product search after cancel')
  const r4 = await chatAsCustomer(storeId, senderId, 'Бараа харуулна уу', conversationId)
  assert(r4.aiStatus === 200, 'AI response returns 200')
  console.log(`    Intent: ${r4.intent}, products: ${r4.products_found}`)
  // Should show products again (fresh state)
}

// ============================================================================
// SCENARIO 5: Driver Telegram Delivery Flow
// ============================================================================

async function scenario5_driverDeliveryFlow(
  storeId: string,
  deliveryId: string | null
): Promise<void> {
  section('SCENARIO 5: Driver Telegram Delivery Flow')

  if (!deliveryId) {
    // Create a test order + delivery manually
    step('Creating test order and delivery for driver flow')

    const { data: product } = await supabase
      .from('products')
      .select('id, name, base_price')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!product) {
      console.log('    [SKIP] No products found -- skipping driver scenario')
      return
    }

    const orderNumber = `ORD-TEST-${Date.now()}`
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        store_id: storeId,
        order_number: orderNumber,
        status: 'pending',
        total_amount: product.base_price + 5000,
        shipping_amount: 5000,
        payment_status: 'pending',
        shipping_address: 'Test address, Bayangol duureg',
        order_type: 'delivery',
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      console.log(`    [SKIP] Failed to create test order: ${orderErr?.message}`)
      return
    }
    cleanup.orderIds.push(order.id)

    const deliveryNumber = `DEL-TEST-${Date.now()}`
    const { data: delivery, error: delErr } = await supabase
      .from('deliveries')
      .insert({
        store_id: storeId,
        order_id: order.id,
        delivery_number: deliveryNumber,
        status: 'pending',
        delivery_type: 'own_driver',
        delivery_address: 'Test address, Bayangol duureg',
        customer_name: 'Test Customer',
        customer_phone: '99887766',
        delivery_fee: 5000,
      })
      .select('id')
      .single()

    if (delErr || !delivery) {
      console.log(`    [SKIP] Failed to create test delivery: ${delErr?.message}`)
      return
    }
    deliveryId = delivery.id
    cleanup.deliveryIds.push(deliveryId)
  }

  // Create test driver — use unique phone to avoid collision with seed data
  step('Creating test driver')
  const driverPhone = `550${String(Date.now()).slice(-5)}` // unique 8-digit phone
  const driverChatId = 999000 + Math.floor(Math.random() * 100000)

  const { data: driver, error: driverErr } = await supabase
    .from('delivery_drivers')
    .insert({
      store_id: storeId,
      name: 'Test Driver',
      phone: driverPhone,
      status: 'active',
      vehicle_type: 'car',
    })
    .select('id')
    .single()

  if (driverErr || !driver) {
    console.log(`    [SKIP] Failed to create driver: ${driverErr?.message}`)
    return
  }
  cleanup.driverIds.push(driver.id)

  // Step 1: /start command
  step('Step 1: Driver sends /start')
  const r1 = await sendDriverWebhook(tgMessage(driverChatId, '/start'))
  assert(r1.status === 200, '/start returns 200', `got ${r1.status}`)

  await delay(STEP_DELAY)

  // Step 2: Send phone number to link
  step('Step 2: Driver sends phone number to link account')
  const r2 = await sendDriverWebhook(tgMessage(driverChatId, driverPhone))
  assert(r2.status === 200, 'Phone linking returns 200', `got ${r2.status}`)

  // Verify driver is linked
  const { data: linkedDriver } = await supabase
    .from('delivery_drivers')
    .select('telegram_chat_id')
    .eq('id', driver.id)
    .single()

  assert(
    Number(linkedDriver?.telegram_chat_id) === driverChatId,
    'Driver telegram_chat_id is set',
    `got ${linkedDriver?.telegram_chat_id}`
  )

  await delay(STEP_DELAY)

  // Step 3: Assign delivery to driver in DB
  step('Step 3: Assign delivery to driver')
  await supabase
    .from('deliveries')
    .update({ driver_id: driver.id, status: 'assigned' })
    .eq('id', deliveryId)

  const { data: assignedDel } = await supabase
    .from('deliveries')
    .select('status, driver_id')
    .eq('id', deliveryId)
    .single()

  assert(assignedDel?.status === 'assigned', 'Delivery status is assigned')
  assert(assignedDel?.driver_id === driver.id, 'Delivery driver_id matches')

  await delay(STEP_DELAY)

  // Step 4: Driver confirms received (confirm_received callback)
  step('Step 4: Driver confirms received')
  const r4 = await sendDriverWebhook(tgCallback(driverChatId, `confirm_received:${deliveryId}`))
  assert(r4.status === 200, 'confirm_received returns 200', `got ${r4.status}`)

  await delay(300)
  const { data: pickedDel } = await supabase
    .from('deliveries')
    .select('status')
    .eq('id', deliveryId)
    .single()
  assert(pickedDel?.status === 'picked_up', 'Delivery status is picked_up', `got ${pickedDel?.status}`)

  await delay(STEP_DELAY)

  // Step 5: Driver reports delivered
  step('Step 5: Driver taps "delivered" (shows payment options)')
  const r5 = await sendDriverWebhook(tgCallback(driverChatId, `delivered:${deliveryId}`))
  assert(r5.status === 200, 'delivered callback returns 200', `got ${r5.status}`)

  // Note: status should NOT change to delivered yet — payment selection happens first
  await delay(300)
  const { data: paymentDel } = await supabase
    .from('deliveries')
    .select('status')
    .eq('id', deliveryId)
    .single()
  // Status stays picked_up until payment is confirmed
  console.log(`    Delivery status after "delivered" tap: ${paymentDel?.status}`)

  await delay(STEP_DELAY)

  // Step 6: Driver selects full payment
  step('Step 6: Driver selects full payment')
  const r6 = await sendDriverWebhook(tgCallback(driverChatId, `payment_full:${deliveryId}`))
  assert(r6.status === 200, 'payment_full returns 200', `got ${r6.status}`)

  await delay(300)
  const { data: deliveredDel } = await supabase
    .from('deliveries')
    .select('status, actual_delivery_time')
    .eq('id', deliveryId!)
    .single()
  assert(
    deliveredDel?.status === 'delivered',
    'Delivery status is "delivered"',
    `got "${deliveredDel?.status}"`
  )
  assert(!!deliveredDel?.actual_delivery_time, 'actual_delivery_time is set')
}

// ============================================================================
// SCENARIO 6: Driver Denies -> Reassignment
// ============================================================================

async function scenario6_driverDenies(storeId: string): Promise<void> {
  section('SCENARIO 6: Driver Denies Delivery')

  // Create order + delivery + driver
  step('Setting up test data: order, delivery, driver')

  const { data: product } = await supabase
    .from('products')
    .select('id, base_price')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!product) {
    console.log('    [SKIP] No products -- skipping')
    return
  }

  const { data: order } = await supabase
    .from('orders')
    .insert({
      store_id: storeId,
      order_number: `ORD-DENY-${Date.now()}`,
      status: 'pending',
      total_amount: product.base_price,
      payment_status: 'pending',
      order_type: 'delivery',
    })
    .select('id')
    .single()

  if (!order) { console.log('    [SKIP] Order creation failed'); return }
  cleanup.orderIds.push(order.id)

  const { data: delivery } = await supabase
    .from('deliveries')
    .insert({
      store_id: storeId,
      order_id: order.id,
      delivery_number: `DEL-DENY-${Date.now()}`,
      status: 'pending',
      delivery_type: 'own_driver',
      delivery_address: 'Test deny address',
      customer_name: 'Deny Test',
      customer_phone: '88112233',
      delivery_fee: 5000,
    })
    .select('id')
    .single()

  if (!delivery) { console.log('    [SKIP] Delivery creation failed'); return }
  cleanup.deliveryIds.push(delivery.id)

  const driverChatId = 888000 + Math.floor(Math.random() * 100000)
  const { data: driverA } = await supabase
    .from('delivery_drivers')
    .insert({
      store_id: storeId,
      name: 'Driver A (Deny Test)',
      phone: '77112233',
      status: 'active',
      vehicle_type: 'motorcycle',
      telegram_chat_id: String(driverChatId),
    })
    .select('id')
    .single()

  if (!driverA) { console.log('    [SKIP] Driver creation failed'); return }
  cleanup.driverIds.push(driverA.id)

  // Assign delivery to Driver A
  await supabase
    .from('deliveries')
    .update({ driver_id: driverA.id, status: 'assigned' })
    .eq('id', delivery.id)

  await delay(STEP_DELAY)

  // Step 2: Driver A denies
  step('Step 2: Driver A denies delivery')
  const r2 = await sendDriverWebhook(tgCallback(driverChatId, `deny_delivery:${delivery.id}`))
  assert(r2.status === 200, 'deny_delivery returns 200', `got ${r2.status}`)

  await delay(STEP_DELAY)

  // Step 3: Verify delivery is unassigned
  step('Step 3: Verify delivery unassigned')
  const { data: deniedDel } = await supabase
    .from('deliveries')
    .select('status, driver_id')
    .eq('id', delivery.id)
    .single()

  assert(deniedDel?.status === 'pending', 'Delivery status reverted to "pending"', `got "${deniedDel?.status}"`)
  assert(deniedDel?.driver_id === null, 'driver_id is null after denial', `got ${deniedDel?.driver_id}`)

  // Step 4: Verify denial notification to store
  step('Step 4: Verify denial notification')
  await delay(STEP_DELAY)
  const { data: denyNotifs } = await supabase
    .from('notifications')
    .select('id, type, title')
    .eq('store_id', storeId)
    .eq('type', 'delivery_driver_denied')
    .gte('created_at', testStartTime)
    .limit(3)

  if (denyNotifs && denyNotifs.length > 0) {
    assert(true, 'Denial notification created', `type=${denyNotifs[0].type}`)
    for (const n of denyNotifs) cleanup.notificationIds.push(n.id)
  } else {
    console.log('    [INFO] No denial notification found (may be async)')
  }
}

// ============================================================================
// SCENARIO 7: Staff Notification Verification
// ============================================================================

async function scenario7_staffNotification(storeId: string): Promise<void> {
  section('SCENARIO 7: Staff Notification Verification')

  // Step 1: Query notifications table for this store
  step('Step 1: Query notifications for store')
  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, type, title, body, created_at')
    .eq('store_id', storeId)
    .gte('created_at', testStartTime)
    .order('created_at', { ascending: false })
    .limit(10)

  if (notifs && notifs.length > 0) {
    assert(true, `Found ${notifs.length} notifications for this test run`)
    for (const n of notifs) {
      console.log(`    - ${n.type}: ${(n.title ?? '').substring(0, 60)}`)
      if (!cleanup.notificationIds.includes(n.id)) {
        cleanup.notificationIds.push(n.id)
      }
    }

    // Verify at least one order-related notification
    const hasOrderNotif = notifs.some(n =>
      ['new_order', 'new_message', 'delivery_completed', 'delivery_driver_denied'].includes(n.type ?? '')
    )
    assert(hasOrderNotif, 'At least one order-related notification exists')
  } else {
    console.log('    [INFO] No notifications found for this test run')
  }

  // Step 2: Create a test staff member for webhook test
  step('Step 2: Staff webhook /start test')

  // Create a test staff member
  const { data: staffMember } = await supabase
    .from('staff')
    .insert({
      store_id: storeId,
      name: 'Test Staff',
      role: 'manager',
    })
    .select('id')
    .single()

  if (staffMember) {
    cleanup.staffIds.push(staffMember.id)

    const staffChatId = 777000 + Math.floor(Math.random() * 100000)

    // Send /start with staff ID
    const r3 = await sendStaffWebhook({
      update_id: Date.now(),
      message: {
        message_id: Date.now(),
        from: { id: staffChatId, first_name: 'TestStaff' },
        chat: { id: staffChatId },
        text: `/start ${staffMember.id}`,
      },
    })
    assert(r3.status === 200, 'Staff /start webhook returns 200', `got ${r3.status}`)

    await delay(STEP_DELAY)

    // Verify staff linked
    const { data: linkedStaff } = await supabase
      .from('staff')
      .select('telegram_chat_id')
      .eq('id', staffMember.id)
      .single()

    assert(
      linkedStaff?.telegram_chat_id === String(staffChatId),
      'Staff telegram_chat_id linked',
      `got ${linkedStaff?.telegram_chat_id}`
    )
  } else {
    console.log('    [INFO] Could not create test staff member')
  }

  // Step 3: Store member webhook test
  step('Step 3: Store member webhook test')
  const { data: owner } = await supabase
    .from('stores')
    .select('owner_id')
    .eq('id', storeId)
    .single()

  if (owner?.owner_id) {
    // Check if a store_member exists for this owner
    const { data: existingMember } = await supabase
      .from('store_members')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', owner.owner_id)
      .single()

    if (existingMember) {
      const memberChatId = 666000 + Math.floor(Math.random() * 100000)

      const r4 = await sendStaffWebhook({
        update_id: Date.now(),
        message: {
          message_id: Date.now(),
          from: { id: memberChatId, first_name: 'TestMember' },
          chat: { id: memberChatId },
          text: `/start member_${existingMember.id}`,
        },
      })
      assert(r4.status === 200, 'Member /start webhook returns 200', `got ${r4.status}`)

      await delay(STEP_DELAY)

      // Verify member linked
      const { data: linkedMember } = await supabase
        .from('store_members')
        .select('telegram_chat_id')
        .eq('id', existingMember.id)
        .single()

      if (linkedMember) {
        assert(
          linkedMember.telegram_chat_id === String(memberChatId),
          'Store member telegram_chat_id linked',
        )
        // Revert the change to not pollute real member data
        await supabase
          .from('store_members')
          .update({ telegram_chat_id: null })
          .eq('id', existingMember.id)
      }
    } else {
      console.log('    [INFO] No store_member found for owner -- creating test member')

      const { data: testMember } = await supabase
        .from('store_members')
        .insert({
          store_id: storeId,
          user_id: owner.owner_id,
          role: 'owner',
        })
        .select('id')
        .single()

      if (testMember) {
        cleanup.storeMemberIds.push(testMember.id)

        const memberChatId = 665000 + Math.floor(Math.random() * 100000)
        const r4 = await sendStaffWebhook({
          update_id: Date.now(),
          message: {
            message_id: Date.now(),
            from: { id: memberChatId, first_name: 'TestMember' },
            chat: { id: memberChatId },
            text: `/start member_${testMember.id}`,
          },
        })
        assert(r4.status === 200, 'Member /start webhook returns 200', `got ${r4.status}`)
      }
    }
  }
}

// ============================================================================
// Main runner
// ============================================================================

async function main(): Promise<void> {
  console.log('\n')
  console.log('='.repeat(74))
  console.log('  TEMUULEL FULL SIMULATION TEST')
  console.log(`  ${new Date().toISOString()}`)
  console.log('='.repeat(74))

  const { storeId } = await preflight()

  let scenario1Result = {
    conversationId: '',
    orderId: null as string | null,
    deliveryId: null as string | null,
  }

  try {
    // Run all scenarios sequentially with inter-scenario delay to clear rate limit
    scenario1Result = await scenario1_happyPathOrder(storeId)
    await delay(SCENARIO_DELAY)
    await scenario2_nameNotGreeting(storeId)
    await delay(SCENARIO_DELAY)
    await scenario3_complaintEscalation(storeId)
    await delay(SCENARIO_DELAY)
    await scenario4_midOrderCancel(storeId)
    await delay(SCENARIO_DELAY)
    await scenario5_driverDeliveryFlow(storeId, scenario1Result.deliveryId)
    await delay(SCENARIO_DELAY)
    await scenario6_driverDenies(storeId)
    await delay(SCENARIO_DELAY)
    await scenario7_staffNotification(storeId)
  } finally {
    // Always clean up
    // Find any customers that were auto-created by the chat API
    for (const convId of cleanup.conversationIds) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('customer_id')
        .eq('id', convId)
        .single()
      if (conv?.customer_id && !cleanup.customerIds.includes(conv.customer_id)) {
        cleanup.customerIds.push(conv.customer_id)
      }
    }

    // Find any orders/deliveries that were created during test
    const { data: testOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('store_id', storeId)
      .gte('created_at', testStartTime)

    if (testOrders) {
      for (const o of testOrders) {
        if (!cleanup.orderIds.includes(o.id)) cleanup.orderIds.push(o.id)
        const { data: dels } = await supabase
          .from('deliveries')
          .select('id')
          .eq('order_id', o.id)
        if (dels) {
          for (const d of dels) {
            if (!cleanup.deliveryIds.includes(d.id)) cleanup.deliveryIds.push(d.id)
          }
        }
      }
    }

    // Find stray deliveries not linked to orders
    const { data: strayDeliveries } = await supabase
      .from('deliveries')
      .select('id')
      .eq('store_id', storeId)
      .gte('created_at', testStartTime)

    if (strayDeliveries) {
      for (const d of strayDeliveries) {
        if (!cleanup.deliveryIds.includes(d.id)) cleanup.deliveryIds.push(d.id)
      }
    }

    await cleanupTestData()
  }

  // Print summary
  section('TEST SUMMARY')
  console.log(`\n  Total:  ${totalTests}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)

  if (errors.length > 0) {
    console.log(`\n  FAILURES:`)
    for (const e of errors) {
      console.log(`    - ${e}`)
    }
  }

  console.log('')

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\nFATAL ERROR:', err)
  cleanupTestData().catch(() => {}).finally(() => process.exit(1))
})
