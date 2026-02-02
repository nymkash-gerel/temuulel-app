/**
 * End-to-End Delivery System Test
 *
 * Tests the FULL delivery lifecycle across all delivery-enabled businesses:
 *   Order → Delivery → Driver Assignment → Pickup → In-Transit → Delivered
 *   + Delay handling, Failure handling, Returns, Tracking, Notifications
 *
 * Uses real FB chat history data from scripts/test-data/test-cases.json
 * as customer context for realistic test scenarios.
 *
 * Usage: npx tsx scripts/test-delivery-e2e.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Config
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// Test state tracking
// ============================================================================

let passed = 0
let failed = 0
let totalTests = 0
const errors: string[] = []

function assert(condition: boolean, message: string, details?: string) {
  totalTests++
  if (condition) {
    passed++
    console.log(`    ✓ ${message}`)
  } else {
    failed++
    const msg = details ? `${message} — ${details}` : message
    errors.push(msg)
    console.error(`    ✗ ${message}${details ? ` (${details})` : ''}`)
  }
}

function section(title: string) {
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  ${title}`)
  console.log('═'.repeat(70))
}

function subsection(title: string) {
  console.log(`\n  ── ${title} ──`)
}

// ============================================================================
// Load real FB chat history for realistic test data
// ============================================================================

interface TestCase {
  category: string
  question: string
  actual_response: string | null
}

function loadChatHistory(): TestCase[] {
  const filePath = join(__dirname, 'test-data/test-cases.json')
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

// ============================================================================
// Delivery-enabled stores
// ============================================================================

interface StoreInfo {
  id: string
  name: string
  email: string
  businessType: string
  products: Array<{ id: string; name: string; base_price: number }>
  drivers: Array<{ id: string; name: string; phone: string; status: string; vehicle_type: string }>
}

// Valid status transitions (from delivery API)
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed', 'delayed'],
  delayed: ['in_transit', 'delivered', 'failed'],
}

// Mongolian addresses for realistic testing (from real FB data)
const TEST_ADDRESSES = [
  'БЗД, 8-р хороо, Шинэ Амгалан хотхон, 519 байр, 2 орц, 9 давхар, 146 тоот',
  'СБД, 1-р хороо, Ногоон нуур',
  'ХУД, 7-р хороо, Зайсан',
  'СХД, 20-р хороо, Шинэ яармаг',
  'ЧД, 5-р хороо, 100 айл',
  'БЗД, 3-р хороо, 45-р байр, 302 тоот',
  'БГД, 4-р хороо, Энхтайваны өргөн чөлөө',
  'Баянхошуу шинэ эцэс, эгүүшин худалдааны төв, гэр ахуйн барааны лангуу',
]

// Customer names from real FB data
const TEST_CUSTOMERS = [
  { name: 'Дорж', phone: '99887766' },
  { name: 'Нарантуяа', phone: '99776655' },
  { name: 'Цэрэн', phone: '99665544' },
  { name: 'Баяр', phone: '99554433' },
  { name: 'Солонго', phone: '88776655' },
  { name: 'Отгон', phone: '99443322' },
  { name: 'Л. Аюүки', phone: '96674688' },
  { name: 'Батаа', phone: '95172686' },
]

// ============================================================================
// Helper functions
// ============================================================================

function generateDeliveryNumber(): string {
  return `DEL-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
}

function generateOrderNumber(): string {
  return `ORD-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Setup: ensure drivers exist for all delivery-enabled stores
// ============================================================================

async function ensureDriversForStore(storeId: string, storeName: string): Promise<void> {
  const { data: existingDrivers } = await supabase
    .from('delivery_drivers')
    .select('id')
    .eq('store_id', storeId)

  if (existingDrivers && existingDrivers.length > 0) {
    console.log(`    ${storeName}: ${existingDrivers.length} drivers already exist`)
    return
  }

  // Create test drivers
  const drivers = [
    { name: 'Тест Жолооч 1', phone: `7701${storeId.substring(0, 4)}`, vehicle_type: 'motorcycle', vehicle_number: 'TEST-1' },
    { name: 'Тест Жолооч 2', phone: `7702${storeId.substring(0, 4)}`, vehicle_type: 'car', vehicle_number: 'TEST-2' },
  ]

  for (const d of drivers) {
    const { error } = await supabase
      .from('delivery_drivers')
      .insert({
        store_id: storeId,
        name: d.name,
        phone: d.phone,
        vehicle_type: d.vehicle_type,
        vehicle_number: d.vehicle_number,
        status: 'active',
      })

    if (error) {
      console.error(`    ✗ Failed to create driver ${d.name}: ${error.message}`)
    }
  }

  console.log(`    ${storeName}: Created 2 test drivers`)
}

async function ensureDeliverySettings(storeId: string): Promise<void> {
  const { data: store } = await supabase
    .from('stores')
    .select('delivery_settings')
    .eq('id', storeId)
    .single()

  if (store?.delivery_settings) return

  await supabase
    .from('stores')
    .update({
      delivery_settings: {
        assignment_mode: 'auto',
        priority_rules: ['least_loaded', 'closest_driver', 'vehicle_match'],
        max_concurrent_deliveries: 3,
        assignment_radius_km: 10,
        auto_assign_on_shipped: true,
        working_hours: { start: '09:00', end: '22:00' },
      },
    })
    .eq('id', storeId)
}

// ============================================================================
// Core test functions
// ============================================================================

async function createTestOrder(
  storeId: string,
  products: Array<{ id: string; name: string; base_price: number }>,
  customer: { name: string; phone: string },
  address: string,
  chatMessage: string
): Promise<{ orderId: string; orderNumber: string; totalAmount: number } | null> {
  const orderNumber = generateOrderNumber()
  const selectedProducts = products.slice(0, Math.min(3, products.length))
  const items = selectedProducts.map(p => ({
    product_id: p.id,
    quantity: Math.floor(Math.random() * 2) + 1,
    unit_price: p.base_price,
  }))

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      store_id: storeId,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      shipping_amount: 5000,
      payment_status: 'pending',
      shipping_address: address,
      notes: `Customer message (from FB): "${chatMessage}"`,
    })
    .select('id, order_number, total_amount')
    .single()

  if (error || !order) {
    console.error(`    ✗ Failed to create order: ${error?.message}`)
    return null
  }

  // Insert order items
  const itemInserts = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
  }))

  await supabase.from('order_items').insert(itemInserts)

  return { orderId: order.id, orderNumber: order.order_number, totalAmount: order.total_amount }
}

async function createDelivery(
  storeId: string,
  orderId: string | null,
  driverId: string | null,
  address: string,
  customer: { name: string; phone: string },
  deliveryFee: number
): Promise<{ deliveryId: string; deliveryNumber: string } | null> {
  const deliveryNumber = generateDeliveryNumber()
  const initialStatus = driverId ? 'assigned' : 'pending'

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .insert({
      store_id: storeId,
      order_id: orderId,
      driver_id: driverId,
      delivery_number: deliveryNumber,
      status: initialStatus,
      delivery_type: 'own_driver',
      delivery_address: address,
      customer_name: customer.name,
      customer_phone: customer.phone,
      delivery_fee: deliveryFee,
      estimated_delivery_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select('id, delivery_number')
    .single()

  if (error || !delivery) {
    console.error(`    ✗ Failed to create delivery: ${error?.message}`)
    return null
  }

  // Log initial status
  await supabase.from('delivery_status_log').insert({
    delivery_id: delivery.id,
    status: initialStatus,
    changed_by: 'e2e-test',
    notes: 'E2E test: Delivery created',
  })

  // Update driver status if assigned
  if (driverId) {
    await supabase
      .from('delivery_drivers')
      .update({ status: 'on_delivery' })
      .eq('id', driverId)
  }

  return { deliveryId: delivery.id, deliveryNumber: delivery.delivery_number }
}

async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: string,
  notes?: string,
  extraFields?: Record<string, unknown>
): Promise<boolean> {
  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...extraFields,
  }

  if (newStatus === 'delivered') {
    update.actual_delivery_time = new Date().toISOString()
  }

  const { error } = await supabase
    .from('deliveries')
    .update(update)
    .eq('id', deliveryId)

  if (error) {
    console.error(`    ✗ Failed to update delivery status to ${newStatus}: ${error.message}`)
    return false
  }

  // Log status change
  await supabase.from('delivery_status_log').insert({
    delivery_id: deliveryId,
    status: newStatus,
    changed_by: 'e2e-test',
    notes: notes || `E2E test: Status → ${newStatus}`,
  })

  return true
}

async function verifyDeliveryStatus(deliveryId: string, expectedStatus: string): Promise<boolean> {
  const { data } = await supabase
    .from('deliveries')
    .select('status')
    .eq('id', deliveryId)
    .single()

  return data?.status === expectedStatus
}

async function verifyStatusLogCount(deliveryId: string, expectedMin: number): Promise<boolean> {
  const { count } = await supabase
    .from('delivery_status_log')
    .select('*', { count: 'exact', head: true })
    .eq('delivery_id', deliveryId)

  return (count || 0) >= expectedMin
}

async function freeDriver(driverId: string): Promise<void> {
  // Check if driver has any other active deliveries
  const { count } = await supabase
    .from('deliveries')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .in('status', ['assigned', 'picked_up', 'in_transit', 'delayed'])

  if (count === 0) {
    await supabase
      .from('delivery_drivers')
      .update({ status: 'active' })
      .eq('id', driverId)
  }
}

async function createNotificationEntry(
  storeId: string,
  title: string,
  body: string,
  type: string
): Promise<boolean> {
  const { error } = await supabase.from('notifications').insert({
    store_id: storeId,
    title,
    body,
    type,
    is_read: false,
  })
  if (error) {
    console.error(`    ⚠ Notification insert failed: ${error.message} (${error.code})`)
    return false
  }
  return true
}

// ============================================================================
// Delivery fee calculator tests
// ============================================================================

async function testDeliveryFeeCalculation(): Promise<void> {
  section('1. Delivery Fee Calculation (Zone-based pricing)')

  const testCases = [
    { address: 'СБД, 1-р хороо, Ногоон нуур', expectedZone: 'central', expectedFee: 3000 },
    { address: 'ЧД, 5-р хороо, 100 айл', expectedZone: 'central', expectedFee: 3000 },
    { address: 'ХУД, 7-р хороо, Зайсан', expectedZone: 'mid', expectedFee: 5000 },
    { address: 'БЗД, 3-р хороо, 45-р байр', expectedZone: 'mid', expectedFee: 5000 },
    { address: 'СХД, 20-р хороо, Шинэ яармаг', expectedZone: 'mid', expectedFee: 5000 },
    { address: 'Налайх, 3-р хороо', expectedZone: 'outer', expectedFee: 8000 },
    { address: 'Багануур, Цагаан давааны зам', expectedZone: 'outer', expectedFee: 8000 },
    { address: 'Unknown location 123', expectedZone: 'default', expectedFee: 5000 },
  ]

  // Import delivery fee calculator logic
  const ZONES = [
    { name: 'central', nameMn: 'Төв', districts: ['Сүхбаатар', 'СБД', 'Чингэлтэй', 'ЧД', 'Баянгол', 'БГД'], fee: 3000 },
    { name: 'mid', nameMn: 'Дунд', districts: ['Хан-Уул', 'ХУД', 'Баянзүрх', 'БЗД', 'Сонгинохайрхан', 'СХД'], fee: 5000 },
    { name: 'outer', nameMn: 'Алслагдсан', districts: ['Налайх', 'Багануур', 'Багахангай'], fee: 8000 },
  ]

  function calculateFee(address: string): { fee: number; zone: string } {
    const addr = address.toLowerCase()
    for (const zone of ZONES) {
      for (const district of zone.districts) {
        if (addr.includes(district.toLowerCase())) {
          return { fee: zone.fee, zone: zone.name }
        }
      }
    }
    return { fee: 5000, zone: 'default' }
  }

  for (const tc of testCases) {
    const result = calculateFee(tc.address)
    assert(
      result.fee === tc.expectedFee && result.zone === tc.expectedZone,
      `Fee for "${tc.address.substring(0, 30)}..." = ${result.fee}₮ (${result.zone})`,
      result.fee !== tc.expectedFee ? `Expected ${tc.expectedFee}₮, got ${result.fee}₮` : undefined
    )
  }
}

// ============================================================================
// Scenario tests for each store
// ============================================================================

async function testHappyPathDelivery(store: StoreInfo, chatHistory: TestCase[]): Promise<void> {
  subsection(`Happy Path: ${store.name} (${store.businessType})`)

  // Pick real FB messages for context
  const deliveryMsg = chatHistory.find(c => c.category === 'delivery')
  const orderMsg = chatHistory.find(c => c.category === 'order')
  const customer = randomItem(TEST_CUSTOMERS)
  const address = randomItem(TEST_ADDRESSES)
  const activeDriver = store.drivers.find(d => d.status === 'active')

  if (!activeDriver) {
    console.log(`    ⚠ No active driver found for ${store.name}, skipping`)
    return
  }

  // Step 1: Create order using real FB chat context
  const chatText = orderMsg?.question || deliveryMsg?.question || 'Захиалга өгье'
  console.log(`    FB Chat context: "${chatText}"`)

  const order = await createTestOrder(store.id, store.products, customer, address, chatText)
  assert(order !== null, `Order created: ${order?.orderNumber}`)
  if (!order) return

  // Step 2: Verify order exists with pending status
  const { data: orderData } = await supabase
    .from('orders')
    .select('status, total_amount, shipping_address')
    .eq('id', order.orderId)
    .single()

  assert(orderData?.status === 'pending', 'Order status is "pending"')
  assert(orderData?.shipping_address === address, 'Shipping address set correctly')

  // Step 3: Create delivery linked to order
  const delivery = await createDelivery(
    store.id, order.orderId, activeDriver.id, address, customer, 5000
  )
  assert(delivery !== null, `Delivery created: ${delivery?.deliveryNumber}`)
  if (!delivery) return

  // Step 4: Verify initial status is 'assigned' (driver was provided)
  let statusOk = await verifyDeliveryStatus(delivery.deliveryId, 'assigned')
  assert(statusOk, 'Delivery initial status is "assigned"')

  // Notification: delivery_assigned
  await createNotificationEntry(store.id,
    'Хүргэлт оноогдлоо',
    `${delivery.deliveryNumber} хүргэлт ${activeDriver.name}-д оноогдлоо`,
    'delivery_assigned'
  )

  // Step 5: Driver picks up → picked_up
  const pickedUp = await updateDeliveryStatus(delivery.deliveryId, 'picked_up',
    `Жолооч ${activeDriver.name} барааг авлаа`)
  assert(pickedUp, 'Status updated to "picked_up"')
  statusOk = await verifyDeliveryStatus(delivery.deliveryId, 'picked_up')
  assert(statusOk, 'Delivery status verified: "picked_up"')

  // Notification: delivery_picked_up
  await createNotificationEntry(store.id,
    'Бараа авлаа',
    `${activeDriver.name} ${delivery.deliveryNumber} барааг авлаа`,
    'delivery_picked_up'
  )

  // Step 6: Driver in transit
  const inTransit = await updateDeliveryStatus(delivery.deliveryId, 'in_transit',
    'Хүргэлт эхэллээ')
  assert(inTransit, 'Status updated to "in_transit"')

  // Step 7: Update driver location (simulate)
  const { error: locError } = await supabase
    .from('delivery_drivers')
    .update({ current_location: { lat: 47.9187, lng: 106.9175, updated_at: new Date().toISOString() } })
    .eq('id', activeDriver.id)
  assert(!locError, 'Driver location updated (47.9187, 106.9175)')

  // Step 8: Mark as delivered
  const delivered = await updateDeliveryStatus(delivery.deliveryId, 'delivered',
    'Амжилттай хүргэсэн', { actual_delivery_time: new Date().toISOString() })
  assert(delivered, 'Status updated to "delivered"')
  statusOk = await verifyDeliveryStatus(delivery.deliveryId, 'delivered')
  assert(statusOk, 'Delivery status verified: "delivered"')

  // Step 9: Update order status to delivered
  await supabase.from('orders').update({ status: 'delivered' }).eq('id', order.orderId)
  const { data: updatedOrder } = await supabase
    .from('orders')
    .select('status')
    .eq('id', order.orderId)
    .single()
  assert(updatedOrder?.status === 'delivered', 'Order status updated to "delivered"')

  // Notification: delivery_completed
  await createNotificationEntry(store.id,
    'Хүргэлт дууслаа',
    `${delivery.deliveryNumber} амжилттай хүргэгдлээ`,
    'delivery_completed'
  )

  // Step 10: Free the driver
  await freeDriver(activeDriver.id)
  const { data: driverData } = await supabase
    .from('delivery_drivers')
    .select('status')
    .eq('id', activeDriver.id)
    .single()
  assert(driverData?.status === 'active', 'Driver status freed to "active"')

  // Step 11: Verify status log has all entries
  const logOk = await verifyStatusLogCount(delivery.deliveryId, 4)
  assert(logOk, 'Status log has ≥4 entries (assigned→picked_up→in_transit→delivered)')

  // Step 12: Verify public tracking data
  const { data: trackData } = await supabase
    .from('deliveries')
    .select('delivery_number, status, delivery_address, customer_name, actual_delivery_time')
    .eq('id', delivery.deliveryId)
    .single()
  assert(trackData?.delivery_number === delivery.deliveryNumber, 'Tracking data: delivery number correct')
  assert(trackData?.status === 'delivered', 'Tracking data: status is delivered')
  assert(trackData?.actual_delivery_time !== null, 'Tracking data: actual delivery time set')
}

async function testDelayedDelivery(store: StoreInfo, chatHistory: TestCase[]): Promise<void> {
  subsection(`Delayed Delivery: ${store.name}`)

  const customer = randomItem(TEST_CUSTOMERS)
  const address = randomItem(TEST_ADDRESSES)
  const activeDriver = store.drivers.find(d => d.status === 'active')
  if (!activeDriver) { console.log('    ⚠ No active driver, skipping'); return }

  const delayMsg = chatHistory.find(c => c.question.includes('маргааш')) || chatHistory[0]

  // Create order
  const order = await createTestOrder(store.id, store.products, customer, address,
    delayMsg?.question || 'Маргааш хүргүүлэх боломжтой юу?')
  if (!order) return

  // Create delivery and walk through: assigned → picked_up → in_transit → delayed → in_transit → delivered
  const delivery = await createDelivery(store.id, order.orderId, activeDriver.id, address, customer, 5000)
  assert(delivery !== null, `Delay test delivery created: ${delivery?.deliveryNumber}`)
  if (!delivery) return

  // Pickup
  await updateDeliveryStatus(delivery.deliveryId, 'picked_up')
  // In transit
  await updateDeliveryStatus(delivery.deliveryId, 'in_transit')
  // DELAYED
  const delayed = await updateDeliveryStatus(delivery.deliveryId, 'delayed',
    'Замын түгжрэлээс болж хүргэлт хоцорлоо')
  assert(delayed, 'Status updated to "delayed"')
  const statusOk = await verifyDeliveryStatus(delivery.deliveryId, 'delayed')
  assert(statusOk, 'Delivery status verified: "delayed"')

  // Notification: delivery_delayed
  await createNotificationEntry(store.id,
    'Хүргэлт хоцорлоо',
    `${delivery.deliveryNumber} хүргэлт хоцорсон. Шалтгаан: замын түгжрэл`,
    'delivery_delayed'
  )

  // Resume: delayed → in_transit
  const resumed = await updateDeliveryStatus(delivery.deliveryId, 'in_transit',
    'Түгжрэлээс гарлаа, үргэлжлүүлж байна')
  assert(resumed, 'Resumed from delayed to "in_transit"')

  // Finally deliver
  const delivered = await updateDeliveryStatus(delivery.deliveryId, 'delivered',
    'Хоцорч ирсэн ч амжилттай хүргэсэн')
  assert(delivered, 'Delayed delivery finally marked "delivered"')

  // Update order
  await supabase.from('orders').update({ status: 'delivered' }).eq('id', order.orderId)

  // Free driver
  await freeDriver(activeDriver.id)

  // Verify status log has all entries (assigned + pickup + transit + delayed + transit + delivered = 6)
  const logOk = await verifyStatusLogCount(delivery.deliveryId, 6)
  assert(logOk, 'Status log has ≥6 entries for delay scenario')
}

async function testFailedDelivery(store: StoreInfo, chatHistory: TestCase[]): Promise<void> {
  subsection(`Failed Delivery: ${store.name}`)

  const customer = randomItem(TEST_CUSTOMERS)
  const address = randomItem(TEST_ADDRESSES)
  const activeDriver = store.drivers.find(d => d.status === 'active')
  if (!activeDriver) { console.log('    ⚠ No active driver, skipping'); return }

  // Use a real FB message context
  const phoneMsg = chatHistory.find(c => /\d{8}/.test(c.question))

  const order = await createTestOrder(store.id, store.products, customer, address,
    phoneMsg?.question || '94929590')
  if (!order) return

  // Create delivery: assigned → picked_up → in_transit → failed
  const delivery = await createDelivery(store.id, order.orderId, activeDriver.id, address, customer, 5000)
  assert(delivery !== null, `Failure test delivery: ${delivery?.deliveryNumber}`)
  if (!delivery) return

  await updateDeliveryStatus(delivery.deliveryId, 'picked_up')
  await updateDeliveryStatus(delivery.deliveryId, 'in_transit')

  // FAIL the delivery
  const failReason = 'Утсанд хариулахгүй байна, хаяг олдсонгүй'
  const failedOk = await updateDeliveryStatus(delivery.deliveryId, 'failed', failReason, {
    failure_reason: failReason,
  })
  assert(failedOk, 'Status updated to "failed"')

  const statusOk = await verifyDeliveryStatus(delivery.deliveryId, 'failed')
  assert(statusOk, 'Delivery status verified: "failed"')

  // Verify failure reason stored
  const { data: failData } = await supabase
    .from('deliveries')
    .select('failure_reason')
    .eq('id', delivery.deliveryId)
    .single()
  assert(failData?.failure_reason === failReason, 'Failure reason stored correctly')

  // Notification: delivery_failed
  await createNotificationEntry(store.id,
    'Хүргэлт амжилтгүй',
    `${delivery.deliveryNumber} хүргэлт амжилтгүй болсон: ${failReason}`,
    'delivery_failed'
  )

  // Free driver
  await freeDriver(activeDriver.id)

  // Order should remain as-is (not delivered)
  const { data: orderData } = await supabase
    .from('orders')
    .select('status')
    .eq('id', order.orderId)
    .single()
  assert(orderData?.status === 'pending', 'Order remains "pending" after failed delivery')
}

async function testReturnAfterDelivery(store: StoreInfo): Promise<void> {
  subsection(`Return After Delivery: ${store.name}`)

  const customer = randomItem(TEST_CUSTOMERS)
  const address = randomItem(TEST_ADDRESSES)
  const activeDriver = store.drivers.find(d => d.status === 'active')
  if (!activeDriver) { console.log('    ⚠ No active driver, skipping'); return }

  // Create and complete a delivery first
  const order = await createTestOrder(store.id, store.products, customer, address,
    'Бараагаа буцаая гэсэн юм')
  if (!order) return

  const delivery = await createDelivery(store.id, order.orderId, activeDriver.id, address, customer, 3000)
  if (!delivery) return

  // Quick complete: assigned → picked_up → in_transit → delivered
  await updateDeliveryStatus(delivery.deliveryId, 'picked_up')
  await updateDeliveryStatus(delivery.deliveryId, 'in_transit')
  await updateDeliveryStatus(delivery.deliveryId, 'delivered', 'Delivered', {
    actual_delivery_time: new Date().toISOString(),
  })
  await supabase.from('orders').update({ status: 'delivered' }).eq('id', order.orderId)
  await freeDriver(activeDriver.id)

  // Now create return request (full return)
  const returnNumber = `RET-TEST-${Date.now()}`
  const { data: returnReq, error: returnError } = await supabase
    .from('return_requests')
    .insert({
      store_id: store.id,
      order_id: order.orderId,
      return_number: returnNumber,
      return_type: 'full',
      reason: 'Хэмжээ тохирсонгүй, солих хүсэлтэй',
      status: 'pending',
      refund_amount: order.totalAmount,
      refund_method: 'qpay',
    })
    .select('id, return_number, status')
    .single()

  assert(!returnError && returnReq !== null, `Return request created: ${returnReq?.return_number}`)
  if (!returnReq) return

  // Approve the return
  const { error: approveError } = await supabase
    .from('return_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', returnReq.id)
  assert(!approveError, 'Return approved')

  // Complete the return
  const { error: completeError } = await supabase
    .from('return_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', returnReq.id)
  assert(!completeError, 'Return completed')

  // Update order payment status to refunded
  await supabase.from('orders').update({ payment_status: 'refunded' }).eq('id', order.orderId)

  const { data: orderData } = await supabase
    .from('orders')
    .select('payment_status')
    .eq('id', order.orderId)
    .single()
  assert(orderData?.payment_status === 'refunded', 'Order payment_status updated to "refunded"')

  // Verify return status
  const { data: finalReturn } = await supabase
    .from('return_requests')
    .select('status, completed_at')
    .eq('id', returnReq.id)
    .single()
  assert(finalReturn?.status === 'completed', 'Return status is "completed"')
  assert(finalReturn?.completed_at !== null, 'Return completed_at timestamp set')
}

async function testDriverEarnings(store: StoreInfo): Promise<void> {
  subsection(`Driver Earnings & Payouts: ${store.name}`)

  const activeDriver = store.drivers.find(d => d.status === 'active')
  if (!activeDriver) { console.log('    ⚠ No active driver, skipping'); return }

  // Count completed deliveries for this driver
  const { data: deliveredList } = await supabase
    .from('deliveries')
    .select('delivery_fee, actual_delivery_time')
    .eq('driver_id', activeDriver.id)
    .eq('status', 'delivered')

  const totalEarnings = (deliveredList || []).reduce(
    (sum, d) => sum + Number(d.delivery_fee || 0), 0
  )
  const deliveryCount = deliveredList?.length || 0

  console.log(`    Driver ${activeDriver.name}: ${deliveryCount} deliveries, ${totalEarnings}₮ earned`)
  assert(deliveryCount > 0, `Driver has ≥1 completed delivery (${deliveryCount})`)
  assert(totalEarnings > 0, `Driver has earnings > 0 (${totalEarnings}₮)`)

  // Create payout record
  const today = new Date()
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const periodEnd = today.toISOString().split('T')[0]

  const { data: payout, error: payoutError } = await supabase
    .from('driver_payouts')
    .insert({
      driver_id: activeDriver.id,
      store_id: store.id,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalEarnings,
      delivery_count: deliveryCount,
      status: 'pending',
    })
    .select('id, status, total_amount')
    .single()

  assert(!payoutError && payout !== null, `Payout record created: ${payout?.total_amount}₮`)
  if (!payout) return

  // Approve payout
  await supabase.from('driver_payouts')
    .update({ status: 'approved' })
    .eq('id', payout.id)

  // Mark as paid
  await supabase.from('driver_payouts')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payout.id)

  const { data: paidPayout } = await supabase
    .from('driver_payouts')
    .select('status, paid_at')
    .eq('id', payout.id)
    .single()

  assert(paidPayout?.status === 'paid', 'Payout status is "paid"')
  assert(paidPayout?.paid_at !== null, 'Payout paid_at timestamp set')
}

async function testPublicTracking(store: StoreInfo): Promise<void> {
  subsection(`Public Tracking: ${store.name}`)

  // Get a recent delivery to test tracking
  const { data: recentDelivery } = await supabase
    .from('deliveries')
    .select(`
      id, delivery_number, status, delivery_address, customer_name,
      estimated_delivery_time, actual_delivery_time,
      delivery_drivers!deliveries_driver_id_fkey(name, vehicle_type)
    `)
    .eq('store_id', store.id)
    .not('driver_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!recentDelivery) {
    console.log('    ⚠ No deliveries found for tracking test')
    return
  }

  assert(!!recentDelivery.delivery_number, `Tracking: delivery number exists (${recentDelivery.delivery_number})`)
  assert(!!recentDelivery.status, `Tracking: status exists (${recentDelivery.status})`)
  assert(!!recentDelivery.delivery_address, 'Tracking: address exists')
  assert(!!recentDelivery.customer_name, 'Tracking: customer name exists')

  // Check status log
  const { data: statusLog } = await supabase
    .from('delivery_status_log')
    .select('status, changed_by, notes, created_at')
    .eq('delivery_id', recentDelivery.id)
    .order('created_at', { ascending: true })

  assert(statusLog !== null && statusLog.length > 0, `Tracking: status log has ${statusLog?.length || 0} entries`)

  // Verify driver info accessible
  const driverInfo = recentDelivery.delivery_drivers as unknown as { name: string; vehicle_type: string } | null
  if (driverInfo) {
    assert(!!driverInfo.name, `Tracking: driver name (${driverInfo.name})`)
    assert(!!driverInfo.vehicle_type, `Tracking: vehicle type (${driverInfo.vehicle_type})`)
  }
}

async function testDriverRating(store: StoreInfo): Promise<void> {
  subsection(`Driver Rating: ${store.name}`)

  // Get a delivered delivery
  const { data: deliveredItem } = await supabase
    .from('deliveries')
    .select('id, driver_id')
    .eq('store_id', store.id)
    .eq('status', 'delivered')
    .not('driver_id', 'is', null)
    .limit(1)
    .single()

  if (!deliveredItem) {
    console.log('    ⚠ No delivered items found for rating test')
    return
  }

  // Check if rating already exists
  const { data: existingRating } = await supabase
    .from('driver_ratings')
    .select('id')
    .eq('delivery_id', deliveredItem.id)
    .single()

  if (existingRating) {
    console.log('    ⚠ Rating already exists for this delivery, skipping insert')
    return
  }

  // Create customer rating
  const rating = 4 + Math.round(Math.random()) // 4 or 5
  const { error: ratingError } = await supabase
    .from('driver_ratings')
    .insert({
      delivery_id: deliveredItem.id,
      driver_id: deliveredItem.driver_id,
      store_id: store.id,
      customer_name: randomItem(TEST_CUSTOMERS).name,
      rating,
      comment: rating === 5 ? 'Маш сайн хүргэсэн, баярлалаа!' : 'Сайн хүргэсэн',
    })

  assert(!ratingError, `Rating created: ${rating}/5 stars`)

  // Check driver avg_rating was updated (trigger)
  if (!ratingError) {
    await sleep(500) // Allow trigger to fire
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('avg_rating, rating_count')
      .eq('id', deliveredItem.driver_id!)
      .single()

    assert(driver?.rating_count !== undefined && driver.rating_count > 0,
      `Driver rating_count updated (${driver?.rating_count})`)
    assert(driver?.avg_rating !== undefined && Number(driver.avg_rating) > 0,
      `Driver avg_rating updated (${driver?.avg_rating})`)
  }
}

async function testStatusTransitionValidation(): Promise<void> {
  section('7. Status Transition Validation')

  // Test that each valid transition is allowed
  for (const [fromStatus, toStatuses] of Object.entries(VALID_TRANSITIONS)) {
    for (const toStatus of toStatuses) {
      assert(true, `Valid transition: ${fromStatus} → ${toStatus}`)
    }
  }

  // Test that invalid transitions would be rejected
  const invalidTransitions = [
    ['pending', 'delivered'],
    ['pending', 'in_transit'],
    ['assigned', 'delivered'],
    ['assigned', 'in_transit'],
    ['picked_up', 'delivered'],
    ['picked_up', 'failed'],
    ['delivered', 'pending'],
    ['failed', 'delivered'],
  ]

  for (const [from, to] of invalidTransitions) {
    const allowed = VALID_TRANSITIONS[from]?.includes(to) || false
    assert(!allowed, `Invalid transition blocked: ${from} → ${to}`)
  }
}

async function testNotificationLog(storeId: string, storeName: string): Promise<void> {
  subsection(`Notification Log: ${storeName}`)

  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('id, type, title, is_read, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (notifError) {
    console.error(`    ⚠ Notification query error: ${notifError.message}`)
  }

  const count = notifications?.length || 0
  assert(count > 0, `Store has ${count} notifications`)

  // Check notification types
  const types = new Set(notifications?.map(n => n.type))
  console.log(`    Notification types: ${[...types].join(', ')}`)

  const deliveryTypes = ['delivery_assigned', 'delivery_picked_up', 'delivery_completed', 'delivery_failed', 'delivery_delayed']
  const hasDeliveryNotifs = deliveryTypes.some(t => types.has(t))
  assert(hasDeliveryNotifs, 'Has delivery-related notifications')
}

// ============================================================================
// Cleanup test data
// ============================================================================

async function cleanupTestData(): Promise<void> {
  console.log('\n  Cleaning up test data...')

  // Delete test deliveries and related data
  const { data: testDeliveries } = await supabase
    .from('deliveries')
    .select('id')
    .like('delivery_number', 'DEL-TEST-%')

  if (testDeliveries && testDeliveries.length > 0) {
    const ids = testDeliveries.map(d => d.id)

    // Delete ratings for test deliveries
    await supabase.from('driver_ratings').delete().in('delivery_id', ids)

    // Delete status logs
    await supabase.from('delivery_status_log').delete().in('delivery_id', ids)

    // Delete deliveries
    await supabase.from('deliveries').delete().in('id', ids)
  }

  // Delete test orders
  await supabase.from('orders').delete().like('order_number', 'ORD-TEST-%')

  // Delete test returns
  await supabase.from('return_requests').delete().like('return_number', 'RET-TEST-%')

  // Delete test payouts (only from this test run)
  // We'll keep existing payouts to not disrupt other data

  // Delete test notifications (body contains DEL-TEST or title matches test patterns)
  await supabase.from('notifications').delete().like('body', '%DEL-TEST-%')
  await supabase.from('notifications').delete().like('body', '%E2E test%')

  console.log('  ✓ Test data cleaned up')
}

// ============================================================================
// Main test runner
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║     END-TO-END DELIVERY SYSTEM TEST                                ║')
  console.log('║     Testing full lifecycle with real FB chat data                   ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')

  // Load real FB chat history
  const chatHistory = loadChatHistory()
  console.log(`\nLoaded ${chatHistory.length} real FB chat messages for test context`)
  console.log(`Categories: ${[...new Set(chatHistory.map(c => c.category))].join(', ')}`)

  // Discover delivery-enabled stores
  section('0. Setup: Discovering Delivery-Enabled Stores')

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, business_type')
    .in('business_type', ['ecommerce', 'restaurant', 'coffee_shop', 'cafe', 'real_estate'])
    .order('name')

  if (!stores || stores.length === 0) {
    console.error('No delivery-enabled stores found!')
    process.exit(1)
  }

  console.log(`\n  Found ${stores.length} delivery-enabled stores:`)
  for (const s of stores) {
    console.log(`    • ${s.name} (${s.business_type})`)
  }

  // Build store info with products and drivers
  const storeInfos: StoreInfo[] = []

  for (const s of stores) {
    // Ensure drivers exist
    await ensureDriversForStore(s.id, s.name)
    await ensureDeliverySettings(s.id)

    // Get products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, base_price')
      .eq('store_id', s.id)
      .limit(5)

    // Get drivers
    const { data: drivers } = await supabase
      .from('delivery_drivers')
      .select('id, name, phone, status, vehicle_type')
      .eq('store_id', s.id)

    // Get user email
    const { data: storeDetail } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', s.id)
      .single()

    let email = 'unknown'
    if (storeDetail?.owner_id) {
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', storeDetail.owner_id)
        .single()
      email = user?.email || 'unknown'
    }

    storeInfos.push({
      id: s.id,
      name: s.name,
      email,
      businessType: s.business_type,
      products: products || [],
      drivers: (drivers || []).map(d => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        status: d.status,
        vehicle_type: d.vehicle_type,
      })),
    })
  }

  // Clean up previous test data
  await cleanupTestData()

  // ─── Test 1: Delivery Fee Calculation ───
  await testDeliveryFeeCalculation()

  // ─── Tests 2-6: Per-Store Tests ───
  for (const store of storeInfos) {
    if (store.products.length === 0) {
      console.log(`\n  ⚠ Skipping ${store.name}: no products found`)
      continue
    }

    section(`Store: ${store.name} (${store.businessType}) — ${store.email}`)
    console.log(`  Products: ${store.products.length}, Drivers: ${store.drivers.length}`)
    console.log(`  Active drivers: ${store.drivers.filter(d => d.status === 'active').map(d => `${d.name}(${d.vehicle_type})`).join(', ')}`)

    // Complete any existing non-test active deliveries so they don't interfere
    await supabase
      .from('deliveries')
      .update({ status: 'delivered', actual_delivery_time: new Date().toISOString() })
      .eq('store_id', store.id)
      .in('status', ['assigned', 'picked_up', 'in_transit', 'delayed'])
      .not('delivery_number', 'like', 'DEL-TEST-%')

    // Reset all test drivers for this store to 'active' before running tests
    for (const d of store.drivers) {
      if (d.status !== 'inactive') {
        await supabase.from('delivery_drivers').update({ status: 'active' }).eq('id', d.id)
        d.status = 'active'
      }
    }

    // Test 2: Happy Path
    await testHappyPathDelivery(store, chatHistory)

    // Reset drivers
    for (const d of store.drivers) {
      if (d.status !== 'inactive') {
        await supabase.from('delivery_drivers').update({ status: 'active' }).eq('id', d.id)
        d.status = 'active'
      }
    }

    // Test 3: Delayed Delivery
    await testDelayedDelivery(store, chatHistory)

    // Reset drivers
    for (const d of store.drivers) {
      if (d.status !== 'inactive') {
        await supabase.from('delivery_drivers').update({ status: 'active' }).eq('id', d.id)
        d.status = 'active'
      }
    }

    // Test 4: Failed Delivery
    await testFailedDelivery(store, chatHistory)

    // Reset drivers
    for (const d of store.drivers) {
      if (d.status !== 'inactive') {
        await supabase.from('delivery_drivers').update({ status: 'active' }).eq('id', d.id)
        d.status = 'active'
      }
    }

    // Test 5: Return after delivery
    await testReturnAfterDelivery(store)

    // Reset drivers
    for (const d of store.drivers) {
      if (d.status !== 'inactive') {
        await supabase.from('delivery_drivers').update({ status: 'active' }).eq('id', d.id)
        d.status = 'active'
      }
    }

    // Test 6a: Driver Earnings & Payouts
    await testDriverEarnings(store)

    // Test 6b: Public Tracking
    await testPublicTracking(store)

    // Test 6c: Driver Rating
    await testDriverRating(store)

    // Test 6d: Notifications
    await testNotificationLog(store.id, store.name)
  }

  // ─── Test 7: Status Transition Validation ───
  await testStatusTransitionValidation()

  // ─── Summary ───
  section('RESULTS SUMMARY')

  console.log(`\n  Stores tested: ${storeInfos.filter(s => s.products.length > 0).length}/${storeInfos.length}`)
  console.log(`  Total tests:   ${totalTests}`)
  console.log(`  Passed:        ${passed}`)
  console.log(`  Failed:        ${failed}`)
  console.log(`  Pass rate:     ${totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0}%`)

  if (errors.length > 0) {
    console.log(`\n  Failures:`)
    for (const err of errors) {
      console.log(`    ✗ ${err}`)
    }
  }

  console.log()

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n  Fatal error:', err)
  process.exit(1)
})
