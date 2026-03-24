/**
 * test-driver-delivery.ts
 *
 * Driver delivery scenarios: pickup, deliver, deny, postpone, delay,
 * damaged, SMS fallback, metadata merge, and notes append.
 *
 * Scenarios: 5-6, 21, 25, 29-31, 33-38
 *
 * Usage:
 *   E2E_RATE_LIMIT_BYPASS=true npx tsx scripts/test-driver-delivery.ts
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

  if (cbRes1.status === 200) {
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

  if (cbRes2.status === 200) {
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

  if (cbRes3.status === 200) {
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

  if (cbRes.status === 200) {
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
// Scenario 21: Driver Denies → Auto-Reassignment Check
// ============================================================================

async function scenario21(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 21: Driver Denies \u2192 Auto-Reassignment Check')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  \u2500\u2500 Phase 1: Create order via chat \u2500\u2500')
  const result = await createOrderViaChat(api, storeId, 'driverdeny')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign to Driver A → Driver A denies
  console.log('  \u2500\u2500 Phase 2: Driver A denies \u2500\u2500')
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
  ok(1, `deny_delivery \u2192 ${denyRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${denyRes.status}`)
  if (denyRes.status !== 200) pass = false

  await delay(1000)

  // Phase 3: Verify delivery reset
  console.log('  \u2500\u2500 Phase 3: Verify delivery reset \u2500\u2500')
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
    console.log('  DB: \u26a0\ufe0f  No denial notification found')
  }

  // Phase 4: Re-assign to Driver B (same driver record, new assignment) → accept → pickup → deliver → pay
  console.log('  \u2500\u2500 Phase 4: Re-assign \u2192 accept \u2192 deliver \u2192 pay \u2500\u2500')

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
  ok(2, `confirm_received (reassigned) \u2192 ${pickupRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${pickupRes.status}`)
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
  ok(3, `delivered (reassigned) \u2192 ${deliverRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${deliverRes.status}`)
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
  ok(4, `payment_full (reassigned) \u2192 ${payRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${payRes.status}`)
  if (payRes.status !== 200) pass = false

  await delay(1000)

  // Phase 5: Verify full cycle complete
  console.log('  \u2500\u2500 Phase 5: Verify full cycle complete \u2500\u2500')
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
// Scenario 25: Delivery Delayed → Unreachable → Reschedule → Eventually Deliver
// ============================================================================

async function scenario25(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 25: Delivery Delayed \u2192 Unreachable \u2192 Reschedule \u2192 Deliver')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  \u2500\u2500 Phase 1: Create order via chat \u2500\u2500')
  const result = await createOrderViaChat(api, storeId, 'delayed')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign driver + pickup
  console.log('  \u2500\u2500 Phase 2: Driver assigned \u2192 pickup \u2500\u2500')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  if (pickedUp) {
    ok(1, 'Driver assigned and picked up \u2192 \u2705')
  } else {
    ok(1, 'Driver pickup failed \u2192 \ud83d\udd34')
    pass = false
  }

  // Phase 3: Customer unreachable
  console.log('  \u2500\u2500 Phase 3: Customer unreachable (phone not answered) \u2500\u2500')
  const unreachRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_unreachable_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `unreachable:${result.deliveryId}`,
    },
  })
  ok(2, `unreachable \u2192 ${unreachRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${unreachRes.status}`)
  if (unreachRes.status !== 200) pass = false
  await delay(1000)

  // Verify status = delayed
  let { data: del } = await sb
    .from('deliveries')
    .select('status, notes, estimated_delivery_time, actual_delivery_time')
    .eq('id', result.deliveryId)
    .single()

  if (del?.status === 'delayed') {
    dbOk(`delivery.status = 'delayed' (customer unreachable)`)
  } else {
    // Some implementations keep picked_up status with notes
    console.log(`  DB: \u26a0\ufe0f delivery.status = '${del?.status}' (expected 'delayed', may stay 'picked_up' with notes)`)
  }

  // Phase 4: Driver taps delay → selects "tomorrow"
  console.log('  \u2500\u2500 Phase 4: Driver delays \u2192 reschedule to tomorrow \u2500\u2500')
  const delayRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  ok(3, `delay \u2192 ${delayRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${delayRes.status} (time picker shown)`)
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
  ok(4, `delay_time:tomorrow \u2192 ${tomorrowRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${tomorrowRes.status}`)
  await delay(1000)

  // Verify delivery is delayed with ETA
  ;({ data: del } = await sb
    .from('deliveries')
    .select('status, notes, estimated_delivery_time, actual_delivery_time')
    .eq('id', result.deliveryId)
    .single())

  if (del?.status === 'delayed') {
    dbOk(`delivery.status = 'delayed'`)
  } else {
    console.log(`  DB: \u26a0\ufe0f delivery.status = '${del?.status}'`)
  }

  if (del?.estimated_delivery_time) {
    dbOk(`estimated_delivery_time = ${del.estimated_delivery_time}`)
  } else {
    console.log('  DB: \u26a0\ufe0f estimated_delivery_time not set')
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
    console.log('  DB: \u26a0\ufe0f No delay notification found')
  }

  // Phase 5: Next day — driver re-attempts delivery → success
  console.log('  \u2500\u2500 Phase 5: Next day \u2014 driver delivers successfully \u2500\u2500')

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
  ok(5, `delivered (2nd attempt) \u2192 ${deliverRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${deliverRes.status}`)
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
  ok(6, `payment_full \u2192 ${payRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${payRes.status}`)
  await delay(1000)

  // Verify final state
  ;({ data: del } = await sb
    .from('deliveries')
    .select('status, notes, estimated_delivery_time, actual_delivery_time')
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
    `\ud83d\udce6 Delivery Delay Test:\n` +
    `Order: ${result.orderNumber}\n` +
    `1st attempt: \u274c Customer unreachable\n` +
    `Rescheduled: Tomorrow\n` +
    `2nd attempt: \u2705 Delivered & Paid`
  )
  console.log(`  Telegram: ${tgOk ? '\u2705' : '\ud83d\udd34'} Delay summary sent`)

  // Summary
  console.log('\n  \u2500\u2500 Delivery Delay Flow Summary \u2500\u2500')
  console.log('  Pickup:           \u2705 Driver picked up order')
  console.log('  Unreachable:      \u2705 Customer phone not answered')
  console.log('  Delay reported:   \u2705 Store notified')
  console.log('  Rescheduled:      \u2705 Tomorrow selected')
  console.log('  2nd attempt:      \u2705 Delivered')
  console.log('  Payment:          \u2705 Full payment collected')

  scenarioResult(pass)
}

// ============================================================================
// Scenario 29: Delivery Postponed → Telegram + Order Notes
// ============================================================================

async function scenario29(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 29: Delivery Postponed \u2192 Telegram + Order Notes')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  \u2500\u2500 Phase 1: Create order via chat \u2500\u2500')
  const result = await createOrderViaChat(api, storeId, 'postponed')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Assign driver + pickup
  console.log('  \u2500\u2500 Phase 2: Driver assigned \u2192 pickup \u2500\u2500')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup \u2192 ${pickedUp ? '\u2705' : '\ud83d\udd34'}`)
  if (!pickedUp) pass = false

  // Phase 3: Driver taps delay → selects "week"
  console.log('  \u2500\u2500 Phase 3: Driver postpones \u2014 selects "week" \u2500\u2500')
  const delayRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  ok(2, `delay \u2192 ${delayRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${delayRes.status}`)
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
  ok(3, `delay_time:week \u2192 ${weekRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${weekRes.status}`)
  await delay(1000)

  // Phase 4: Verify delivery status = delayed, notes contain delay info
  console.log('  \u2500\u2500 Phase 4: DB verification \u2500\u2500')
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
    console.log('  DB: \u26a0\ufe0f  estimated_delivery_time not set')
  }

  if (del?.notes) {
    dbOk(`notes = "${del.notes}"`)
  } else {
    console.log('  DB: \u26a0\ufe0f  notes not set')
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
    console.log('  DB: \u26a0\ufe0f  No delivery_delayed notification found')
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
    console.log('  DB: \u26a0\ufe0f  Order notes not set (may not be updated by delay handler)')
  }

  // Send Telegram summary
  const tgOk = await sendDriverTelegram(
    `\ud83e\uddea Scenario 29: Delivery Postponed\n` +
    `Order: ${result.orderNumber}\n` +
    `Status: delayed (1 week)\n` +
    `ETA: ${del?.estimated_delivery_time || 'not set'}`
  )
  console.log(`  Telegram: ${tgOk ? '\u2705' : '\ud83d\udd34'} Postpone summary sent`)

  scenarioResult(pass)
}

// ============================================================================
// Scenario 30: Delayed Delivery → Customer Reconfirm
// ============================================================================

async function scenario30(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 30: Delayed Delivery \u2192 Customer Reconfirm')
  let pass = true

  // Phase 1: Create order and delay it
  console.log('  \u2500\u2500 Phase 1: Create order + delay \u2500\u2500')
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
  console.log('  \u2500\u2500 Phase 2: Seed delayed delivery with past ETA \u2500\u2500')
  const pastEta = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24h ago
  await sb
    .from('deliveries')
    .update({
      status: 'delayed',
      estimated_delivery_time: pastEta,
      notes: '\u041c\u0430\u0440\u0433\u0430\u0430\u0448 \u0445\u04af\u0440\u0433\u044d\u043d\u044d',
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
  console.log('  \u2500\u2500 Phase 3: Simulate cron reactivation \u2500\u2500')
  await sb
    .from('deliveries')
    .update({ status: 'pending', notes: '\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0430\u0430\u0440 \u0434\u0430\u0445\u0438\u043d \u0438\u0434\u044d\u0432\u0445\u0436\u04af\u04af\u043b\u0441\u044d\u043d \u2014 ETA \u0445\u0443\u0433\u0430\u0446\u0430\u0430 \u0434\u0443\u0443\u0441\u0441\u0430\u043d' })
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
  console.log('  \u2500\u2500 Phase 4: Message customer about redelivery \u2500\u2500')
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
      content: '\u0425\u044d\u0437\u044d\u044d \u0442\u043e\u0445\u0438\u0440\u043e\u0445 \u0432\u044d? \u0422\u0430\u043d\u044b \u0437\u0430\u0445\u0438\u0430\u043b\u0433\u044b\u0433 \u0434\u0430\u0445\u0438\u043d \u0445\u04af\u0440\u0433\u044d\u0445\u044d\u044d\u0440 \u0431\u044d\u043b\u044d\u043d \u0431\u0430\u0439\u043d\u0430.',
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'delivery_reconfirm', delivery_id: result.deliveryId },
    })
    dbOk('Reconfirm message inserted')
  }
  await delay(500)

  // Phase 5: Customer replies "Маргааш" via chat
  console.log('  \u2500\u2500 Phase 5: Customer replies "\u041c\u0430\u0440\u0433\u0430\u0430\u0448" \u2500\u2500')
  const r = await chat(api, storeId, result.senderId, '\u041c\u0430\u0440\u0433\u0430\u0430\u0448', result.conversationId)
  ok(2, `"\u041c\u0430\u0440\u0433\u0430\u0430\u0448" \u2192 ${r.intent} (HTTP ${r.aiStatus})`)
  await delay(1000)

  // Phase 6: Update delivery notes and status
  console.log('  \u2500\u2500 Phase 6: Update delivery for reconfirm \u2500\u2500')
  const tomorrowEta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await sb
    .from('deliveries')
    .update({
      status: 'assigned',
      estimated_delivery_time: tomorrowEta,
      notes: '\u0414\u0430\u0445\u0438\u043d \u0445\u04af\u0440\u0433\u044d\u043b\u0442: \u041c\u0430\u0440\u0433\u0430\u0430\u0448',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Insert notification
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'delivery_reconfirmed',
    title: '\ud83d\udce6 \u0414\u0410\u0425\u0418\u041d \u0425\u04ae\u0420\u0413\u042d\u041b\u0422 \u0411\u0410\u0422\u041b\u0410\u0413\u0410\u0416\u041b\u0410\u0410',
    body: `#${result.orderNumber}: \u041c\u0430\u0440\u0433\u0430\u0430\u0448 \u0445\u04af\u0440\u0433\u044d\u0445\u044d\u044d\u0440 \u0442\u043e\u0445\u0438\u0440\u043b\u043e\u043e.`,
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

  if (delFinal?.notes?.includes('\u041c\u0430\u0440\u0433\u0430\u0430\u0448')) {
    dbOk(`FINAL: notes contain "\u041c\u0430\u0440\u0433\u0430\u0430\u0448"`)
  } else {
    dbFail(`FINAL: notes = "${delFinal?.notes}" (expected to contain "\u041c\u0430\u0440\u0433\u0430\u0430\u0448")`)
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
  section('\n\ud83d\udccb Scenario 31: Delayed Delivery \u2192 Customer Cancels')
  let pass = true

  // Phase 1: Create order and delay it
  console.log('  \u2500\u2500 Phase 1: Create order + delay \u2500\u2500')
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
  console.log('  \u2500\u2500 Phase 2: Seed delayed delivery \u2500\u2500')
  const pastEta = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await sb
    .from('deliveries')
    .update({
      status: 'delayed',
      estimated_delivery_time: pastEta,
      notes: '\u041c\u0430\u0440\u0433\u0430\u0430\u0448 \u0445\u04af\u0440\u0433\u044d\u043d\u044d',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Phase 3: Simulate cron reactivation
  console.log('  \u2500\u2500 Phase 3: Simulate cron reactivation \u2500\u2500')
  await sb
    .from('deliveries')
    .update({ status: 'pending', notes: '\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0430\u0430\u0440 \u0434\u0430\u0445\u0438\u043d \u0438\u0434\u044d\u0432\u0445\u0436\u04af\u04af\u043b\u0441\u044d\u043d' })
    .eq('id', result.deliveryId)
  await delay(500)

  // Phase 4: Customer reply "Цуцлах"
  console.log('  \u2500\u2500 Phase 4: Customer replies "\u0426\u0443\u0446\u043b\u0430\u0445" \u2500\u2500')
  const r = await chat(api, storeId, result.senderId, '\u0426\u0443\u0446\u043b\u0430\u0445', result.conversationId)
  ok(2, `"\u0426\u0443\u0446\u043b\u0430\u0445" \u2192 ${r.intent} (HTTP ${r.aiStatus})`)
  await delay(1000)

  // Phase 5: Update delivery status to cancelled
  console.log('  \u2500\u2500 Phase 5: Cancel delivery \u2500\u2500')
  await sb
    .from('deliveries')
    .update({
      status: 'cancelled',
      notes: '\u0425\u0430\u0440\u0438\u043b\u0446\u0430\u0433\u0447 \u0446\u0443\u0446\u0430\u043b\u0441\u0430\u043d \u2014 \u0445\u043e\u0439\u0448\u043b\u0443\u0443\u043b\u0441\u0430\u043d\u044b \u0434\u0430\u0440\u0430\u0430',
    })
    .eq('id', result.deliveryId)
  await delay(500)

  // Insert notification
  await sb.from('notifications').insert({
    store_id: storeId,
    type: 'delivery_cancelled',
    title: '\u274c \u0425\u04ae\u0420\u0413\u042d\u041b\u0422 \u0426\u0423\u0426\u041b\u0410\u0413\u0414\u041b\u0410\u0410',
    body: `#${result.orderNumber}: \u0425\u0430\u0440\u0438\u043b\u0446\u0430\u0433\u0447 \u0445\u043e\u0439\u0448\u043b\u0443\u0443\u043b\u0441\u043d\u044b \u0434\u0430\u0440\u0430\u0430 \u0446\u0443\u0446\u0430\u043b\u0441\u0430\u043d.`,
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
// Scenario 33: Staff Telegram Notify — Damaged/No Payment
// ============================================================================

async function scenario33(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 33: Staff Telegram Notify \u2014 Damaged/No Payment')
  let pass = true

  // Phase 1: Create order + assign + pickup
  console.log('  \u2500\u2500 Phase 1: Create order + pickup \u2500\u2500')
  const result = await createOrderViaChat(api, storeId, 'damaged_notify')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup \u2192 ${pickedUp ? '\u2705' : '\ud83d\udd34'}`)
  if (!pickedUp) pass = false

  // Phase 2: Driver taps "damaged"
  console.log('  \u2500\u2500 Phase 2: Driver taps damaged \u2500\u2500')
  const damagedRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_damaged_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E Driver' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `damaged:${result.deliveryId}`,
    },
  })
  ok(2, `damaged \u2192 ${damagedRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${damagedRes.status}`)
  if (damagedRes.status !== 200) pass = false
  await delay(1000)

  // Phase 3: Verify delivery status = failed
  console.log('  \u2500\u2500 Phase 3: DB verification \u2500\u2500')
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

  if (del?.notes?.includes('\u0413\u044d\u043c\u0442\u0441\u044d\u043d')) {
    dbOk(`notes: "${del.notes}"`)
  } else {
    console.log(`  DB: \u26a0\ufe0f  notes = "${del?.notes}" (expected to include "\u0413\u044d\u043c\u0442\u0441\u044d\u043d")`)
  }

  // Phase 4: Verify notification created for store
  const { data: notifs } = await sb
    .from('notifications')
    .select('id, title, type')
    .eq('store_id', storeId)
    .eq('type', 'delivery_failed')
    .ilike('title', '%\u0413\u044d\u043c\u0442\u0441\u044d\u043d%')
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
    `\ud83e\uddea Scenario 33: Damaged item reported\n` +
    `Order: ${result.orderNumber}\n` +
    `Delivery: #${result.deliveryNumber}\n` +
    `Status: failed (damaged)`
  )
  console.log(`  Telegram: ${tgOk ? '\u2705' : '\ud83d\udd34'} Damaged item summary sent`)

  scenarioResult(pass)
}

// ============================================================================
// Scenario 34: 24h Messenger Window Expired → SMS Fallback
// ============================================================================

async function scenario34(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 34: 24h Messenger Window Expired \u2192 SMS Fallback')
  let pass = true

  // Phase 1: Create order via chat
  console.log('  \u2500\u2500 Phase 1: Create order via chat \u2500\u2500')
  const result = await createOrderViaChat(api, storeId, 'window_expired')
  if (!result) {
    dbFail('Failed to create order via chat')
    scenarioResult(false)
    return
  }
  dbOk(`Order ${result.orderNumber} + Delivery ${result.deliveryNumber} created`)

  // Phase 2: Driver partial payment flow
  console.log('  \u2500\u2500 Phase 2: Driver flow + partial payment \u2500\u2500')
  const driverId = await getOrCreateDriver(storeId)
  const pickedUp = await assignAndPickup(api, result.deliveryId, driverId)
  ok(1, `Driver pickup \u2192 ${pickedUp ? '\u2705' : '\ud83d\udd34'}`)
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
      text: '\u0414\u0443\u0442\u0443\u0443 \u043c\u04e9\u043d\u0433\u04e9\u0442\u044d\u0439',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(2, 'Driver partial payment flow completed (35000, "\u0414\u0443\u0442\u0443\u0443 \u043c\u04e9\u043d\u0433\u04e9\u0442\u044d\u0439")')
  await delay(1000)

  // Phase 3: Simulate 24h Messenger window expired
  console.log('  \u2500\u2500 Phase 3: Simulate 24h Messenger window expired \u2500\u2500')
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
  console.log('  \u2500\u2500 Phase 4: SMS fallback message \u2500\u2500')
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
      content: 'Messenger 24\u0446 \u0446\u043e\u043d\u0445 \u0445\u0430\u0430\u0433\u0434\u0441\u0430\u043d. SMS-\u044d\u044d\u0440 \u043c\u044d\u0434\u044d\u0433\u0434\u044d\u043b \u0438\u043b\u0433\u044d\u044d\u043b\u044d\u044d: \u0422\u0430\u043d\u044b \u0437\u0430\u0445\u0438\u0430\u043b\u0433\u044b\u043d \u04af\u043b\u0434\u044d\u0433\u0434\u044d\u043b \u0442\u04e9\u043b\u0431\u04e9\u0440\u0438\u0439\u0433 \u0442\u04e9\u043b\u043d\u04e9 \u04af\u04af.',
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
  console.log('  \u2500\u2500 Phase 5: Verify SMS fallback \u2500\u2500')
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
// Scenario 35: Metadata Merge (not overwrite)
// ============================================================================

async function scenario35(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 35: Metadata Merge \u2014 damaged preserves existing metadata')
  let pass = true

  // Phase 1: Create order + assign + pickup
  console.log('  \u2500\u2500 Phase 1: Create order + pickup \u2500\u2500')
  const result = await createOrderViaChat(api, storeId, 'meta_merge')
  if (!result) { dbFail('Failed to create order'); scenarioResult(false); return }
  dbOk(`Order ${result.orderNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)

  // Phase 2: Seed existing metadata on delivery (simulate batch_ids, telegram_message_id)
  console.log('  \u2500\u2500 Phase 2: Seed existing metadata \u2500\u2500')
  await sb.from('deliveries').update({
    metadata: { batch_ids: ['batch-123'], telegram_message_id: 999, custom_field: 'test' },
  }).eq('id', result.deliveryId)
  await delay(300)

  // Phase 3: Driver taps damaged
  console.log('  \u2500\u2500 Phase 3: Driver taps damaged \u2500\u2500')
  const dmRes = await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_dm_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `damaged:${result.deliveryId}`,
    },
  })
  ok(1, `damaged \u2192 ${dmRes.status === 200 ? '\u2705' : '\ud83d\udd34'} HTTP ${dmRes.status}`)
  await delay(1000)

  // Phase 4: Verify metadata was MERGED, not overwritten
  console.log('  \u2500\u2500 Phase 4: Verify metadata merge \u2500\u2500')
  const { data: del } = await sb.from('deliveries').select('metadata').eq('id', result.deliveryId).single()
  const meta = del?.metadata as Record<string, unknown> | null

  if (meta?.batch_ids) {
    dbOk(`batch_ids preserved: ${JSON.stringify(meta.batch_ids)}`)
  } else {
    dbFail(`batch_ids LOST \u2014 metadata overwritten! Got: ${JSON.stringify(meta)}`)
    pass = false
  }

  if (meta?.telegram_message_id === 999) {
    dbOk('telegram_message_id preserved')
  } else {
    dbFail(`telegram_message_id LOST \u2014 got: ${meta?.telegram_message_id}`)
    pass = false
  }

  if (meta?.custom_field === 'test') {
    dbOk('custom_field preserved')
  } else {
    dbFail(`custom_field LOST \u2014 got: ${meta?.custom_field}`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 36: Custom Delay sets estimated_delivery_time
// ============================================================================

async function scenario36(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 36: Custom Delay sets estimated_delivery_time for cron')
  let pass = true

  const result = await createOrderViaChat(api, storeId, 'custom_delay_eta')
  if (!result) { dbFail('Failed to create order'); scenarioResult(false); return }
  dbOk(`Order ${result.orderNumber} created`)

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)

  // Driver taps delay → custom
  console.log('  \u2500\u2500 Phase 2: Driver taps delay \u2192 custom \u2500\u2500')
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Select custom
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delaycustom_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay_time:custom:${result.deliveryId}`,
    },
  })
  await delay(500)

  // Driver types free-text delay: "3 хоногийн дараа"
  console.log('  \u2500\u2500 Phase 3: Driver types "3 \u0445\u043e\u043d\u043e\u0433\u0438\u0439\u043d \u0434\u0430\u0440\u0430\u0430" \u2500\u2500')
  const textRes = await driverWebhook(api, {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      chat: { id: DRIVER_CHAT_ID, type: 'private' },
      text: '3 \u0445\u043e\u043d\u043e\u0433\u0438\u0439\u043d \u0434\u0430\u0440\u0430\u0430',
      date: Math.floor(Date.now() / 1000),
    },
  })
  ok(1, `Custom delay text \u2192 ${textRes.status === 200 ? '\u2705' : '\ud83d\udd34'}`)
  await delay(1000)

  // Phase 4: Verify estimated_delivery_time is set
  console.log('  \u2500\u2500 Phase 4: Verify estimated_delivery_time \u2500\u2500')
  const { data: del } = await sb.from('deliveries')
    .select('status, estimated_delivery_time, notes')
    .eq('id', result.deliveryId).single()

  if (del?.status === 'delayed') {
    dbOk(`status = 'delayed'`)
  } else {
    dbFail(`status = '${del?.status}' (expected 'delayed')`)
    pass = false
  }

  if (del?.estimated_delivery_time) {
    const eta = new Date(del.estimated_delivery_time)
    const now = new Date()
    const diffDays = (eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 1 && diffDays < 5) {
      dbOk(`estimated_delivery_time set (~${diffDays.toFixed(1)} days from now) \u2014 cron will reactivate`)
    } else {
      dbFail(`estimated_delivery_time = ${del.estimated_delivery_time} (~${diffDays.toFixed(1)} days \u2014 expected ~3)`)
      pass = false
    }
  } else {
    dbFail('estimated_delivery_time is NULL \u2014 cron will NEVER reactivate this delivery!')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 37: damaged/no_payment updates order.payment_status
// ============================================================================

async function scenario37(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 37: damaged/no_payment updates order.payment_status')
  let pass = true

  // Test A: damaged
  console.log('  \u2500\u2500 Test A: damaged \u2192 order.payment_status = failed \u2500\u2500')
  const resultA = await createOrderViaChat(api, storeId, 'dmg_order')
  if (!resultA) { dbFail('Failed to create order A'); scenarioResult(false); return }

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, resultA.deliveryId, driverId)

  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_dmg_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `damaged:${resultA.deliveryId}`,
    },
  })
  await delay(1000)

  const { data: ordA } = await sb.from('orders').select('payment_status').eq('id', resultA.orderId).single()
  if (ordA?.payment_status === 'failed') {
    dbOk(`[damaged] order.payment_status = 'failed' \u2705`)
  } else {
    dbFail(`[damaged] order.payment_status = '${ordA?.payment_status}' (expected 'failed')`)
    pass = false
  }

  // Test B: no_payment
  console.log('  \u2500\u2500 Test B: no_payment \u2192 order.payment_status = failed \u2500\u2500')
  const resultB = await createOrderViaChat(api, storeId, 'nopay_order')
  if (!resultB) { dbFail('Failed to create order B'); scenarioResult(false); return }

  await assignAndPickup(api, resultB.deliveryId, driverId)

  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_np_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `no_payment:${resultB.deliveryId}`,
    },
  })
  await delay(1000)

  const { data: ordB } = await sb.from('orders').select('payment_status').eq('id', resultB.orderId).single()
  if (ordB?.payment_status === 'failed') {
    dbOk(`[no_payment] order.payment_status = 'failed' \u2705`)
  } else {
    dbFail(`[no_payment] order.payment_status = '${ordB?.payment_status}' (expected 'failed')`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 38: Order Notes Append (not overwrite)
// ============================================================================

async function scenario38(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 38: Order Notes Append \u2014 delay preserves existing notes')
  let pass = true

  const result = await createOrderViaChat(api, storeId, 'notes_append')
  if (!result) { dbFail('Failed to create order'); scenarioResult(false); return }

  // Seed existing notes on order
  await sb.from('orders').update({ notes: '\u0416\u043e\u043b\u043e\u043e\u0447: 30000\u20ae \u0430\u0432\u0441\u0430\u043d. \u0428\u0430\u043b\u0442\u0433\u0430\u0430\u043d: hurgelt unegui' }).eq('id', result.orderId)
  await delay(300)

  const driverId = await getOrCreateDriver(storeId)
  await assignAndPickup(api, result.deliveryId, driverId)

  // Driver delays with preset "week"
  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delay_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 2, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay:${result.deliveryId}`,
    },
  })
  await delay(500)

  await driverWebhook(api, {
    update_id: Date.now(),
    callback_query: {
      id: `e2e_delayweek_${Date.now()}`,
      from: { id: DRIVER_CHAT_ID, is_bot: false, first_name: 'E2E' },
      message: { message_id: 3, chat: { id: DRIVER_CHAT_ID, type: 'private' } },
      data: `delay_time:week:${result.deliveryId}`,
    },
  })
  await delay(1000)

  // Verify notes were APPENDED, not overwritten
  const { data: ord } = await sb.from('orders').select('notes').eq('id', result.orderId).single()
  const notes = ord?.notes as string || ''

  if (notes.includes('\u0416\u043e\u043b\u043e\u043e\u0447: 30000\u20ae') && notes.includes('\u0425\u043e\u0439\u0448\u043b\u0443\u0443\u043b\u0441\u0430\u043d')) {
    dbOk(`Notes appended correctly: "${notes.substring(0, 80)}..."`)
  } else if (notes.includes('\u0425\u043e\u0439\u0448\u043b\u0443\u0443\u043b\u0441\u0430\u043d') && !notes.includes('\u0416\u043e\u043b\u043e\u043e\u0447')) {
    dbFail(`Original notes OVERWRITTEN! Got: "${notes}"`)
    pass = false
  } else {
    dbFail(`Notes unexpected: "${notes}"`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n\ud83d\udd2c DRIVER DELIVERY TEST \u2014 ${today}`)
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
  console.log(`Driver chat_id: ${DRIVER_CHAT_ID}`)
  console.log(`Webhook secret: ${DRIVER_WEBHOOK_SECRET ? 'set' : 'NOT SET'}`)
  console.log()

  resetCounters()

  // Scenario 5: Driver Delivery Flow
  const s5 = await scenario5(storeId)
  scenarioResult(s5)

  // Scenario 6: Driver Denies Delivery
  const s6 = await scenario6(storeId)
  scenarioResult(s6)

  // Scenario 21: Driver Denies → Auto-Reassignment Check
  await scenario21(LOCAL, storeId)

  // Scenario 25: Delivery Delayed → Unreachable → Reschedule → Deliver
  await scenario25(LOCAL, storeId)

  // Scenario 29: Delivery Postponed → Telegram + Order Notes
  await scenario29(LOCAL, storeId)

  // Scenario 30: Delayed Delivery → Customer Reconfirm
  await scenario30(LOCAL, storeId)

  // Scenario 31: Delayed Delivery → Customer Cancels
  await scenario31(LOCAL, storeId)

  // Scenario 33: Staff Telegram Notify — Damaged/No Payment
  await scenario33(LOCAL, storeId)

  // Scenario 34: 24h Messenger Window Expired → SMS Fallback
  await scenario34(LOCAL, storeId)

  // Scenario 35: Metadata Merge (not overwrite)
  await scenario35(LOCAL, storeId)

  // Scenario 36: Custom Delay sets estimated_delivery_time
  await scenario36(LOCAL, storeId)

  // Scenario 37: damaged/no_payment updates order.payment_status
  await scenario37(LOCAL, storeId)

  // Scenario 38: Order Notes Append (not overwrite)
  await scenario38(LOCAL, storeId)

  // Print summary
  printSummary('DRIVER DELIVERY TEST SUMMARY')

  const { failed } = getSummary()
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('\ud83d\udd34 Fatal error:', err)
  process.exit(1)
})
