/**
 * End-to-End Driver Telegram Bot Test
 *
 * Tests ALL driver Telegram bot callbacks and commands by simulating
 * webhook payloads against the local API at http://localhost:3000/api/telegram/driver
 *
 * Prerequisites:
 *   - Local Next.js dev server running: npm run dev
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Supabase running (local or remote)
 *
 * Usage: npx tsx scripts/test-driver-telegram-e2e.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Config
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!
const API_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const WEBHOOK_URL = `${API_URL}/api/telegram/driver`

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// Test constants
// ============================================================================

const DRIVER_CHAT_ID = 9999999001 // Unique test Telegram chat ID
const DRIVER_PHONE = '99112233'
const DRIVER_NAME = 'TestDriver E2E'
const CUSTOMER_PHONE = '88001122'
const CUSTOMER_NAME = 'TestCustomer E2E'
const STORE_NAME = 'TestStore DriverBot E2E'
const DELIVERY_NUMBER = `DEL-E2E-${Date.now()}`
const ORDER_NUMBER = `ORD-E2E-${Date.now()}`
const ORDER_TOTAL = 50000
const DELIVERY_FEE = 5000

let storeId: string
let driverId: string
let customerId: string
let orderId: string
let deliveryId: string
let updateCounter = 100

// ============================================================================
// Test tracking
// ============================================================================

let passed = 0
let failed = 0
let totalTests = 0
const errors: string[] = []

function assert(condition: boolean, message: string, details?: string) {
  totalTests++
  if (condition) {
    passed++
    console.log(`    \u2705 ${message}`)
  } else {
    failed++
    const msg = details ? `${message} -- ${details}` : message
    errors.push(msg)
    console.error(`    \uD83D\uDD34 ${message}${details ? ` (${details})` : ''}`)
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(70))
}

// ============================================================================
// Helpers
// ============================================================================

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Send a simulated Telegram webhook POST */
async function sendWebhook(payload: object): Promise<{ status: number; body: unknown }> {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, body }
}

/** Build a callback_query webhook payload */
function callbackPayload(callbackData: string, messageId = 1): object {
  return {
    update_id: updateCounter++,
    callback_query: {
      id: `test-query-${updateCounter}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'Test' },
      message: {
        message_id: messageId,
        chat: { id: DRIVER_CHAT_ID, type: 'private' },
      },
      data: callbackData,
    },
  }
}

/** Build a text message webhook payload */
function messagePayload(text: string): object {
  return {
    update_id: updateCounter++,
    message: {
      message_id: updateCounter,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'Test' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text,
    },
  }
}

/** Fetch delivery from DB */
async function getDelivery(): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', deliveryId)
    .single()
  return data as Record<string, unknown> | null
}

/** Fetch driver from DB */
async function getDriver(): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('delivery_drivers')
    .select('*')
    .eq('id', driverId)
    .single()
  return data as Record<string, unknown> | null
}

/** Fetch order from DB */
async function getOrder(): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()
  return data as Record<string, unknown> | null
}

/** Reset delivery to a given state for the next test */
async function resetDelivery(overrides: Record<string, unknown> = {}): Promise<void> {
  await supabase
    .from('deliveries')
    .update({
      status: 'assigned',
      driver_id: driverId,
      notes: null,
      metadata: {},
      denial_info: null,
      failure_reason: null,
      ...overrides,
    })
    .eq('id', deliveryId)
}

/** Reset order to a given state */
async function resetOrder(overrides: Record<string, unknown> = {}): Promise<void> {
  await supabase
    .from('orders')
    .update({
      status: 'confirmed',
      payment_status: 'pending',
      notes: null,
      ...overrides,
    })
    .eq('id', orderId)
}

/** Reset driver metadata */
async function resetDriverMeta(): Promise<void> {
  await supabase
    .from('delivery_drivers')
    .update({ metadata: {} })
    .eq('id', driverId)
}

// ============================================================================
// Setup: Create test data
// ============================================================================

async function setup() {
  section('SETUP: Creating test data')

  // 1. Find or create a test user (owner for the store)
  // We need a user_id for the store owner. Try to use a known test user or create via auth.
  // Since we use service role, we can create store without a real user using a dummy UUID.
  const dummyOwnerId = '00000000-0000-0000-0000-000000000099'

  // Ensure user exists (upsert)
  await supabase.from('users').upsert({
    id: dummyOwnerId,
    email: 'test-driverbot@e2e.local',
    full_name: 'Test Owner',
  }, { onConflict: 'id' })

  // 2. Create store
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .insert({
      owner_id: dummyOwnerId,
      name: STORE_NAME,
      slug: `test-driverbot-e2e-${Date.now()}`,
      business_type: 'ecommerce',
    })
    .select('id')
    .single()

  if (storeErr || !store) {
    console.error('Failed to create store:', storeErr)
    process.exit(1)
  }
  storeId = store.id
  console.log(`    Store: ${storeId}`)

  // 3. Create driver
  const { data: driver, error: driverErr } = await supabase
    .from('delivery_drivers')
    .insert({
      store_id: storeId,
      name: DRIVER_NAME,
      phone: DRIVER_PHONE,
      vehicle_type: 'car',
      status: 'active',
      metadata: {},
    })
    .select('id')
    .single()

  if (driverErr || !driver) {
    console.error('Failed to create driver:', driverErr)
    process.exit(1)
  }
  driverId = driver.id
  console.log(`    Driver: ${driverId}`)

  // 4. Create customer
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      store_id: storeId,
      name: CUSTOMER_NAME,
      phone: CUSTOMER_PHONE,
    })
    .select('id')
    .single()

  if (custErr || !customer) {
    console.error('Failed to create customer:', custErr)
    process.exit(1)
  }
  customerId = customer.id
  console.log(`    Customer: ${customerId}`)

  // 5. Create order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      store_id: storeId,
      customer_id: customerId,
      order_number: ORDER_NUMBER,
      status: 'confirmed',
      total_amount: ORDER_TOTAL,
      payment_method: 'cash',
      payment_status: 'pending',
      shipping_address: 'Test Address, UB District 1',
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('Failed to create order:', orderErr)
    process.exit(1)
  }
  orderId = order.id
  console.log(`    Order: ${orderId} (${ORDER_NUMBER})`)

  // 6. Create delivery
  const { data: delivery, error: delErr } = await supabase
    .from('deliveries')
    .insert({
      store_id: storeId,
      order_id: orderId,
      driver_id: driverId,
      delivery_number: DELIVERY_NUMBER,
      status: 'assigned',
      delivery_address: 'Test Address, UB District 1',
      customer_name: CUSTOMER_NAME,
      customer_phone: CUSTOMER_PHONE,
      delivery_fee: DELIVERY_FEE,
      metadata: {},
    })
    .select('id')
    .single()

  if (delErr || !delivery) {
    console.error('Failed to create delivery:', delErr)
    process.exit(1)
  }
  deliveryId = delivery.id
  console.log(`    Delivery: ${deliveryId} (${DELIVERY_NUMBER})`)

  console.log('\n    Setup complete.\n')
}

// ============================================================================
// Cleanup: Remove test data
// ============================================================================

async function cleanup() {
  section('CLEANUP: Removing test data')

  // Delete in dependency order
  await supabase.from('notifications').delete().eq('store_id', storeId)
  await supabase.from('deliveries').delete().eq('id', deliveryId)
  await supabase.from('delivery_drivers').delete().eq('id', driverId)
  await supabase.from('orders').delete().eq('id', orderId)
  await supabase.from('customers').delete().eq('id', customerId)
  await supabase.from('stores').delete().eq('id', storeId)
  await supabase.from('users').delete().eq('id', '00000000-0000-0000-0000-000000000099')

  console.log('    Done.')
}

// ============================================================================
// Tests
// ============================================================================

async function runTests() {
  // ── 1. /start command ───────────────────────────────────────────────
  section('1. /start command -> welcome message')

  let res = await sendWebhook(messagePayload('/start'))
  assert(res.status === 200, '/start returns HTTP 200')
  // After /start the bot sends welcome, driver is NOT linked yet
  const driverBefore = await getDriver()
  assert(driverBefore?.telegram_chat_id === null || driverBefore?.telegram_chat_id === undefined,
    'Driver not yet linked to Telegram')

  await delay(500)

  // ── 2. Phone number linking ─────────────────────────────────────────
  section('2. Phone number linking -> driver linked')

  res = await sendWebhook(messagePayload(DRIVER_PHONE))
  assert(res.status === 200, 'Phone link returns HTTP 200')

  await delay(500)
  const driverLinked = await getDriver()
  assert(
    driverLinked?.telegram_chat_id !== null &&
    driverLinked?.telegram_chat_id !== undefined &&
    Number(driverLinked?.telegram_chat_id) === DRIVER_CHAT_ID,
    'Driver telegram_chat_id is set correctly',
    `Expected ${DRIVER_CHAT_ID}, got ${driverLinked?.telegram_chat_id}`
  )
  assert(driverLinked?.telegram_linked_at !== null, 'telegram_linked_at is set')

  await delay(500)

  // ── 3. /orders command ──────────────────────────────────────────────
  section('3. /orders command -> delivery cards shown')

  res = await sendWebhook(messagePayload('/orders'))
  assert(res.status === 200, '/orders returns HTTP 200')
  // We don't check Telegram response content (it goes to Telegram API),
  // but verify the request didn't error.

  await delay(500)

  // ── 4. accept delivery (confirm_received) ───────────────────────────
  section('4. accept delivery (confirm_received) -> delivery picked_up')

  await resetDelivery({ status: 'assigned' })
  res = await sendWebhook(callbackPayload(`confirm_received:${deliveryId}`))
  assert(res.status === 200, 'confirm_received returns HTTP 200')

  await delay(500)
  let del = await getDelivery()
  assert(del?.status === 'picked_up', 'Delivery status is picked_up',
    `Got: ${del?.status}`)

  await delay(500)

  // ── 5. arrived_at_store ─────────────────────────────────────────────
  section('5. arrived_at_store -> status updated to at_store')

  await resetDelivery({ status: 'assigned' })
  res = await sendWebhook(callbackPayload(`arrived_at_store:${deliveryId}`))
  assert(res.status === 200, 'arrived_at_store returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'at_store', 'Delivery status is at_store',
    `Got: ${del?.status}`)

  await delay(500)

  // ── 6. picked_up ────────────────────────────────────────────────────
  section('6. picked_up -> status updated to picked_up')

  await resetDelivery({ status: 'assigned' })
  res = await sendWebhook(callbackPayload(`picked_up:${deliveryId}`))
  assert(res.status === 200, 'picked_up returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'picked_up', 'Delivery status is picked_up',
    `Got: ${del?.status}`)

  await delay(500)

  // ── 7. customer_info ────────────────────────────────────────────────
  section('7. customer_info -> customer details shown (alert callback)')

  res = await sendWebhook(callbackPayload(`customer_info:${deliveryId}`))
  assert(res.status === 200, 'customer_info returns HTTP 200')
  // This action just triggers an answerCallbackQuery alert, no DB changes

  await delay(500)

  // ── 8. unreachable ──────────────────────────────────────────────────
  section('8. unreachable -> delivery delayed')

  await resetDelivery({ status: 'picked_up' })
  res = await sendWebhook(callbackPayload(`unreachable:${deliveryId}`))
  assert(res.status === 200, 'unreachable returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'delayed', 'Delivery status is delayed',
    `Got: ${del?.status}`)
  assert(
    typeof del?.notes === 'string' && del.notes.includes('утас'),
    'Notes mention phone unreachable',
    `Got: ${del?.notes}`
  )

  await delay(500)

  // ── 9. payment_full (COD) ───────────────────────────────────────────
  section('9. payment_full -> delivery completed, order paid')

  await resetDelivery({ status: 'picked_up' })
  await resetOrder()

  // First trigger "delivered" callback to show payment options
  res = await sendWebhook(callbackPayload(`delivered:${deliveryId}`))
  assert(res.status === 200, 'delivered callback returns HTTP 200')
  await delay(500)

  // Now select full payment
  res = await sendWebhook(callbackPayload(`payment_full:${deliveryId}`))
  assert(res.status === 200, 'payment_full returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'delivered', 'Delivery status is delivered',
    `Got: ${del?.status}`)

  const orderPaid = await getOrder()
  assert(orderPaid?.payment_status === 'paid', 'Order payment_status is paid',
    `Got: ${orderPaid?.payment_status}`)

  await delay(500)

  // ── 10. deny_delivery ───────────────────────────────────────────────
  section('10. deny_delivery -> delivery unassigned')

  await resetDelivery({ status: 'assigned' })
  await resetOrder()

  res = await sendWebhook(callbackPayload(`deny_delivery:${deliveryId}`))
  assert(res.status === 200, 'deny_delivery returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'pending', 'Delivery status is pending (unassigned)',
    `Got: ${del?.status}`)
  assert(del?.driver_id === null, 'Delivery driver_id is null',
    `Got: ${del?.driver_id}`)

  // Check notification was created
  const { data: denyNotif } = await supabase
    .from('notifications')
    .select('*')
    .eq('store_id', storeId)
    .eq('type', 'delivery_driver_denied')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  assert(denyNotif !== null, 'Store notification created for driver denial')

  await delay(500)

  // ── 11. customer_refused + reason text ──────────────────────────────
  section('11. customer_refused + reason text -> delivery failed')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()
  await resetOrder()

  // Step 1: Tap customer_refused button
  res = await sendWebhook(callbackPayload(`customer_refused:${deliveryId}`))
  assert(res.status === 200, 'customer_refused callback returns HTTP 200')

  await delay(500)

  // Check driver metadata has awaiting_refusal_reason
  let driverMeta = await getDriver()
  const awaitingRefusal = (driverMeta?.metadata as Record<string, unknown>)?.awaiting_refusal_reason
  assert(awaitingRefusal !== undefined && awaitingRefusal !== null,
    'Driver metadata has awaiting_refusal_reason')

  // Step 2: Send the refusal reason text
  res = await sendWebhook(messagePayload('Хэмжээ тохирсонгүй'))
  assert(res.status === 200, 'Refusal reason text returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'failed', 'Delivery status is failed',
    `Got: ${del?.status}`)

  const refMeta = del?.metadata as Record<string, unknown> | null
  assert(
    refMeta?.customer_refused === true,
    'Delivery metadata has customer_refused=true',
    `Got: ${JSON.stringify(refMeta)}`
  )
  assert(
    typeof refMeta?.refusal_reason === 'string',
    'Delivery metadata has refusal_reason',
    `Got: ${JSON.stringify(refMeta)}`
  )

  await delay(500)

  // ── 12. wrong_product + photo ───────────────────────────────────────
  section('12. wrong_product -> delivery failed, awaiting photo')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()
  await resetOrder()

  res = await sendWebhook(callbackPayload(`wrong_product:${deliveryId}`))
  assert(res.status === 200, 'wrong_product returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'failed', 'Delivery status is failed',
    `Got: ${del?.status}`)
  assert(
    typeof del?.notes === 'string' && del.notes.includes('Буруу бараа'),
    'Notes mention wrong product',
    `Got notes: ${del?.notes}`
  )

  // Check driver has awaiting_wrong_photo in metadata
  driverMeta = await getDriver()
  const awaitingPhoto = (driverMeta?.metadata as Record<string, unknown>)?.awaiting_wrong_photo
  assert(awaitingPhoto === deliveryId, 'Driver metadata has awaiting_wrong_photo with delivery ID',
    `Got: ${awaitingPhoto}`)

  // Note: We skip sending an actual photo since that requires Telegram file API.
  // The state is verified above.

  await delay(500)

  // ── 13. damaged ─────────────────────────────────────────────────────
  section('13. damaged -> delivery failed')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()

  res = await sendWebhook(callbackPayload(`damaged:${deliveryId}`))
  assert(res.status === 200, 'damaged returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'failed', 'Delivery status is failed',
    `Got: ${del?.status}`)
  assert(
    typeof del?.notes === 'string' && del.notes.includes('Гэмтсэн'),
    'Notes mention damaged',
    `Got notes: ${del?.notes}`
  )

  // Check notification
  const { data: dmNotif } = await supabase
    .from('notifications')
    .select('*')
    .eq('store_id', storeId)
    .eq('type', 'delivery_failed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  assert(dmNotif !== null, 'Store notification created for damaged item')

  await delay(500)

  // ── 14. no_payment ──────────────────────────────────────────────────
  section('14. no_payment -> delivery failed')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()

  res = await sendWebhook(callbackPayload(`no_payment:${deliveryId}`))
  assert(res.status === 200, 'no_payment returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'failed', 'Delivery status is failed',
    `Got: ${del?.status}`)
  assert(
    typeof del?.notes === 'string' && del.notes.includes('мөнгө'),
    'Notes mention no payment',
    `Got notes: ${del?.notes}`
  )

  await delay(500)

  // ── 15. /unlink ─────────────────────────────────────────────────────
  section('15. /unlink -> driver unlinked')

  // First make sure driver is linked
  await supabase
    .from('delivery_drivers')
    .update({ telegram_chat_id: DRIVER_CHAT_ID, telegram_linked_at: new Date().toISOString() })
    .eq('id', driverId)

  res = await sendWebhook(messagePayload('/unlink'))
  assert(res.status === 200, '/unlink returns HTTP 200')

  await delay(500)
  const driverUnlinked = await getDriver()
  assert(driverUnlinked?.telegram_chat_id === null, 'Driver telegram_chat_id is null after unlink',
    `Got: ${driverUnlinked?.telegram_chat_id}`)
  assert(driverUnlinked?.telegram_linked_at === null, 'telegram_linked_at is null after unlink',
    `Got: ${driverUnlinked?.telegram_linked_at}`)

  // Re-link for subsequent tests
  await supabase
    .from('delivery_drivers')
    .update({ telegram_chat_id: DRIVER_CHAT_ID, telegram_linked_at: new Date().toISOString() })
    .eq('id', driverId)

  await delay(500)

  // ── 16. /help ───────────────────────────────────────────────────────
  section('16. /help -> help shown')

  res = await sendWebhook(messagePayload('/help'))
  assert(res.status === 200, '/help returns HTTP 200')

  await delay(500)

  // ── 17. batch_ready -> batch cards shown ────────────────────────────
  section('17. batch_ready -> batch delivery cards shown')

  // Set up a pending batch in driver metadata
  await resetDelivery({ status: 'assigned' })
  await resetDriverMeta()

  const batchKey = `${driverId}_${Date.now()}`
  await supabase
    .from('delivery_drivers')
    .update({
      metadata: {
        pending_batch: {
          batchKey,
          deliveryIds: [deliveryId],
          storeId,
          timestamp: new Date().toISOString(),
        },
      },
    })
    .eq('id', driverId)

  res = await sendWebhook(callbackPayload(`batch_ready:${batchKey}`))
  assert(res.status === 200, 'batch_ready returns HTTP 200')

  await delay(500)
  // Delivery should still be assigned (batch_ready just shows cards, doesn't change status)
  del = await getDelivery()
  assert(del?.status === 'assigned', 'Delivery still assigned after batch_ready',
    `Got: ${del?.status}`)

  await delay(500)

  // ── 18. deny + deny_reason -> specific delivery denied with reason ──
  section('18. deny + deny_reason -> delivery denied with reason')

  await resetDelivery({ status: 'assigned' })
  await resetDriverMeta()

  // Step 1: Tap deny button (shows reason options)
  res = await sendWebhook(callbackPayload(`deny:${deliveryId}`))
  assert(res.status === 200, 'deny returns HTTP 200')

  await delay(500)

  // Step 2: Select a reason (area = "not in zone")
  res = await sendWebhook(callbackPayload(`deny_reason:area:${deliveryId}`))
  assert(res.status === 200, 'deny_reason:area returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'pending', 'Delivery status is pending (denied)',
    `Got: ${del?.status}`)
  assert(del?.driver_id === null, 'Delivery driver_id is null (unassigned)',
    `Got: ${del?.driver_id}`)

  const denialInfo = del?.denial_info as Record<string, unknown> | null
  assert(denialInfo !== null && denialInfo !== undefined,
    'denial_info is recorded')
  assert(denialInfo?.reason === 'area',
    'denial_info reason is "area"',
    `Got: ${denialInfo?.reason}`)
  assert(denialInfo?.driver_id === driverId,
    'denial_info driver_id matches',
    `Got: ${denialInfo?.driver_id}`)

  await delay(500)

  // ── 19. batch_confirm -> remaining confirmed ────────────────────────
  section('19. batch_confirm -> remaining deliveries confirmed')

  await resetDelivery({ status: 'assigned' })
  await resetDriverMeta()

  const batchKey2 = `${driverId}_${Date.now()}`
  await supabase
    .from('delivery_drivers')
    .update({
      metadata: {
        pending_batch: {
          batchKey: batchKey2,
          deliveryIds: [deliveryId],
        },
      },
    })
    .eq('id', driverId)

  res = await sendWebhook(callbackPayload(`batch_confirm:${batchKey2}`))
  assert(res.status === 200, 'batch_confirm returns HTTP 200')

  await delay(500)
  // pending_batch should be cleared from driver metadata
  const driverAfterBatch = await getDriver()
  const batchMeta = (driverAfterBatch?.metadata as Record<string, unknown>) ?? {}
  assert(batchMeta.pending_batch === undefined,
    'pending_batch cleared from driver metadata',
    `Got: ${JSON.stringify(batchMeta)}`)

  // Delivery should still be assigned (batch_confirm doesn't change status to picked_up)
  del = await getDelivery()
  assert(del?.status === 'assigned', 'Delivery still assigned after batch_confirm',
    `Got: ${del?.status}`)

  await delay(500)

  // ── 20. payment_custom + amount + reason -> partial payment ─────────
  section('20. payment_custom + amount + reason -> partial payment')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()
  await resetOrder()

  // Step 1: Tap payment_custom button
  res = await sendWebhook(callbackPayload(`payment_custom:${deliveryId}`))
  assert(res.status === 200, 'payment_custom returns HTTP 200')

  await delay(500)

  // Check driver metadata has awaiting_custom_payment
  driverMeta = await getDriver()
  const awaitingPayment = (driverMeta?.metadata as Record<string, unknown>)?.awaiting_custom_payment as Record<string, unknown> | undefined
  assert(awaitingPayment !== undefined && awaitingPayment !== null,
    'Driver metadata has awaiting_custom_payment')
  assert(awaitingPayment?.step === 'amount',
    'awaiting_custom_payment step is "amount"',
    `Got: ${awaitingPayment?.step}`)

  // Step 2: Send amount
  res = await sendWebhook(messagePayload('25000'))
  assert(res.status === 200, 'Custom amount text returns HTTP 200')

  await delay(500)

  // Check step advanced to reason
  driverMeta = await getDriver()
  const awaitingReason = (driverMeta?.metadata as Record<string, unknown>)?.awaiting_custom_payment as Record<string, unknown> | undefined
  assert(awaitingReason?.step === 'reason',
    'awaiting_custom_payment step is "reason"',
    `Got: ${awaitingReason?.step}`)
  assert(awaitingReason?.amount === 25000,
    'awaiting_custom_payment amount is 25000',
    `Got: ${awaitingReason?.amount}`)

  // Step 3: Send reason
  res = await sendWebhook(messagePayload('Zaaval duu tolson'))
  assert(res.status === 200, 'Custom reason text returns HTTP 200')

  await delay(500)

  del = await getDelivery()
  assert(del?.status === 'delivered', 'Delivery status is delivered after custom payment',
    `Got: ${del?.status}`)

  const customPayMeta = del?.metadata as Record<string, unknown> | null
  assert(customPayMeta?.custom_payment !== undefined,
    'Delivery metadata has custom_payment',
    `Got: ${JSON.stringify(customPayMeta)}`)

  const orderPartial = await getOrder()
  assert(orderPartial?.payment_status === 'partial',
    'Order payment_status is partial',
    `Got: ${orderPartial?.payment_status}`)

  // Check driver metadata is cleared
  driverMeta = await getDriver()
  const clearedPayment = (driverMeta?.metadata as Record<string, unknown>)?.awaiting_custom_payment
  assert(clearedPayment === undefined,
    'awaiting_custom_payment cleared from driver metadata')

  await delay(500)

  // ── 21. payment_delayed -> delivered but payment pending ────────────
  section('21. payment_delayed -> delivered, payment pending')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()
  await resetOrder()

  res = await sendWebhook(callbackPayload(`payment_delayed:${deliveryId}`))
  assert(res.status === 200, 'payment_delayed returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'delivered', 'Delivery status is delivered',
    `Got: ${del?.status}`)

  const delayedMeta = del?.metadata as Record<string, unknown> | null
  assert(delayedMeta?.payment_followup === true,
    'Delivery metadata has payment_followup=true',
    `Got: ${JSON.stringify(delayedMeta)}`)

  const orderDelayed = await getOrder()
  assert(orderDelayed?.payment_status === 'pending',
    'Order payment_status is pending',
    `Got: ${orderDelayed?.payment_status}`)

  // Check notification
  const { data: payNotif } = await supabase
    .from('notifications')
    .select('*')
    .eq('store_id', storeId)
    .eq('type', 'payment_pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  assert(payNotif !== null, 'Store notification created for payment pending')
}

// ============================================================================
// Bonus: Additional callback tests
// ============================================================================

async function runBonusTests() {
  // ── delay -> delay_time ─────────────────────────────────────────────
  section('BONUS: delay + delay_time:today -> delivery delayed')

  await resetDelivery({ status: 'picked_up' })
  await resetDriverMeta()

  // Step 1: Tap delay button (shows time choices)
  res = await sendWebhook(callbackPayload(`delay:${deliveryId}`))
  assert(res.status === 200, 'delay returns HTTP 200')

  await delay(500)

  // Step 2: Select "today" option
  res = await sendWebhook(callbackPayload(`delay_time:today:${deliveryId}`))
  assert(res.status === 200, 'delay_time:today returns HTTP 200')

  await delay(500)
  let del = await getDelivery()
  assert(del?.status === 'delayed', 'Delivery status is delayed',
    `Got: ${del?.status}`)

  await delay(500)

  // ── issue -> issue sub-menu ─────────────────────────────────────────
  section('BONUS: issue -> shows issue sub-menu')

  await resetDelivery({ status: 'picked_up' })

  res = await sendWebhook(callbackPayload(`issue:${deliveryId}`))
  assert(res.status === 200, 'issue returns HTTP 200')
  // This just shows sub-options (wrong_product, damaged, no_payment), no DB change

  await delay(500)

  // ── reject (intercity reject) ───────────────────────────────────────
  section('BONUS: reject -> delivery unassigned, auto-reassign attempted')

  await resetDelivery({ status: 'assigned' })
  await resetDriverMeta()
  await resetOrder()

  res = await sendWebhook(callbackPayload(`reject:${deliveryId}`))
  assert(res.status === 200, 'reject returns HTTP 200')

  await delay(800) // longer delay for auto-reassign attempt
  del = await getDelivery()
  // Should be pending (unassigned) since there's no other driver to assign to
  assert(del?.status === 'pending' || del?.status === 'assigned',
    'Delivery status is pending or re-assigned',
    `Got: ${del?.status}`)

  await delay(500)

  // ── payment_received (legacy) ───────────────────────────────────────
  section('BONUS: payment_received -> order marked paid')

  await resetDelivery({ status: 'delivered' })
  await resetDriverMeta()
  await resetOrder()

  res = await sendWebhook(callbackPayload(`payment_received:${deliveryId}`))
  assert(res.status === 200, 'payment_received returns HTTP 200')

  await delay(500)
  const orderAfterPayment = await getOrder()
  assert(orderAfterPayment?.payment_status === 'paid',
    'Order payment_status is paid',
    `Got: ${orderAfterPayment?.payment_status}`)

  await delay(500)

  // ── deny_reason:other -> custom text input ──────────────────────────
  section('BONUS: deny_reason:other + text -> custom deny reason')

  await resetDelivery({ status: 'assigned' })
  await resetDriverMeta()

  res = await sendWebhook(callbackPayload(`deny_reason:other:${deliveryId}`))
  assert(res.status === 200, 'deny_reason:other returns HTTP 200')

  await delay(500)

  // Check driver has awaiting_deny_reason
  const driverMeta = await getDriver()
  const awaitingDeny = (driverMeta?.metadata as Record<string, unknown>)?.awaiting_deny_reason
  assert(awaitingDeny !== undefined && awaitingDeny !== null,
    'Driver metadata has awaiting_deny_reason')

  // Send custom reason text
  res = await sendWebhook(messagePayload('Zamiin baidal muu'))
  assert(res.status === 200, 'Custom deny reason text returns HTTP 200')

  await delay(500)
  del = await getDelivery()
  assert(del?.status === 'pending', 'Delivery status is pending (denied)',
    `Got: ${del?.status}`)
  assert(del?.driver_id === null, 'Driver unassigned',
    `Got: ${del?.driver_id}`)

  const customDenialInfo = del?.denial_info as Record<string, unknown> | null
  assert(customDenialInfo?.reason === 'other',
    'denial_info reason is "other"',
    `Got: ${customDenialInfo?.reason}`)
  assert(
    typeof customDenialInfo?.reason_label === 'string' &&
    customDenialInfo.reason_label.includes('Zamiin baidal muu'),
    'denial_info reason_label contains custom text',
    `Got: ${customDenialInfo?.reason_label}`)
}

// ============================================================================
// Main
// ============================================================================

let res: { status: number; body: unknown }

async function main() {
  console.log(`
${'='.repeat(70)}
  DRIVER TELEGRAM BOT E2E TEST
  Webhook URL: ${WEBHOOK_URL}
  Supabase:    ${SUPABASE_URL}
${'='.repeat(70)}
`)

  // Verify the API is reachable
  try {
    const health = await fetch(API_URL)
    if (!health.ok && health.status !== 404) {
      console.warn(`Warning: API returned status ${health.status}. Make sure the dev server is running.`)
    }
  } catch (err) {
    console.error(`ERROR: Cannot reach ${API_URL}. Start the dev server first: npm run dev`)
    process.exit(1)
  }

  try {
    await setup()
    await runTests()
    await runBonusTests()
  } catch (err) {
    console.error('\nFATAL ERROR during tests:', err)
    failed++
  } finally {
    try {
      await cleanup()
    } catch (cleanupErr) {
      console.error('Cleanup error (non-fatal):', cleanupErr)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  TEST RESULTS`)
  console.log('='.repeat(70))
  console.log(`    Total:  ${totalTests}`)
  console.log(`    Passed: ${passed}`)
  console.log(`    Failed: ${failed}`)

  if (errors.length > 0) {
    console.log(`\n    FAILURES:`)
    errors.forEach((e, i) => console.log(`    ${i + 1}. ${e}`))
  }

  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

main()
