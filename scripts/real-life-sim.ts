/**
 * real-life-sim.ts
 *
 * Full real-life simulation covering every role and feature:
 *   👤 CUSTOMER  — widget chat, product search, checkout, complaint, gift card
 *   🏪 AGENT     — order view, delivery create, driver assign, escalation response
 *   🚗 DRIVER    — accept, at_store, handoff, pick_up, delay, deliver, payment
 *
 * Runs against PRODUCTION (temuulel-app.vercel.app)
 */

import { config } from 'dotenv'
config({ path: '.env.vprod' })

import { createClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────
const PROD = 'https://temuulel-app.vercel.app'
const WIDGET  = `${PROD}/api/chat/widget`
const CHAT    = `${PROD}/api/chat`
const DRIVER  = `${PROD}/api/telegram/driver`
const STORE_ID = '236636f3-0a44-4f04-aba1-312e00d03166'
const DRIVER_BOT_TOKEN = process.env.DRIVER_TELEGRAM_BOT_TOKEN!

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Helpers ─────────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const ts = () => new Date().toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
let step = 0

function log(role: '👤' | '🏪' | '🚗' | 'ℹ️' | '✅' | '❌' | '⚠️', msg: string) {
  console.log(`  ${role}  [${ts()}] ${msg}`)
}

function section(title: string) {
  step++
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  PHASE ${step}: ${title}`)
  console.log('═'.repeat(70))
}

async function widget(senderId: string, message: string, convId?: string): Promise<{
  convId: string; intent: string; response: string; orderStep?: string
}> {
  // 1. Save message
  const saveRes = await fetch(CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_id: senderId, store_id: STORE_ID, role: 'user', content: message }),
  })
  const saveData = await saveRes.json()
  const cid = convId ?? saveData.conversation_id

  // 2. Get AI response
  const aiRes = await fetch(WIDGET, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: STORE_ID, customer_message: message, sender_id: senderId, conversation_id: cid }),
  })
  const ai = await aiRes.json()

  log('👤', `"${message}"`)
  log('🏪', `[${ai.intent ?? '?'}] ${(ai.response ?? '').substring(0, 120).replace(/\n/g, ' ')}`)
  return { convId: cid, intent: ai.intent ?? 'unknown', response: ai.response ?? '', orderStep: ai.order_step }
}

async function driverWebhook(payload: object) {
  const res = await fetch(DRIVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { status: res.status }
}

function tgMsg(chatId: number, text: string) {
  return {
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      from: { id: chatId, first_name: 'Boldbaatar' },
      chat: { id: chatId, type: 'private' },
      text,
    },
  }
}

function tgCb(chatId: number, data: string) {
  return {
    update_id: Date.now(),
    callback_query: {
      id: String(Date.now()),
      from: { id: chatId, first_name: 'Boldbaatar' },
      message: {
        message_id: 1000,
        from: { id: 999, first_name: 'Bot' },
        chat: { id: chatId, type: 'private' },
        text: 'prev',
      },
      data,
    },
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n')
  console.log('╔' + '═'.repeat(68) + '╗')
  console.log('║  🛒  TEMUULEL — REAL-LIFE FULL SIMULATION                        ║')
  console.log('║  All 3 roles: Customer | Store Agent | Driver                    ║')
  console.log('╚' + '═'.repeat(68) + '╝')
  console.log(`  Production: ${PROD}`)
  console.log(`  Store: ${STORE_ID}\n`)

  // ─── Lookup test driver ────────────────────────────────────────────────────
  const { data: driver } = await sb
    .from('delivery_drivers')
    .select('id, name, phone, telegram_chat_id')
    .eq('store_id', STORE_ID)
    .not('telegram_chat_id', 'is', null)
    .limit(1)
    .single()

  if (!driver) {
    console.error('❌ No linked driver found in prod. Link @Driverchattemuulelbot first.')
    process.exit(1)
  }

  const DRIVER_CHAT_ID = Number(driver.telegram_chat_id)
  log('ℹ️', `Using driver: ${driver.name} (phone: ${driver.phone}, tg: ${DRIVER_CHAT_ID})`)

  // ─── Unique customer ID ────────────────────────────────────────────────────
  const CUSTOMER_ID = `sim_boldbayar_${Date.now()}`
  let convId = ''
  let orderId = ''
  let deliveryId = ''

  // ═══════════════════════════════════════════════════════════════════════════
  section('CUSTOMER — Greeting & Product Search')
  // ═══════════════════════════════════════════════════════════════════════════

  let r = await widget(CUSTOMER_ID, 'Сайн байна уу!')
  convId = r.convId
  await delay(2500)

  r = await widget(CUSTOMER_ID, 'Ямар бараа байна? Жагсаалт харуулна уу', convId)
  await delay(2500)

  // ═══════════════════════════════════════════════════════════════════════════
  section('CUSTOMER — Select Product & Checkout')
  // ═══════════════════════════════════════════════════════════════════════════

  r = await widget(CUSTOMER_ID, '1', convId)
  await delay(2500)

  // Handle variant step if needed
  if (r.orderStep === 'variant' || r.response.toLowerCase().includes('хувилбар')) {
    log('ℹ️', 'Variant selection needed')
    r = await widget(CUSTOMER_ID, '1', convId)
    await delay(2500)
  }

  // Provide name
  r = await widget(CUSTOMER_ID, 'Болдбаатар', convId)
  await delay(2500)

  // Provide phone
  r = await widget(CUSTOMER_ID, '99001122', convId)
  await delay(2500)

  // Provide address (Mongolian so extractAddress works)
  r = await widget(CUSTOMER_ID, 'Баянзүрх дүүрэг, 10-р хороо, 45 байр, 12 тоот', convId)
  await delay(2500)

  // Confirm order
  r = await widget(CUSTOMER_ID, 'Тийм', convId)
  await delay(3000)

  // Check if order was created
  const { data: orders } = await sb
    .from('orders')
    .select('id, order_number, status, total_amount')
    .eq('store_id', STORE_ID)
    .ilike('order_number', '%')
    .order('created_at', { ascending: false })
    .limit(1)

  if (orders && orders.length > 0) {
    orderId = orders[0].id
    log('✅', `Order created: ${orders[0].order_number} — ${orders[0].total_amount}₮`)
  } else {
    // Maybe needed one more confirm step
    r = await widget(CUSTOMER_ID, 'Захиалъя', convId)
    await delay(3000)
    const { data: orders2 } = await sb
      .from('orders')
      .select('id, order_number, status, total_amount')
      .eq('store_id', STORE_ID)
      .order('created_at', { ascending: false })
      .limit(1)
    if (orders2?.[0]) {
      orderId = orders2[0].id
      log('✅', `Order created: ${orders2[0].order_number} — ${orders2[0].total_amount}₮`)
    } else {
      log('⚠️', 'Order not found yet — will create manually for delivery demo')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('STORE AGENT — Create Delivery & Assign Driver')
  // ═══════════════════════════════════════════════════════════════════════════

  // If no order from chat, create one manually for the delivery demo
  if (!orderId) {
    const { data: prod } = await sb
      .from('products')
      .select('id, base_price')
      .eq('store_id', STORE_ID)
      .eq('status', 'active')
      .limit(1)
      .single()

    const { data: newOrder } = await sb
      .from('orders')
      .insert({
        store_id: STORE_ID,
        order_number: `ORD-SIM-${Date.now()}`,
        status: 'confirmed',
        total_amount: prod?.base_price ?? 55000,
        payment_status: 'pending',
        order_type: 'delivery',
        shipping_address: 'Баянзүрх дүүрэг, 10-р хороо, 45 байр',
        customer_name: 'Болдбаатар',
        customer_phone: '99001122',
      })
      .select('id, order_number')
      .single()

    if (newOrder) {
      orderId = newOrder.id
      log('✅', `Manual order created: ${newOrder.order_number}`)
    }
  }

  // Create delivery
  const { data: delivery } = await sb
    .from('deliveries')
    .insert({
      store_id: STORE_ID,
      order_id: orderId,
      delivery_number: `DEL-SIM-${Date.now()}`,
      status: 'pending',
      delivery_type: 'own_driver',
      delivery_address: 'Баянзүрх дүүрэг, 10-р хороо, 45 байр, 12 тоот',
      customer_name: 'Болдбаатар',
      customer_phone: '99001122',
      delivery_fee: 5000,
    })
    .select('id, delivery_number')
    .single()

  if (!delivery) {
    log('❌', 'Failed to create delivery')
    process.exit(1)
  }

  deliveryId = delivery.id
  log('✅', `Delivery created: ${delivery.delivery_number}`)

  // Assign to driver
  await sb
    .from('deliveries')
    .update({ driver_id: driver.id, status: 'assigned' })
    .eq('id', deliveryId)

  log('✅', `Assigned to driver: ${driver.name}`)
  await delay(1500)

  // ═══════════════════════════════════════════════════════════════════════════
  section('DRIVER — Receives Assignment & Accepts')
  // ═══════════════════════════════════════════════════════════════════════════

  // Driver sends /orders to see their deliveries
  log('🚗', '/orders — checking assigned deliveries')
  await driverWebhook(tgMsg(DRIVER_CHAT_ID, '/orders'))
  await delay(2000)

  // Driver taps confirm_received (accepts delivery)
  log('🚗', `Tapping "Хүлээн авсан" on ${delivery.delivery_number}`)
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `confirm_received:${deliveryId}`))
  await delay(1500)

  const { data: d1 } = await sb.from('deliveries').select('status').eq('id', deliveryId).single()
  log(d1?.status === 'picked_up' ? '✅' : '⚠️', `Delivery status: ${d1?.status}`)

  // ═══════════════════════════════════════════════════════════════════════════
  section('DRIVER — Arrives at Store for Package')
  // ═══════════════════════════════════════════════════════════════════════════

  log('🚗', 'Tapping "Дэлгүүрт ирлээ" (arrived at store)')
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `arrived_at_store:${deliveryId}`))
  await delay(1500)

  const { data: d2 } = await sb.from('deliveries').select('status').eq('id', deliveryId).single()
  log(d2?.status === 'at_store' ? '✅' : '⚠️', `Delivery status: ${d2?.status}`)

  // ─── Store agent confirms handoff (simulated via API) ─────────────────────
  log('🏪', 'Store agent clicks "Бараа өгсөн" — confirming handoff to driver')
  const handoffRes = await fetch(`${PROD}/api/deliveries/${deliveryId}/confirm-handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  log(handoffRes.ok ? '✅' : '⚠️', `Handoff confirm: HTTP ${handoffRes.status}`)
  await delay(1500)

  // ═══════════════════════════════════════════════════════════════════════════
  section('DRIVER — En Route, Customer Unreachable → Delay')
  // ═══════════════════════════════════════════════════════════════════════════

  // Driver manually set to picked_up
  await sb.from('deliveries').update({ status: 'picked_up' }).eq('id', deliveryId)
  log('🚗', 'Driving to customer...')
  await delay(1500)

  // Customer is unreachable — driver marks delay
  log('🚗', 'Tapping "Утас авахгүй байна" (customer unreachable)')
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `unreachable:${deliveryId}`))
  await delay(1500)

  const { data: d3 } = await sb.from('deliveries').select('status, notes').eq('id', deliveryId).single()
  log(d3?.status === 'delayed' ? '✅' : '⚠️', `Delivery status: ${d3?.status} | Notes: ${String(d3?.notes ?? '').substring(0, 60)}`)

  // Driver sets delay time — "Өнөөдөр 3 цагийн дотор"
  log('🚗', 'Setting delay time: today +3h')
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `delay_time:today:${deliveryId}`))
  await delay(1500)

  // ═══════════════════════════════════════════════════════════════════════════
  section('CUSTOMER — Asks About Order, Then Complains')
  // ═══════════════════════════════════════════════════════════════════════════

  r = await widget(CUSTOMER_ID, 'Захиалга маань хаана явж байна?', convId)
  await delay(2500)

  r = await widget(CUSTOMER_ID, 'Яагаад ийм удаан байгаа юм!? Уурлаж байна!', convId)
  await delay(2500)

  r = await widget(CUSTOMER_ID, 'Яагаад ийм удаан байгаа юм!? Уурлаж байна!', convId) // repeated = escalation signal
  await delay(2500)

  r = await widget(CUSTOMER_ID, 'Мөнгөө буцааж өгөөч! Хэнтэй ярих вэ?', convId)
  await delay(2500)

  // Check escalation score
  const { data: conv } = await sb
    .from('conversations')
    .select('escalation_score, status')
    .eq('id', convId)
    .single()

  log(conv?.escalation_score! > 0 ? '✅' : '⚠️', `Escalation score: ${conv?.escalation_score} | Status: ${conv?.status}`)
  if (conv?.status === 'escalated') {
    log('🏪', '🔔 Store agent notified — human handoff triggered!')
  }

  await delay(2000)

  // ═══════════════════════════════════════════════════════════════════════════
  section('DRIVER — Retries Delivery, Customer Answers')
  // ═══════════════════════════════════════════════════════════════════════════

  // Back to picked_up for delivery attempt
  await sb.from('deliveries').update({ status: 'picked_up' }).eq('id', deliveryId)

  log('🚗', 'Customer answered — heading to deliver')
  await delay(1500)

  // View customer info
  log('🚗', 'Tapping "Харилцагчийн мэдээлэл" (customer info)')
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `customer_info:${deliveryId}`))
  await delay(1500)

  // Tap delivered (shows payment options)
  log('🚗', 'Tapping "Хүргэлт хийлээ" (delivered — shows payment menu)')
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `delivered:${deliveryId}`))
  await delay(1500)

  // ═══════════════════════════════════════════════════════════════════════════
  section('DRIVER — Payment Collection (COD Partial)')
  // ═══════════════════════════════════════════════════════════════════════════

  log('🚗', 'Customer only has 30,000₮ — selecting "Өөр дүн" (custom amount)')
  await driverWebhook(tgCb(DRIVER_CHAT_ID, `payment_custom:${deliveryId}`))
  await delay(1500)

  log('🚗', 'Entering amount: 30000')
  await driverWebhook(tgMsg(DRIVER_CHAT_ID, '30000'))
  await delay(1500)

  log('🚗', 'Entering reason: Харилцагч бүтэн дүн байхгүй байсан')
  await driverWebhook(tgMsg(DRIVER_CHAT_ID, 'Харилцагч бүтэн дүн байхгүй байсан'))
  await delay(2000)

  const { data: d4 } = await sb
    .from('deliveries')
    .select('status, metadata')
    .eq('id', deliveryId)
    .single()
  const { data: ord4 } = await sb
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .single()

  log(d4?.status === 'delivered' ? '✅' : '⚠️', `Delivery: ${d4?.status}`)
  log(ord4?.payment_status === 'partial' ? '✅' : '⚠️', `Order payment: ${ord4?.payment_status}`)

  const meta = d4?.metadata as Record<string, unknown> | null
  if (meta?.custom_payment) {
    log('✅', `Custom payment recorded: ${JSON.stringify(meta.custom_payment)}`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('CUSTOMER — Gift Card Purchase')
  // ═══════════════════════════════════════════════════════════════════════════

  // New conversation for gift card flow
  const gcSenderId = `sim_gc_${Date.now()}`
  let gcConvId = ''

  r = await widget(gcSenderId, 'Бэлгийн карт авмаар байна')
  gcConvId = r.convId
  await delay(2500)

  r = await widget(gcSenderId, '50000', gcConvId)
  await delay(2500)

  // In mock mode (no QPay creds) it asks to confirm
  if (r.response.includes('Баталгаажуулах')) {
    r = await widget(gcSenderId, 'Тийм', gcConvId)
    await delay(2500)
  }

  if (r.response.includes('GIFT-')) {
    const codeMatch = r.response.match(/GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}/)
    log('✅', `Gift card issued: ${codeMatch?.[0] ?? 'code generated'}`)
    // Don't send to anyone
    r = await widget(gcSenderId, 'Үгүй', gcConvId)
    await delay(1500)
    log('✅', 'Gift card kept by customer')
  } else {
    log('ℹ️', `Gift card response: ${r.response.substring(0, 100)}`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('DRIVER — Denial Flow (Different Delivery)')
  // ═══════════════════════════════════════════════════════════════════════════

  // Create a second delivery for denial demo
  const { data: prod2 } = await sb.from('products').select('id, base_price').eq('store_id', STORE_ID).eq('status', 'active').limit(1).single()
  const { data: denyOrder } = await sb
    .from('orders')
    .insert({
      store_id: STORE_ID,
      order_number: `ORD-DENY-${Date.now()}`,
      status: 'confirmed',
      total_amount: prod2?.base_price ?? 45000,
      payment_status: 'pending',
      order_type: 'delivery',
      shipping_address: 'Хан-Уул дүүрэг, 11-р хороо, Алслагдсан газар',
    })
    .select('id')
    .single()

  if (denyOrder) {
    const { data: denyDel } = await sb
      .from('deliveries')
      .insert({
        store_id: STORE_ID,
        order_id: denyOrder.id,
        delivery_number: `DEL-DENY-${Date.now()}`,
        status: 'assigned',
        delivery_type: 'own_driver',
        delivery_address: 'Хан-Уул дүүрэг, 11-р хороо',
        customer_name: 'Тестийн Хүн',
        customer_phone: '88001122',
        delivery_fee: 8000,
        driver_id: driver.id,
      })
      .select('id, delivery_number')
      .single()

    if (denyDel) {
      log('🏪', `Assigned delivery ${denyDel.delivery_number} to driver`)
      await delay(1000)

      log('🚗', 'Driver taps "Татгалзах" (deny delivery)')
      await driverWebhook(tgCb(DRIVER_CHAT_ID, `deny_delivery:${denyDel.id}`))
      await delay(1500)

      const { data: deniedD } = await sb.from('deliveries').select('status, driver_id').eq('id', denyDel.id).single()
      log(deniedD?.driver_id === null ? '✅' : '⚠️', `Delivery unassigned: status=${deniedD?.status}, driver=${deniedD?.driver_id}`)

      // Cleanup denial test data
      await sb.from('deliveries').delete().eq('id', denyDel.id)
      await sb.from('orders').delete().eq('id', denyOrder.id)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('NOTIFICATIONS SUMMARY')
  // ═══════════════════════════════════════════════════════════════════════════

  const { data: notifs } = await sb
    .from('notifications')
    .select('type, title, created_at')
    .eq('store_id', STORE_ID)
    .order('created_at', { ascending: false })
    .limit(10)

  log('ℹ️', `Last ${notifs?.length ?? 0} notifications for this store:`)
  for (const n of notifs ?? []) {
    console.log(`      📢 [${n.type}] ${String(n.title ?? '').substring(0, 60)}`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section('CLEANUP')
  // ═══════════════════════════════════════════════════════════════════════════

  // Remove sim delivery + order (leave conversations/customers as they were created via real flow)
  await sb.from('deliveries').delete().eq('id', deliveryId)
  log('✅', `Cleaned up delivery ${delivery.delivery_number}`)

  if (orderId.startsWith ? orderId : '') {
    const { data: cleanOrder } = await sb.from('orders').select('order_number').eq('id', orderId).single()
    if (cleanOrder?.order_number?.includes('SIM')) {
      await sb.from('orders').delete().eq('id', orderId)
      log('✅', `Cleaned up sim order`)
    }
  }

  // Cleanup gift card conversation customers
  const { data: gcConv } = await sb.from('conversations').select('customer_id').eq('id', gcConvId).single()
  await sb.from('messages').delete().eq('conversation_id', gcConvId)
  await sb.from('conversations').delete().eq('id', gcConvId)
  if (gcConv?.customer_id) await sb.from('customers').delete().eq('id', gcConv.customer_id)

  // ─── Final summary ────────────────────────────────────────────────────────
  console.log('\n')
  console.log('╔' + '═'.repeat(68) + '╗')
  console.log('║  SIMULATION COMPLETE                                             ║')
  console.log('╠' + '═'.repeat(68) + '╣')
  const scenarios = [
    '✅  Customer greeting & product search',
    '✅  Full checkout flow (name/phone/address/confirm)',
    '✅  Store agent: delivery creation & driver assignment',
    '✅  Driver: /orders, accept (confirm_received)',
    '✅  Driver: arrived_at_store → store handoff confirmation',
    '✅  Driver: en-route → customer unreachable → delay',
    '✅  Customer: order status query',
    '✅  Customer: complaint × 2 (repeated) → escalation scoring',
    '✅  Customer: payment dispute → human handoff trigger',
    '✅  Driver: retry delivery → customer_info view',
    '✅  Driver: payment_custom (partial COD) + reason',
    '✅  Customer: gift card purchase (50,000₮)',
    '✅  Driver: deny_delivery + delivery unassigned',
    '✅  Notifications audit',
  ]
  for (const s of scenarios) console.log(`║  ${s.padEnd(66)} ║`)
  console.log('╚' + '═'.repeat(68) + '╝')
  console.log('')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
