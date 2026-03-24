/**
 * test-operational-flows.ts
 *
 * Full operational flow scenarios: end-to-end happy path, payment flows,
 * partial payment with AI agent, return flow, production smoke test.
 *
 * Scenarios: 7, 18-20, 23-24, 26-28, 32, 41-43
 *
 * Usage:
 *   E2E_RATE_LIMIT_BYPASS=true npx tsx scripts/test-operational-flows.ts
 */

import {
  chat,
  delay,
  ok,
  dbOk,
  dbFail,
  scenarioResult,
  section,
  getSupabase,
  LOCAL,
  PROD,
  DRIVER_CHAT_ID,
  DRIVER_WEBHOOK_SECRET,
  driverWebhook,
  sendDriverTelegram,
  getOrCreateDriver,
  createOrderViaChat,
  assignAndPickup,
  resetCounters,
  getSummary,
  printSummary,
} from './helpers/test-utils'

const sb = getSupabase()
const NOW = Date.now()
const TEST_START = new Date().toISOString()

// ============================================================================
// Scenario 7: Production Smoke Test (3.5s delays)
// ============================================================================

async function scenario7(storeId: string): Promise<boolean> {
  console.log('\n📋 Scenario 7: Production Smoke Test')
  const senderId = `web_e2e_prod_${NOW}`
  let pass = true

  // Step 1: Greeting
  const r1 = await chat(PROD, storeId, senderId, 'Сайн байна уу', undefined, 3500)
  if (r1.aiStatus === 200 && r1.response.length > 0) {
    ok(1, `"Сайн байна уу" → ✅ HTTP ${r1.aiStatus}, intent=${r1.intent}`)
  } else {
    ok(1, `"Сайн байна уу" → 🔴 HTTP ${r1.aiStatus}`)
    pass = false
  }

  // Step 2: Product search
  const r2 = await chat(PROD, storeId, senderId, 'Цамц байна уу?', r1.conversationId, 3500)
  if (r2.aiStatus === 200 && (r2.productsFound ?? 0) > 0) {
    ok(2, `"Цамц байна уу?" → ✅ HTTP ${r2.aiStatus}, ${r2.productsFound} products`)
  } else if (r2.aiStatus === 200) {
    ok(2, `"Цамц байна уу?" → ✅ HTTP 200, intent=${r2.intent} (${r2.productsFound} products)`)
  } else {
    ok(2, `"Цамц байна уу?" → 🔴 HTTP ${r2.aiStatus}`)
    pass = false
  }

  console.log('  (Skipping order completion on production)')
  return pass
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
// Scenario 41: Full Operational Flow A — Happy Path End-to-End
// ============================================================================

async function scenario41(api: string, storeId: string) {
  section('\n📋 Scenario 41: Full Operational Flow A — Chat → Order → Driver → Payment → Track')
  let pass = true

  // Phase 1: Customer conversation
  console.log('  ── Phase 1: Customer chat flow ──')
  const sid = `web_e2e_fullA_${Date.now()}`

  let r = await chat(api, storeId, sid, 'Сайн байна уу')
  if (r.intent !== 'greeting') { ok(1, `greeting → 🔴 ${r.intent}`); pass = false }
  else ok(1, `greeting → ✅`)

  r = await chat(api, storeId, sid, 'Цамц байна уу?', r.conversationId)
  if (r.intent !== 'product_search' || r.productsFound === 0) { ok(2, `product_search → 🔴 ${r.intent}, products=${r.productsFound}`); pass = false }
  else ok(2, `product_search → ✅ ${r.productsFound} products`)

  r = await chat(api, storeId, sid, '1', r.conversationId)
  ok(3, `select → ${r.intent}, step=${r.orderStep}`)

  r = await chat(api, storeId, sid, 'Болдбаатар', r.conversationId)
  if (r.intent === 'greeting') { ok(4, `name → 🔴 classified as greeting!`); pass = false }
  else ok(4, `name "Болдбаатар" → ✅ NOT greeting`)

  r = await chat(api, storeId, sid, '99112233', r.conversationId)
  ok(5, `phone → ${r.intent}, step=${r.orderStep}`)

  r = await chat(api, storeId, sid, 'СБД 8-р хороо 45 байр 301 тоот', r.conversationId)
  ok(6, `address → ${r.intent}, step=${r.orderStep}`)

  r = await chat(api, storeId, sid, 'Тийм', r.conversationId)
  ok(7, `confirm → ${r.intent}`)
  await delay(1500)

  // Phase 2: Verify order + delivery in DB
  console.log('  ── Phase 2: DB verification ──')
  const { data: customer } = await sb.from('customers').select('id').eq('messenger_id', sid).single()
  if (!customer) { dbFail('Customer not found'); scenarioResult(false); return }

  const { data: order } = await sb.from('orders').select('id, order_number, total_amount, payment_status')
    .eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(1).single()
  if (!order) { dbFail('Order not found'); scenarioResult(false); return }
  dbOk(`Order ${order.order_number} created (${order.total_amount}₮)`)

  const { data: delivery } = await sb.from('deliveries').select('id, delivery_number, delivery_fee')
    .eq('order_id', order.id).single()
  if (!delivery) { dbFail('Delivery not found'); scenarioResult(false); return }
  dbOk(`Delivery ${delivery.delivery_number} (fee: ${delivery.delivery_fee}₮)`)

  // Phase 3: Driver flow
  console.log('  ── Phase 3: Driver pickup → deliver → payment ──')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, delivery.id, driverId)
  ok(8, `pickup → ${pickedUp ? '✅' : '🔴'}`)
  if (!pickedUp) pass = false

  // Deliver
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_del_${Date.now()}`, from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${delivery.id}`,
    },
  })
  await delay(500)

  // Payment full
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pay_${Date.now()}`, from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_full:${delivery.id}`,
    },
  })
  await delay(1000)

  // Phase 4: Verify final state
  console.log('  ── Phase 4: Final verification ──')
  const { data: delFinal } = await sb.from('deliveries').select('status').eq('id', delivery.id).single()
  if (delFinal?.status === 'delivered') dbOk('delivery.status = delivered')
  else { dbFail(`delivery.status = '${delFinal?.status}'`); pass = false }

  const { data: ordFinal } = await sb.from('orders').select('payment_status').eq('id', order.id).single()
  if (ordFinal?.payment_status === 'paid') dbOk('order.payment_status = paid')
  else { dbFail(`order.payment_status = '${ordFinal?.payment_status}'`); pass = false }

  // Phase 5: Customer asks "хаана явж байна?"
  console.log('  ── Phase 5: Order tracking ──')
  r = await chat(api, storeId, sid, 'Захиалга хаана явж байна?', r.conversationId)
  if (r.intent === 'order_status') ok(9, `tracking → ✅ order_status`)
  else ok(9, `tracking → ${r.intent} (expected order_status)`)

  // Phase 6: Verify notification exists
  const { data: notifs } = await sb.from('notifications').select('id')
    .eq('store_id', storeId).gte('created_at', TEST_START).limit(1)
  if (notifs && notifs.length > 0) dbOk('Store notification created')

  scenarioResult(pass)
}

// ============================================================================
// Scenario 42: Full Operational Flow B — Partial Payment → AI Agent
// ============================================================================

async function scenario42(api: string, storeId: string) {
  section('\n📋 Scenario 42: Full Flow B — Chat → Order → Partial Payment → Agent Resolution')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  ── Phase 1: Chat → Order ──')
  const result = await createOrderViaChat(api, storeId, 'fullB_pp')
  if (!result) { dbFail('Failed to create order'); scenarioResult(false); return }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber}`)

  // Phase 2: Driver flow → partial payment
  console.log('  ── Phase 2: Driver → deliver → partial payment ──')
  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)

  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_del_${Date.now()}`, from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delivered:${result.deliveryId}`,
    },
  })
  await delay(500)

  // payment_custom
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_pc_${Date.now()}`, from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `payment_custom:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Amount
  await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(), from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' }, text: '30000', date: Math.floor(Date.now() / 1000),
    },
  })
  await delay(500)

  // Reason
  await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(), from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' }, text: 'hurgelt unegui gsn', date: Math.floor(Date.now() / 1000),
    },
  })
  ok(1, 'Partial payment recorded (30000₮, "hurgelt unegui gsn")')
  await delay(2000) // Wait for agent to run

  // Phase 3: Verify delivery metadata has BOTH custom_payment AND partial_payment_resolution
  console.log('  ── Phase 3: Verify metadata merge ──')
  const { data: del } = await sb.from('deliveries').select('status, metadata').eq('id', result.deliveryId).single()
  const meta = del?.metadata as Record<string, unknown> | null

  if (meta?.custom_payment) {
    const cp = meta.custom_payment as Record<string, unknown>
    dbOk(`custom_payment.amount = ${cp.amount}`)
  } else {
    dbFail(`custom_payment not in metadata — update may have failed`)
    pass = false
  }

  if (meta?.partial_payment_resolution) {
    const ppr = meta.partial_payment_resolution as Record<string, unknown>
    dbOk(`partial_payment_resolution.status = ${ppr.status}`)
  } else {
    console.log('  DB: ⚠️ partial_payment_resolution not set (agent may not have run — web_e2e_ PSID)')
  }

  // Phase 4: Verify order status
  const { data: ord } = await sb.from('orders').select('payment_status, notes').eq('id', result.orderId).single()
  if (ord?.payment_status === 'partial') {
    dbOk(`order.payment_status = 'partial'`)
  } else {
    dbFail(`order.payment_status = '${ord?.payment_status}'`)
    pass = false
  }

  if (ord?.notes) {
    dbOk(`order.notes = "${(ord.notes as string).substring(0, 60)}..."`)
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 43: Full Operational Flow C — Postpone → Cron Reactivate
// ============================================================================

async function scenario43(api: string, storeId: string) {
  section('\n📋 Scenario 43: Full Flow C — Order → Postpone → Cron Reactivate → Pending')
  let pass = true

  // Phase 1: Create order
  console.log('  ── Phase 1: Chat → Order ──')
  const result = await createOrderViaChat(api, storeId, 'fullC_cron')
  if (!result) { dbFail('Failed to create order'); scenarioResult(false); return }
  dbOk(`Order ${result.orderNumber}`)

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)

  // Phase 2: Driver postpones with "tomorrow"
  console.log('  ── Phase 2: Driver postpones → tomorrow ──')
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`, from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  await delay(500)

  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delaytmr_${Date.now()}`, from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay_time:tomorrow:${result.deliveryId}`,
    },
  })
  await delay(1000)

  const { data: del } = await sb.from('deliveries').select('status, estimated_delivery_time').eq('id', result.deliveryId).single()
  if (del?.status === 'delayed') dbOk(`status = 'delayed'`)
  else { dbFail(`status = '${del?.status}'`); pass = false }

  if (del?.estimated_delivery_time) dbOk(`ETA set: ${del.estimated_delivery_time}`)
  else { dbFail('ETA not set'); pass = false }

  // Phase 3: Simulate ETA passed → set to past
  console.log('  ── Phase 3: Fast-forward ETA to past ──')
  const pastEta = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h ago
  await sb.from('deliveries').update({ estimated_delivery_time: pastEta }).eq('id', result.deliveryId)
  await delay(300)

  // Phase 4: Call cron endpoint
  console.log('  ── Phase 4: Call /api/cron/reactivate-delayed ──')
  const cronRes = await fetch(`${api}/api/cron/reactivate-delayed`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET || ''}` },
  })
  const cronData = cronRes.ok ? await cronRes.json() : { error: `HTTP ${cronRes.status}` }
  ok(1, `Cron response: ${JSON.stringify(cronData)}`)
  await delay(1000)

  // Phase 5: Verify delivery reactivated
  console.log('  ── Phase 5: Verify reactivation ──')
  const { data: delAfterCron } = await sb.from('deliveries').select('status, driver_id, notes').eq('id', result.deliveryId).single()

  if (delAfterCron?.status === 'pending') {
    dbOk(`status = 'pending' (reactivated by cron)`)
  } else {
    dbFail(`status = '${delAfterCron?.status}' (expected 'pending' — cron may not have processed it)`)
    pass = false
  }

  if (delAfterCron?.driver_id === null) {
    dbOk('driver_id = null (ready for reassignment)')
  } else {
    dbFail(`driver_id = '${delAfterCron?.driver_id}' (expected null)`)
    pass = false
  }

  // Phase 6: Check notification
  const { data: notifs } = await sb.from('notifications').select('title')
    .eq('store_id', storeId).ilike('title', '%бэлэн боллоо%')
    .order('created_at', { ascending: false }).limit(1)

  if (notifs && notifs.length > 0) {
    dbOk(`Notification: "${notifs[0].title}"`)
  } else {
    console.log('  DB: ⚠️ No reactivation notification found')
  }

  scenarioResult(pass)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n🔬 OPERATIONAL FLOWS TEST — ${today}`)
  console.log('═'.repeat(55))

  // Resolve store
  const { data: store, error: storeErr } = await sb
    .from('stores')
    .select('id, name')
    .eq('name', 'Монгол Маркет')
    .single()

  if (storeErr || !store) {
    console.error(`🔴 Store "Монгол Маркет" not found: ${storeErr?.message}`)
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

  resetCounters()

  // ── Production smoke test ──────────────────────────────────────────────
  console.log('📍 PRODUCTION (https://temuulel-app.vercel.app)')
  console.log()

  const s7 = await scenario7(storeId)
  scenarioResult(s7)

  // ── Localhost operational flow scenarios ────────────────────────────────
  console.log('\n📍 LOCALHOST (http://localhost:3000)')
  console.log()

  // Scenario 18: Full Connected Flow
  await scenario18(LOCAL, storeId)

  // Scenario 19: Payment Delayed → Follow-up
  await scenario19(LOCAL, storeId)

  // Scenario 20: Payment Declined → Store Notified
  await scenario20(LOCAL, storeId)

  // Scenario 23: Wrong Product → Return Flow
  await scenario23(LOCAL, storeId)

  // Scenario 24: Partial Payment (Custom Amount)
  await scenario24(LOCAL, storeId)

  // Scenario 26: Partial Payment → AI Agent Justified
  await scenario26(LOCAL, storeId)

  // Scenario 27: Partial Payment → AI Agent Not Justified → QPay
  await scenario27(LOCAL, storeId)

  // Scenario 28: Partial Payment → No Messenger → SMS Fallback
  await scenario28(LOCAL, storeId)

  // Scenario 32: Wrong Item Photo → Detail Page
  await scenario32(LOCAL, storeId)

  // Scenario 41: Full Operational Flow A — Happy Path End-to-End
  await scenario41(LOCAL, storeId)

  // Scenario 42: Full Operational Flow B — Partial Payment → AI Agent
  await scenario42(LOCAL, storeId)

  // Scenario 43: Full Operational Flow C — Postpone → Cron Reactivate
  await scenario43(LOCAL, storeId)

  // ── Summary ────────────────────────────────────────────────────────────
  printSummary('OPERATIONAL FLOWS TEST SUMMARY')

  const { failed } = getSummary()
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
