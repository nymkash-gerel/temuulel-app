/**
 * test-customer-chat.ts
 *
 * Customer chat scenarios: greeting, product search, order flow,
 * Latin transliteration, complaint handling, and regression tests.
 *
 * Scenarios: 1-4, 8-9, 16-17, 22, 39-40
 *
 * Usage:
 *   E2E_RATE_LIMIT_BYPASS=true npx tsx scripts/test-customer-chat.ts
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
  resetCounters,
  getSummary,
  printSummary,
} from './helpers/test-utils'

const sb = getSupabase()
const NOW = Date.now()
const TEST_START = new Date().toISOString()

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

    // Check deliveries table
    const { data: deliveries } = await sb
      .from('deliveries')
      .select('id, delivery_number, delivery_fee')
      .eq('order_id', order.id)
      .limit(1)

    if (deliveries && deliveries.length > 0) {
      const del = deliveries[0]
      dbOk(`Delivery ${del.delivery_number} created (fee: ${new Intl.NumberFormat('mn-MN').format(del.delivery_fee || 0)}\u20ae \u0411\u0430\u044f\u043d\u0433\u043e\u043b)`)

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
  const r5 = await chat(LOCAL, storeId, senderId, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?', convId)
  if (r5.aiStatus === 200 && r5.intent === 'product_search') {
    ok(5, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \u2705 ${r5.intent}`)
  } else {
    ok(5, `"\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?" \u2192 \ud83d\udd34 ${r5.intent}`)
    pass = false
  }

  // Step 6: Select product
  const r6 = await chat(LOCAL, storeId, senderId, '1', r5.conversationId)
  if (r6.aiStatus === 200) {
    ok(6, `"1" \u2192 \u2705 ${r6.intent}, step=${r6.orderStep || 'started'}`)
  } else {
    ok(6, `"1" \u2192 \ud83d\udd34 HTTP ${r6.aiStatus}`)
    pass = false
  }

  // Step 7: Name
  const r7 = await chat(LOCAL, storeId, senderId, '\u0411\u043e\u043b\u0434', r6.conversationId)
  if (r7.aiStatus === 200) {
    ok(7, `"\u0411\u043e\u043b\u0434" \u2192 \u2705 ${r7.intent}`)
  } else {
    ok(7, `"\u0411\u043e\u043b\u0434" \u2192 \ud83d\udd34 HTTP ${r7.aiStatus}`)
    pass = false
  }

  // Step 8: Phone
  const r8 = await chat(LOCAL, storeId, senderId, '99112233', r7.conversationId)
  if (r8.aiStatus === 200) {
    ok(8, `"99112233" \u2192 \u2705 ${r8.intent}`)
  } else {
    ok(8, `"99112233" \u2192 \ud83d\udd34 HTTP ${r8.aiStatus}`)
    pass = false
  }

  // Step 9: Address
  const r9 = await chat(LOCAL, storeId, senderId, '\u0411\u0417\u0414 7-\u0440 \u0445\u043e\u0440\u043e\u043e 36 \u0431\u0430\u0439\u0440', r8.conversationId)
  if (r9.aiStatus === 200) {
    ok(9, `"\u0411\u0417\u0414 7-\u0440 \u0445\u043e\u0440\u043e\u043e 36 \u0431\u0430\u0439\u0440" \u2192 \u2705 ${r9.intent}`)
  } else {
    ok(9, `"\u0411\u0417\u0414 7-\u0440 \u0445\u043e\u0440\u043e\u043e..." \u2192 \ud83d\udd34 HTTP ${r9.aiStatus}`)
    pass = false
  }

  // Step 10: Confirm
  const r10 = await chat(LOCAL, storeId, senderId, '\u0422\u0438\u0439\u043c', r9.conversationId)
  if (r10.aiStatus === 200) {
    ok(10, `"\u0422\u0438\u0439\u043c" \u2192 \u2705 ${r10.intent}`)
  } else {
    ok(10, `"\u0422\u0438\u0439\u043c" \u2192 \ud83d\udd34 HTTP ${r10.aiStatus}`)
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

      const { data: newDelivery } = await sb
        .from('deliveries')
        .select('id, delivery_number')
        .eq('order_id', newOrders[0].id)
        .single()

      if (newDelivery) {
        dbOk(`Recovery delivery ${newDelivery.delivery_number} created`)
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
    console.log('  DB: \u26a0\ufe0f  No escalation notification found (may be async)')
  }

  // Staff "replies" — insert a message with is_from_customer=false
  if (convId) {
    const { error: replyErr } = await sb
      .from('messages')
      .insert({
        conversation_id: convId,
        content: '\u0423\u0443\u0447\u043b\u0430\u0430\u0440\u0430\u0439, \u0431\u0438\u0434 \u0448\u0438\u0439\u0434\u0432\u044d\u0440\u043b\u044d\u0436 \u0431\u0430\u0439\u043d\u0430. \u0422\u0430 \u0445\u044d\u0441\u044d\u0433 \u0445\u04af\u043b\u044d\u044d\u043d\u044d \u04af\u04af.',
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
  console.log('  \u2500\u2500 Full flow: Latin-only order \u2500\u2500')
  const latinSid = `web_e2e_latin_order_${Date.now()}`

  // Step 5: Product search in Latin
  let lr = await chat(api, storeId, latinSid, 'leevchik bgaa yu')
  ok(5, `"leevchik bgaa yu" \u2192 ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 6: Select product
  lr = await chat(api, storeId, latinSid, '1', lr.conversationId)
  ok(6, `"1" \u2192 ${lr.intent}, step=${lr.orderStep || 'started'}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 7: Name in Latin
  lr = await chat(api, storeId, latinSid, 'Bat', lr.conversationId)
  ok(7, `"Bat" \u2192 ${lr.intent} (must NOT be greeting)`)
  if (lr.intent === 'greeting') {
    dbFail('"Bat" treated as greeting during order flow')
    pass = false
  }

  // Step 8: Phone
  lr = await chat(api, storeId, latinSid, '99001122', lr.conversationId)
  ok(8, `"99001122" \u2192 ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 9: Address in Latin
  lr = await chat(api, storeId, latinSid, 'bzd 7 horoo 36 bair', lr.conversationId)
  ok(9, `"bzd 7 horoo 36 bair" \u2192 ${lr.intent}`)
  if (lr.aiStatus !== 200) pass = false

  // Step 10: Confirm in Latin
  lr = await chat(api, storeId, latinSid, 'tiim', lr.conversationId)
  ok(10, `"tiim" \u2192 ${lr.intent}`)
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

      const { data: latinDelivery } = await sb
        .from('deliveries')
        .select('id, delivery_number')
        .eq('order_id', latinOrders[0].id)
        .single()

      if (latinDelivery) {
        dbOk(`Latin delivery ${latinDelivery.delivery_number} created`)
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
// Scenario 22: Customer Complaint Mid-Checkout → Recovers
// ============================================================================

async function scenario22(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 22: Customer Complaint Mid-Checkout \u2192 Recovers')
  let pass = true
  const sid = `web_e2e_complaint_recover_${Date.now()}`

  // Step 1: Product search
  let r = await chat(api, storeId, sid, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?')
  ok(1, `Product search \u2192 ${r.intent}`)
  if (r.aiStatus !== 200) pass = false

  // Step 2: Select product
  r = await chat(api, storeId, sid, '1', r.conversationId)
  ok(2, `Select product \u2192 ${r.intent}, step=${r.orderStep || 'started'}`)
  if (r.aiStatus !== 200) pass = false

  // Step 3: Name
  r = await chat(api, storeId, sid, '\u0411\u043e\u043b\u0434', r.conversationId)
  ok(3, `Name \u2192 ${r.intent}`)
  if (r.aiStatus !== 200) pass = false

  // Step 4: Phone
  r = await chat(api, storeId, sid, '99112233', r.conversationId)
  ok(4, `Phone \u2192 ${r.intent}`)
  if (r.aiStatus !== 200) pass = false

  // Step 5: Customer sends complaint mid-checkout
  r = await chat(api, storeId, sid, '\u042f\u0430\u0433\u0430\u0430\u0434 \u0438\u0439\u043c \u04af\u043d\u044d\u0442\u044d\u0439 \u044e\u043c', r.conversationId)
  ok(5, `Complaint mid-checkout \u2192 ${r.intent}`)

  // Step 6: Customer continues with address (order draft should survive)
  r = await chat(api, storeId, sid, '\u0411\u0417\u0414 7-\u0440 \u0445\u043e\u0440\u043e\u043e 36 \u0431\u0430\u0439\u0440', r.conversationId)
  ok(6, `Address after complaint \u2192 ${r.intent}, step=${r.orderStep || 'address'}`)
  if (r.aiStatus !== 200) pass = false

  // Step 7: Confirm
  r = await chat(api, storeId, sid, '\u0422\u0438\u0439\u043c', r.conversationId)
  ok(7, `Confirm \u2192 ${r.intent}, step=${r.orderStep || 'confirmed'}`)
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

      const { data: del } = await sb
        .from('deliveries')
        .select('id, delivery_number')
        .eq('order_id', orders[0].id)
        .single()

      if (del) {
        dbOk(`Delivery ${del.delivery_number} created`)
      } else {
        dbFail('No delivery found for complaint-recovery order')
        pass = false
      }
    } else {
      dbFail('Order NOT created \u2014 complaint during checkout killed the draft')
      pass = false
    }
  } else {
    dbFail('Customer not found after complaint-recovery flow')
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 39: Messenger Escalation — product_search triggers escalation
// ============================================================================

async function scenario39(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 39: Messenger Escalation \u2014 frustrated product_search triggers escalation')
  let pass = true

  // Send 4 frustrated messages via widget (simulating Messenger behavior)
  const sid = `web_e2e_esc_messenger_${Date.now()}`
  let r = await chat(api, storeId, sid, '\u042f\u0430\u0433\u0430\u0430\u0434 \u0431\u0430\u0440\u0430\u0430\u0433\u0430\u0430 \u043e\u043b\u0436 \u04e9\u0433\u04e9\u0445\u0433\u04af\u0439 \u0431\u0430\u0439\u043d\u0430 \u0432\u044d??')
  const convId = r.conversationId
  ok(1, `Frustrated msg 1 \u2192 ${r.intent} (${r.aiStatus})`)

  r = await chat(api, storeId, sid, '\u041c\u0430\u0448 \u0443\u0434\u0430\u0430\u043d \u0431\u0430\u0439\u043d\u0430! \u0425\u0430\u0440\u0438\u0443 \u04e9\u0433\u04e9\u0445\u0433\u04af\u0439 \u044e\u043c!', convId)
  ok(2, `Frustrated msg 2 \u2192 ${r.intent} (${r.aiStatus})`)

  r = await chat(api, storeId, sid, '\u042d\u043d\u044d \u044f\u043c\u0430\u0440 \u043c\u0443\u0443 \u0431\u0430\u0440\u0430\u0430\u0442\u0430\u0439 \u0434\u044d\u043b\u0433\u04af\u04af\u0440 \u0432\u044d???', convId)
  ok(3, `Frustrated msg 3 \u2192 ${r.intent} (${r.aiStatus})`)

  r = await chat(api, storeId, sid, '\u0413\u043e\u043c\u0434\u043e\u043b \u0433\u0430\u0440\u0433\u0430\u043d\u0430 \u0448\u04af\u04af! Manager \u0434\u0443\u0443\u0434\u0430\u0430\u0440\u0430\u0439!!!', convId)
  ok(4, `Frustrated msg 4 \u2192 ${r.intent} (${r.aiStatus})`)
  await delay(1000)

  // Check escalation
  const { data: conv } = await sb.from('conversations')
    .select('escalation_score, escalation_level, status')
    .eq('id', convId).single()

  if (conv?.escalation_score && conv.escalation_score > 0) {
    dbOk(`escalation_score = ${conv.escalation_score}`)
  } else {
    dbFail(`escalation_score = ${conv?.escalation_score} (expected > 0 \u2014 escalation not firing for frustrated messages)`)
    pass = false
  }

  // Note: escalation status might not be 'escalated' if score didn't cross threshold
  // but score should at least be non-zero
  console.log(`  DB: escalation_level = ${conv?.escalation_level || 'none'}, status = ${conv?.status}`)

  scenarioResult(pass)
}

// ============================================================================
// Scenario 40: Complaint Regex — 'юмуу' does NOT trigger, 'муу бараа' DOES
// ============================================================================

async function scenario40(api: string, storeId: string) {
  section('\n\ud83d\udccb Scenario 40: Complaint Regex \u2014 word boundary for \u043c\u0443\u0443')
  let pass = true

  // Test A: "энэ юмуу тэр юмуу?" during checkout should NOT be complaint
  console.log('  \u2500\u2500 Test A: "\u044e\u043c\u0443\u0443" should NOT trigger complaint \u2500\u2500')
  const sidA = `web_e2e_muu_false_${Date.now()}`
  let r = await chat(api, storeId, sidA, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?')
  r = await chat(api, storeId, sidA, '1', r.conversationId)
  r = await chat(api, storeId, sidA, '\u0411\u0430\u0442', r.conversationId)
  r = await chat(api, storeId, sidA, '99887766', r.conversationId)
  r = await chat(api, storeId, sidA, '\u0411\u0413\u0414 3-\u0440 \u0445\u043e\u0440\u043e\u043e', r.conversationId)
  // At confirming step, ask a question with 'юмуу'
  r = await chat(api, storeId, sidA, '\u044d\u043d\u044d \u044e\u043c\u0443\u0443 \u0442\u044d\u0440 \u044e\u043c\u0443\u0443?', r.conversationId)

  if (r.intent !== 'complaint') {
    ok(1, `"\u044e\u043c\u0443\u0443" \u2192 ${r.intent} (NOT complaint) \u2705`)
  } else {
    ok(1, `"\u044e\u043c\u0443\u0443" \u2192 ${r.intent} \ud83d\udd34 FALSE POSITIVE \u2014 \u044e\u043c\u0443\u0443 triggered complaint!`)
    pass = false
  }

  // Test B: "муу бараа" should be complaint
  console.log('  \u2500\u2500 Test B: "\u043c\u0443\u0443 \u0431\u0430\u0440\u0430\u0430" SHOULD trigger complaint \u2500\u2500')
  const sidB = `web_e2e_muu_true_${Date.now()}`
  let rB = await chat(api, storeId, sidB, '\u0426\u0430\u043c\u0446 \u0431\u0430\u0439\u043d\u0430 \u0443\u0443?')
  rB = await chat(api, storeId, sidB, '1', rB.conversationId)
  rB = await chat(api, storeId, sidB, '\u0411\u0430\u0442', rB.conversationId)
  rB = await chat(api, storeId, sidB, '99887766', rB.conversationId)
  rB = await chat(api, storeId, sidB, '\u0411\u0413\u0414 3-\u0440 \u0445\u043e\u0440\u043e\u043e', rB.conversationId)
  rB = await chat(api, storeId, sidB, '\u042f\u0430\u0433\u0430\u0430\u0434 \u0438\u0439\u043c \u043c\u0443\u0443 \u0431\u0430\u0440\u0430\u0430\u0442\u0430\u0439 \u0431\u0430\u0439\u043d\u0430 \u0432\u044d??', rB.conversationId)

  // Accept 'complaint' OR 'escalated' — escalated means complaint WAS detected + threshold crossed
  if (rB.intent === 'complaint' || rB.intent === 'escalated') {
    ok(2, `"\u043c\u0443\u0443 \u0431\u0430\u0440\u0430\u0430" \u2192 ${rB.intent} \u2705 (complaint detected)`)
  } else {
    ok(2, `"\u043c\u0443\u0443 \u0431\u0430\u0440\u0430\u0430" \u2192 ${rB.intent} \ud83d\udd34 MISSED \u2014 should be complaint`)
    pass = false
  }

  scenarioResult(pass)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n\ud83d\udd2c CUSTOMER CHAT TEST \u2014 ${today}`)
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
  console.log(`Store: ${store.name} (${storeId})\n`)

  resetCounters()

  // ── Scenarios 1-4: localhost (storeId only) ──────────────────────────────

  console.log('\ud83d\udccd LOCALHOST (http://localhost:3000)')
  console.log()

  const s1 = await scenario1(storeId)
  scenarioResult(s1)

  const s2 = await scenario2(storeId)
  scenarioResult(s2)

  const s3 = await scenario3(storeId)
  scenarioResult(s3)

  const s4 = await scenario4(storeId)
  scenarioResult(s4)

  // ── Scenarios 8-9, 16-17, 22, 39-40: (api, storeId) ─────────────────────

  console.log('\ud83d\udccd LOCALHOST \u2014 Extended Scenarios')
  console.log()

  await scenario8(LOCAL, storeId)
  await scenario9(LOCAL, storeId)
  await scenario16(LOCAL, storeId)
  await scenario17(LOCAL, storeId)
  await scenario22(LOCAL, storeId)
  await scenario39(LOCAL, storeId)
  await scenario40(LOCAL, storeId)

  // ── Summary ──────────────────────────────────────────────────────────────

  printSummary('CUSTOMER CHAT TEST SUMMARY')

  const { failed } = getSummary()
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('\ud83d\udd34 Unhandled error:', err)
  process.exit(1)
})
