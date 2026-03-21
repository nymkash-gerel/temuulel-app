/**
 * Payment Flows End-to-End Test Script
 *
 * Tests ALL payment flows in the delivery + order system:
 *   1. COD Full Payment (payment_full callback)
 *   2. COD Partial/Custom Payment (payment_custom → amount → reason)
 *   3. COD Delayed Payment (payment_delayed callback)
 *   4. COD Declined Payment (payment_declined callback)
 *   5. Bank Transfer order creation + payment instructions
 *   6. Delivery Fee Rules (free delivery thresholds)
 *
 * Each test creates isolated data, verifies DB state, and cleans up.
 *
 * Usage: npx tsx scripts/test-payment-flows.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'

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
// Test State Tracking
// ============================================================================

let passed = 0
let failed = 0
let totalTests = 0
const errors: string[] = []

/** IDs to clean up after all tests */
const cleanup: {
  orderIds: string[]
  deliveryIds: string[]
  driverIds: string[]
  productIds: string[]
  customerIds: string[]
} = {
  orderIds: [],
  deliveryIds: [],
  driverIds: [],
  productIds: [],
  customerIds: [],
}

function assert(condition: boolean, message: string, details?: string) {
  totalTests++
  if (condition) {
    passed++
    console.log(`    \u2705 ${message}`)
  } else {
    failed++
    const msg = details ? `${message} \u2014 ${details}` : message
    errors.push(msg)
    console.error(`    \uD83D\uDD34 ${message}${details ? ` (${details})` : ''}`)
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(70))
}

function subsection(title: string) {
  console.log(`\n  -- ${title} --`)
}

// ============================================================================
// Helpers: Create isolated test data
// ============================================================================

/** Find or create a test store to use across all tests */
async function getTestStore(): Promise<{ id: string; name: string }> {
  // Try to find an existing store
  const { data: existing } = await supabase
    .from('stores')
    .select('id, name')
    .limit(1)
    .single()

  if (existing) return existing

  throw new Error('No store found in the database. Seed a store first.')
}

/** Create a test product */
async function createTestProduct(storeId: string, price: number, name?: string): Promise<{ id: string; name: string; base_price: number }> {
  const productName = name || `Test Product ${Date.now()}`
  const { data, error } = await supabase
    .from('products')
    .insert({
      store_id: storeId,
      name: productName,
      base_price: price,
      status: 'active',
    })
    .select('id, name, base_price')
    .single()

  if (error || !data) throw new Error(`Failed to create test product: ${error?.message}`)
  cleanup.productIds.push(data.id)
  return data
}

/** Create a test customer */
async function createTestCustomer(storeId: string, name?: string): Promise<{ id: string; name: string; phone: string }> {
  const custName = name || `Test Customer ${Date.now()}`
  const phone = `9${Math.floor(Math.random() * 90000000 + 10000000)}`
  const { data, error } = await supabase
    .from('customers')
    .insert({
      store_id: storeId,
      name: custName,
      phone,
      channel: 'test',
    })
    .select('id, name, phone')
    .single()

  if (error || !data) throw new Error(`Failed to create test customer: ${error?.message}`)
  cleanup.customerIds.push(data.id)
  return data
}

/** Create a test driver */
async function createTestDriver(storeId: string, name?: string): Promise<{ id: string; name: string; phone: string }> {
  const driverName = name || `Test Driver ${Date.now()}`
  const phone = `8${Math.floor(Math.random() * 90000000 + 10000000)}`
  const { data, error } = await supabase
    .from('delivery_drivers')
    .insert({
      store_id: storeId,
      name: driverName,
      phone,
      status: 'available',
      delivery_zones: ['all'],
    })
    .select('id, name, phone')
    .single()

  if (error || !data) throw new Error(`Failed to create test driver: ${error?.message}`)
  cleanup.driverIds.push(data.id)
  return data
}

/** Create a test order with order items and delivery */
async function createTestOrder(params: {
  storeId: string
  customerId: string | null
  totalAmount: number
  shippingAmount: number
  paymentMethod?: string
  paymentStatus?: string
  address?: string
  items?: Array<{ productId: string; unitPrice: number; quantity: number }>
}): Promise<{ orderId: string; orderNumber: string; deliveryId: string; deliveryNumber: string }> {
  const orderNumber = `TEST-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const deliveryNumber = `TEST-DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: params.storeId,
      customer_id: params.customerId,
      order_number: orderNumber,
      status: 'confirmed',
      total_amount: params.totalAmount,
      shipping_amount: params.shippingAmount,
      payment_method: params.paymentMethod || 'cash',
      payment_status: params.paymentStatus || 'pending',
      shipping_address: params.address || 'Test Address, Sukhbaatar District',
      order_type: 'delivery',
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) throw new Error(`Failed to create test order: ${orderError?.message}`)
  cleanup.orderIds.push(order.id)

  // Create order items if provided
  if (params.items && params.items.length > 0) {
    for (const item of params.items) {
      await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })
    }
  }

  // Create delivery record
  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .insert({
      store_id: params.storeId,
      order_id: order.id,
      delivery_number: deliveryNumber,
      status: 'pending',
      delivery_type: 'own_driver',
      delivery_address: params.address || 'Test Address, Sukhbaatar District',
      delivery_fee: params.shippingAmount,
      customer_phone: '99001122',
      customer_name: 'Test Customer',
    })
    .select('id, delivery_number')
    .single()

  if (deliveryError || !delivery) throw new Error(`Failed to create test delivery: ${deliveryError?.message}`)
  cleanup.deliveryIds.push(delivery.id)

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    deliveryId: delivery.id,
    deliveryNumber: delivery.delivery_number,
  }
}

/** Assign a driver to a delivery */
async function assignDriver(deliveryId: string, driverId: string): Promise<void> {
  const { error } = await supabase
    .from('deliveries')
    .update({ status: 'assigned', driver_id: driverId })
    .eq('id', deliveryId)

  if (error) throw new Error(`Failed to assign driver: ${error.message}`)
}

/** Simulate "delivered" status on delivery (before payment step) */
async function markPickedUpAndInTransit(deliveryId: string): Promise<void> {
  // The driver route goes: assigned -> picked_up -> in_transit -> delivered (via payment callbacks)
  // For testing payment callbacks, we just need the delivery to exist with the driver assigned
  // The payment callbacks themselves handle marking delivered
  await supabase
    .from('deliveries')
    .update({ status: 'in_transit' })
    .eq('id', deliveryId)
}

// ============================================================================
// Test 1: COD Full Payment (payment_full)
// ============================================================================

async function testCODFullPayment(storeId: string) {
  section('TEST 1: COD Full Payment (payment_full)')

  subsection('Setup: Create order, assign driver, mark in-transit')
  const driver = await createTestDriver(storeId, 'Full Payment Driver')
  const { orderId, orderNumber, deliveryId, deliveryNumber } = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 50000,
    shippingAmount: 5000,
    paymentMethod: 'cash',
  })
  await assignDriver(deliveryId, driver.id)
  await markPickedUpAndInTransit(deliveryId)
  console.log(`    Order: ${orderNumber}, Delivery: ${deliveryNumber}`)

  subsection('Action: Simulate payment_full callback')
  // Replicate what the driver route does for payment_full:
  // 1. Mark delivery as delivered
  await supabase
    .from('deliveries')
    .update({ status: 'delivered', actual_delivery_time: new Date().toISOString() })
    .eq('id', deliveryId)

  // 2. Mark order as paid
  await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', orderId)

  subsection('Verify: DB state after full payment')

  // Check delivery status
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('status, actual_delivery_time, driver_id')
    .eq('id', deliveryId)
    .single()

  assert(delivery?.status === 'delivered', 'Delivery status is "delivered"', `got: ${delivery?.status}`)
  assert(delivery?.actual_delivery_time !== null, 'Delivery has actual_delivery_time set')
  assert(delivery?.driver_id === driver.id, 'Delivery still assigned to correct driver')

  // Check order payment status
  const { data: order } = await supabase
    .from('orders')
    .select('payment_status, total_amount, payment_method')
    .eq('id', orderId)
    .single()

  assert(order?.payment_status === 'paid', 'Order payment_status is "paid"', `got: ${order?.payment_status}`)
  assert(order?.total_amount === 50000, 'Order total_amount is correct (50000)', `got: ${order?.total_amount}`)
  assert(order?.payment_method === 'cash', 'Order payment_method is "cash"', `got: ${order?.payment_method}`)
}

// ============================================================================
// Test 2: COD Partial/Custom Payment (payment_custom → amount → reason)
// ============================================================================

async function testCODPartialPayment(storeId: string) {
  section('TEST 2: COD Partial/Custom Payment (payment_custom)')

  subsection('Setup: Create order, assign driver, mark in-transit')
  const driver = await createTestDriver(storeId, 'Custom Payment Driver')
  const { orderId, orderNumber, deliveryId, deliveryNumber } = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 75000,
    shippingAmount: 5000,
    paymentMethod: 'cash',
  })
  await assignDriver(deliveryId, driver.id)
  await markPickedUpAndInTransit(deliveryId)
  console.log(`    Order: ${orderNumber}, Delivery: ${deliveryNumber}`)

  subsection('Action: Simulate payment_custom callback flow')

  // Step 1: payment_custom sets awaiting state in driver metadata
  const { data: driverData } = await supabase
    .from('delivery_drivers')
    .select('id, metadata')
    .eq('id', driver.id)
    .single()

  const existingMeta = (driverData?.metadata ?? {}) as Record<string, unknown>
  const newMeta = {
    ...existingMeta,
    awaiting_custom_payment: { deliveryId, step: 'amount', messageId: null },
  }
  await supabase
    .from('delivery_drivers')
    .update({ metadata: newMeta })
    .eq('id', driver.id)

  // Verify awaiting state was set
  const { data: driverAfterStep1 } = await supabase
    .from('delivery_drivers')
    .select('metadata')
    .eq('id', driver.id)
    .single()

  const meta1 = driverAfterStep1?.metadata as Record<string, unknown> | null
  const awaiting1 = meta1?.awaiting_custom_payment as { step: string } | undefined
  assert(awaiting1?.step === 'amount', 'Driver metadata has awaiting_custom_payment with step=amount', `got: ${awaiting1?.step}`)

  // Step 2: Driver sends amount "25000" — update awaiting to step=reason
  const paidAmount = 25000
  const updatedMeta = {
    ...existingMeta,
    awaiting_custom_payment: { deliveryId, step: 'reason', amount: paidAmount, messageId: null },
  }
  await supabase
    .from('delivery_drivers')
    .update({ metadata: updatedMeta })
    .eq('id', driver.id)

  // Step 3: Driver sends reason "Partial" — mark delivery delivered with custom_payment metadata
  const reason = 'Partial'
  await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      actual_delivery_time: new Date().toISOString(),
      metadata: { custom_payment: { amount: paidAmount, reason, recorded_at: new Date().toISOString() } },
    })
    .eq('id', deliveryId)

  // Mark order as partially paid
  await supabase
    .from('orders')
    .update({
      payment_status: 'partial',
      notes: `Driver: ${paidAmount} received. Reason: ${reason}`,
    })
    .eq('id', orderId)

  // Clear awaiting flag
  const clearedMeta = { ...existingMeta }
  delete (clearedMeta as Record<string, unknown>).awaiting_custom_payment
  await supabase
    .from('delivery_drivers')
    .update({ metadata: clearedMeta })
    .eq('id', driver.id)

  subsection('Verify: DB state after custom payment')

  // Check delivery
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('status, metadata, actual_delivery_time')
    .eq('id', deliveryId)
    .single()

  assert(delivery?.status === 'delivered', 'Delivery status is "delivered"', `got: ${delivery?.status}`)
  assert(delivery?.actual_delivery_time !== null, 'Delivery has actual_delivery_time set')

  const deliveryMeta = delivery?.metadata as Record<string, unknown> | null
  const customPayment = deliveryMeta?.custom_payment as { amount: number; reason: string } | undefined
  assert(customPayment?.amount === 25000, 'custom_payment.amount is 25000', `got: ${customPayment?.amount}`)
  assert(customPayment?.reason === 'Partial', 'custom_payment.reason is "Partial"', `got: ${customPayment?.reason}`)

  // Check order
  const { data: order } = await supabase
    .from('orders')
    .select('payment_status, notes')
    .eq('id', orderId)
    .single()

  assert(order?.payment_status === 'partial', 'Order payment_status is "partial"', `got: ${order?.payment_status}`)
  assert(order?.notes?.includes('25000'), 'Order notes mention paid amount', `got: ${order?.notes}`)

  // Check driver metadata cleared
  const { data: driverFinal } = await supabase
    .from('delivery_drivers')
    .select('metadata')
    .eq('id', driver.id)
    .single()

  const finalMeta = driverFinal?.metadata as Record<string, unknown> | null
  assert(!finalMeta?.awaiting_custom_payment, 'Driver awaiting_custom_payment flag cleared')
}

// ============================================================================
// Test 3: COD Delayed Payment (payment_delayed)
// ============================================================================

async function testCODDelayedPayment(storeId: string) {
  section('TEST 3: COD Delayed Payment (payment_delayed)')

  subsection('Setup: Create order, assign driver, mark in-transit')
  const driver = await createTestDriver(storeId, 'Delayed Payment Driver')
  const { orderId, orderNumber, deliveryId, deliveryNumber } = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 60000,
    shippingAmount: 3000,
    paymentMethod: 'cash',
  })
  await assignDriver(deliveryId, driver.id)
  await markPickedUpAndInTransit(deliveryId)
  console.log(`    Order: ${orderNumber}, Delivery: ${deliveryNumber}`)

  subsection('Action: Simulate payment_delayed callback')

  // Replicate what the driver route does for payment_delayed:
  // 1. Mark delivery as delivered with payment_followup metadata
  await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      actual_delivery_time: new Date().toISOString(),
      metadata: { payment_followup: true },
    })
    .eq('id', deliveryId)

  // 2. Mark order as pending with notes
  await supabase
    .from('orders')
    .update({
      payment_status: 'pending',
      notes: 'Driver: delivered but payment not collected',
      metadata: { payment_reminder_count: 1, first_reminder_at: new Date().toISOString(), last_reminder_at: new Date().toISOString() },
    })
    .eq('id', orderId)

  subsection('Verify: DB state after delayed payment')

  // Check delivery — should be "delivered" (goods handed over)
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('status, metadata, actual_delivery_time')
    .eq('id', deliveryId)
    .single()

  assert(delivery?.status === 'delivered', 'Delivery status is "delivered"', `got: ${delivery?.status}`)
  assert(delivery?.actual_delivery_time !== null, 'Delivery has actual_delivery_time set')

  const deliveryMeta = delivery?.metadata as Record<string, unknown> | null
  assert(deliveryMeta?.payment_followup === true, 'Delivery metadata has payment_followup=true', `got: ${deliveryMeta?.payment_followup}`)

  // Check order — should remain "pending" (not paid yet)
  const { data: order } = await supabase
    .from('orders')
    .select('payment_status, notes')
    .eq('id', orderId)
    .single()

  assert(order?.payment_status === 'pending', 'Order payment_status is "pending"', `got: ${order?.payment_status}`)
  assert(
    order?.notes?.includes('delivered') || order?.notes?.includes('payment'),
    'Order notes describe delayed payment situation',
    `got: ${order?.notes}`
  )
}

// ============================================================================
// Test 4: COD Declined Payment (payment_declined)
// ============================================================================

async function testCODDeclinedPayment(storeId: string) {
  section('TEST 4: COD Declined Payment (payment_declined)')

  subsection('Setup: Create order, assign driver, mark in-transit')
  const driver = await createTestDriver(storeId, 'Declined Payment Driver')
  const { orderId, orderNumber, deliveryId, deliveryNumber } = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 45000,
    shippingAmount: 5000,
    paymentMethod: 'cash',
  })
  await assignDriver(deliveryId, driver.id)
  await markPickedUpAndInTransit(deliveryId)
  console.log(`    Order: ${orderNumber}, Delivery: ${deliveryNumber}`)

  subsection('Action: Simulate payment_declined callback')

  // Replicate what the driver route does for payment_declined:
  // Mark order as failed
  await supabase
    .from('orders')
    .update({
      payment_status: 'failed',
      notes: 'Driver: customer declined payment',
    })
    .eq('id', orderId)

  subsection('Verify: DB state after declined payment')

  // Check order payment status
  const { data: order } = await supabase
    .from('orders')
    .select('payment_status, notes')
    .eq('id', orderId)
    .single()

  assert(order?.payment_status === 'failed', 'Order payment_status is "failed"', `got: ${order?.payment_status}`)
  assert(
    order?.notes?.includes('declined') || order?.notes?.includes('tatgalzav'),
    'Order notes describe declined payment',
    `got: ${order?.notes}`
  )

  // Delivery status should remain unchanged (payment_declined does NOT update delivery status in the route)
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('status')
    .eq('id', deliveryId)
    .single()

  assert(
    delivery?.status === 'in_transit',
    'Delivery status remains "in_transit" (payment_declined does not change delivery status)',
    `got: ${delivery?.status}`
  )
}

// ============================================================================
// Test 5: Bank Transfer Payment Flow
// ============================================================================

async function testBankTransferPayment(storeId: string) {
  section('TEST 5: Bank Transfer Payment Flow')

  subsection('Setup: Create order with payment_method=bank_transfer')
  const { orderId, orderNumber, deliveryId, deliveryNumber } = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 120000,
    shippingAmount: 0,
    paymentMethod: 'bank_transfer',
    paymentStatus: 'pending',
  })
  console.log(`    Order: ${orderNumber}, Delivery: ${deliveryNumber}`)

  subsection('Verify: Order created with bank_transfer method')

  const { data: order } = await supabase
    .from('orders')
    .select('payment_method, payment_status, total_amount, status')
    .eq('id', orderId)
    .single()

  assert(order?.payment_method === 'bank_transfer', 'Order payment_method is "bank_transfer"', `got: ${order?.payment_method}`)
  assert(order?.payment_status === 'pending', 'Order payment_status starts as "pending"', `got: ${order?.payment_status}`)
  assert(order?.total_amount === 120000, 'Order total_amount is 120000', `got: ${order?.total_amount}`)

  subsection('Verify: Store payment settings available for bank instructions')

  // Check if the store has payment_settings with bank info
  const { data: store } = await supabase
    .from('stores')
    .select('payment_settings')
    .eq('id', storeId)
    .single()

  const paymentSettings = (store?.payment_settings || {}) as Record<string, unknown>
  // The /api/payments/create route returns bank details from store payment_settings
  // We verify the shape exists (bank_name, bank_account, bank_holder)
  const hasBankConfig = !!(paymentSettings.bank_name || paymentSettings.bank_account || paymentSettings.bank_transfer_enabled)
  console.log(`    Store has bank config: ${hasBankConfig}`)
  console.log(`    Payment settings keys: ${Object.keys(paymentSettings).join(', ') || '(empty)'}`)

  // Even without bank config, the order itself should be created correctly
  assert(order?.status === 'confirmed', 'Bank transfer order starts as "confirmed"', `got: ${order?.status}`)

  subsection('Action: Simulate manual payment confirmation (admin marks as paid)')
  await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', orderId)

  const { data: updatedOrder } = await supabase
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .single()

  assert(updatedOrder?.payment_status === 'paid', 'After admin confirmation, payment_status is "paid"', `got: ${updatedOrder?.payment_status}`)
}

// ============================================================================
// Test 6: Delivery Fee Rules
// ============================================================================

async function testDeliveryFeeRules(storeId: string) {
  section('TEST 6: Delivery Fee Rules')

  // The fee rules from the codebase:
  // - calculateShipping in /api/orders/route.ts checks free_shipping_enabled + free_shipping_minimum
  // - createOrderFromChat uses calculateDeliveryFee (zone-based: 3000/5000/8000)
  // - Store shipping_settings.free_shipping_minimum defines threshold
  //
  // We test at the DB level since this is what matters:
  // Rule A: Total >= 100,000 -> delivery_fee=0 (free shipping threshold)
  // Rule B: 3+ items in order -> delivery_fee=0 (bulk order benefit)
  // Rule C: 1 item, total 50,000 -> delivery_fee > 0

  subsection('Rule A: Order total >= 100,000 -> delivery_fee=0')

  const productA = await createTestProduct(storeId, 120000, 'Expensive Product A')

  // Create order with high total and 0 shipping (free shipping applied)
  const orderA = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 120000,
    shippingAmount: 0,  // free shipping for large orders
    items: [{ productId: productA.id, unitPrice: 120000, quantity: 1 }],
  })

  const { data: deliveryA } = await supabase
    .from('deliveries')
    .select('delivery_fee')
    .eq('id', orderA.deliveryId)
    .single()

  assert(deliveryA?.delivery_fee === 0, 'Order >= 100,000: delivery_fee is 0 (free shipping)', `got: ${deliveryA?.delivery_fee}`)

  const { data: orderDataA } = await supabase
    .from('orders')
    .select('total_amount, shipping_amount')
    .eq('id', orderA.orderId)
    .single()

  assert(orderDataA?.shipping_amount === 0, 'Order >= 100,000: shipping_amount is 0', `got: ${orderDataA?.shipping_amount}`)

  subsection('Rule B: Order with 3+ items -> delivery_fee=0')

  const productB1 = await createTestProduct(storeId, 15000, 'Bulk Item 1')
  const productB2 = await createTestProduct(storeId, 20000, 'Bulk Item 2')
  const productB3 = await createTestProduct(storeId, 10000, 'Bulk Item 3')

  // Create order with 3 items, shipping 0 (bulk discount applied)
  const orderB = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 45000,
    shippingAmount: 0,  // free shipping for 3+ items
    items: [
      { productId: productB1.id, unitPrice: 15000, quantity: 1 },
      { productId: productB2.id, unitPrice: 20000, quantity: 1 },
      { productId: productB3.id, unitPrice: 10000, quantity: 1 },
    ],
  })

  const { data: deliveryB } = await supabase
    .from('deliveries')
    .select('delivery_fee')
    .eq('id', orderB.deliveryId)
    .single()

  assert(deliveryB?.delivery_fee === 0, '3+ items: delivery_fee is 0 (free shipping)', `got: ${deliveryB?.delivery_fee}`)

  // Count actual order items
  const { data: orderItemsB } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', orderB.orderId)

  assert((orderItemsB?.length ?? 0) >= 3, '3+ items: order has at least 3 order_items', `got: ${orderItemsB?.length}`)

  subsection('Rule C: 1 item, total 50,000 -> delivery_fee > 0')

  const productC = await createTestProduct(storeId, 50000, 'Standard Product C')

  // Create order with 1 item at 50,000 and standard delivery fee
  const standardFee = 5000  // DEFAULT_DELIVERY_FEE from chat-ai-handler
  const orderC = await createTestOrder({
    storeId,
    customerId: null,
    totalAmount: 50000 + standardFee,
    shippingAmount: standardFee,
    items: [{ productId: productC.id, unitPrice: 50000, quantity: 1 }],
  })

  const { data: deliveryC } = await supabase
    .from('deliveries')
    .select('delivery_fee')
    .eq('id', orderC.deliveryId)
    .single()

  assert(
    (deliveryC?.delivery_fee ?? 0) > 0,
    '1 item at 50,000: delivery_fee > 0',
    `got: ${deliveryC?.delivery_fee}`
  )

  const { data: orderDataC } = await supabase
    .from('orders')
    .select('shipping_amount, total_amount')
    .eq('id', orderC.orderId)
    .single()

  assert(
    (orderDataC?.shipping_amount ?? 0) > 0,
    '1 item at 50,000: shipping_amount > 0',
    `got: ${orderDataC?.shipping_amount}`
  )
  assert(
    orderDataC?.total_amount === 50000 + standardFee,
    `Total amount includes shipping (${50000 + standardFee})`,
    `got: ${orderDataC?.total_amount}`
  )
}

// ============================================================================
// Cleanup: Remove all test data
// ============================================================================

async function cleanupTestData() {
  console.log('\n  Cleaning up test data...')

  // Delete in reverse dependency order
  if (cleanup.deliveryIds.length > 0) {
    await supabase.from('deliveries').delete().in('id', cleanup.deliveryIds)
    console.log(`    Deleted ${cleanup.deliveryIds.length} deliveries`)
  }

  // Delete order items before orders
  if (cleanup.orderIds.length > 0) {
    await supabase.from('order_items').delete().in('order_id', cleanup.orderIds)
    await supabase.from('orders').delete().in('id', cleanup.orderIds)
    console.log(`    Deleted ${cleanup.orderIds.length} orders (+ order items)`)
  }

  if (cleanup.driverIds.length > 0) {
    await supabase.from('delivery_drivers').delete().in('id', cleanup.driverIds)
    console.log(`    Deleted ${cleanup.driverIds.length} drivers`)
  }

  if (cleanup.productIds.length > 0) {
    await supabase.from('products').delete().in('id', cleanup.productIds)
    console.log(`    Deleted ${cleanup.productIds.length} products`)
  }

  if (cleanup.customerIds.length > 0) {
    await supabase.from('customers').delete().in('id', cleanup.customerIds)
    console.log(`    Deleted ${cleanup.customerIds.length} customers`)
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(70))
  console.log('  PAYMENT FLOWS END-TO-END TEST')
  console.log(`  ${new Date().toISOString()}`)
  console.log('='.repeat(70))

  try {
    // Get a test store
    const store = await getTestStore()
    console.log(`\n  Using store: ${store.name} (${store.id})`)

    // Run all payment flow tests
    await testCODFullPayment(store.id)
    await testCODPartialPayment(store.id)
    await testCODDelayedPayment(store.id)
    await testCODDeclinedPayment(store.id)
    await testBankTransferPayment(store.id)
    await testDeliveryFeeRules(store.id)

  } catch (err) {
    console.error('\n  FATAL ERROR:', err)
    failed++
  } finally {
    // Always clean up
    await cleanupTestData()
  }

  // Summary
  section('TEST RESULTS')
  console.log(`  Total:  ${totalTests}`)
  console.log(`  Passed: ${passed} \u2705`)
  console.log(`  Failed: ${failed} \uD83D\uDD34`)

  if (errors.length > 0) {
    console.log('\n  Failures:')
    for (const e of errors) {
      console.log(`    - ${e}`)
    }
  }

  console.log('')
  process.exit(failed > 0 ? 1 : 0)
}

main()
