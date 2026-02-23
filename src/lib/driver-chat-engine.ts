/**
 * driver-chat-engine.ts — Driver natural language intent detection + cross-thread actions
 *
 * Based on Section 5.2 of the Temuulel Agent Behavior Guide.
 *
 * When a driver sends a message, this engine:
 * 1. Detects intent (delivered, picked_up, customer_unreachable, wrong_product, etc.)
 * 2. Updates the delivery/order status in DB
 * 3. Messages the customer via their conversation channel
 * 4. Optionally triggers escalation or payment urging
 * 5. Replies to the driver with confirmation
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendToDriverWithLog, tgSend } from './driver-telegram'
import { dispatchNotification } from './notifications'

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

type DriverIntent =
  | 'delivery_completed'
  | 'picked_up'
  | 'customer_unreachable'
  | 'wrong_product'
  | 'product_damaged'
  | 'customer_wont_pay'
  | 'delay_notification'
  | 'unknown'

const INTENT_PATTERNS: { intent: DriverIntent; patterns: RegExp[] }[] = [
  {
    intent: 'delivery_completed',
    patterns: [
      /хүргэлээ/i, /хүргэсэн/i, /өгсөн/i, /өгч байна/i,
      /дууслаа/i, /дуусгасан/i, /дуусч/i,
      /delivered/i, /done/i, /complete/i, /finished/i,
      /авсан/i,                         // "авсан" in delivery context = they received it
    ],
  },
  {
    intent: 'picked_up',
    patterns: [
      /авлаа/i, /авч явлаа/i, /авч байна/i, /гарлаа/i,
      /picked up/i, /collected/i, /on.?my.?way/i,
      /явж байна/i, /замдаа/i, /яваа/i,
    ],
  },
  {
    intent: 'customer_unreachable',
    patterns: [
      /хариу өгдөггүй/i, /хариу алга/i, /утас аваагүй/i, /утас авдаггүй/i,
      /холбогдохгүй/i, /холбоо барьж чадахгүй/i,
      /not answering/i, /no answer/i, /can.?t reach/i,
      /хаалга нээхгүй/i, /байхгүй/i, /гэртээ байхгүй/i,
      /хүлээж байна/i,                  // "waiting" with no pickup is unreachable context
    ],
  },
  {
    intent: 'wrong_product',
    patterns: [
      /буруу бараа/i, /буруу зүйл/i, /өөр бараа/i,
      /wrong.?product/i, /wrong.?item/i,
      /харилцагч хүлээхгүй/i,           // customer refuses the item
      /тохирохгүй/i,
    ],
  },
  {
    intent: 'product_damaged',
    patterns: [
      /эвдэрсэн/i, /гэмтсэн/i, /муу байдалтай/i, /хагарсан/i,
      /damaged/i, /broken/i, /bad.?quality/i,
      /харилцагч гомдолтой/i,
    ],
  },
  {
    intent: 'customer_wont_pay',
    patterns: [
      /төлөхгүй/i, /мөнгөгүй/i, /хожим төлнө/i, /өгдөггүй/i,
      /won.?t pay/i, /no.?money/i, /pay.?later/i, /cash.?issue/i,
      /бэлэн мөнгөгүй/i,
    ],
  },
  {
    intent: 'delay_notification',
    patterns: [
      /хоцорно/i, /хоцрох/i, /хожимдоно/i, /орой болно/i,
      /delayed/i, /running.?late/i, /traffic/i,
      /замын түгжрэл/i, /цаг дуусахгүй/i,
    ],
  },
]

export function detectDriverIntent(message: string): DriverIntent {
  const lower = message.toLowerCase()
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((re) => re.test(lower))) return intent
  }
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Context lookup
// ---------------------------------------------------------------------------

interface DeliveryContext {
  deliveryId: string
  deliveryNumber: string
  orderId: string | null
  orderNumber: string | null
  storeId: string
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  driverName: string
  driverTelegramChatId: number | null
}

/** Find the most recent active delivery for this driver */
async function getActiveDelivery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  driverId: string
): Promise<DeliveryContext | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: delivery } = await (supabase as any)
    .from('deliveries')
    .select(`
      id, delivery_number, store_id, order_id,
      status, customer_name, customer_phone,
      delivery_drivers!inner(name, telegram_chat_id)
    `)
    .eq('driver_id', driverId)
    .in('status', ['assigned', 'in_transit', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!delivery) return null

  // Look up order + customer_id
  let orderId: string | null = delivery.order_id ?? null
  let orderNumber: string | null = null
  let customerId: string | null = null

  if (orderId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order } = await (supabase as any)
      .from('orders')
      .select('order_number, customer_id')
      .eq('id', orderId)
      .single()
    orderNumber = order?.order_number ?? null
    customerId = order?.customer_id ?? null
  }

  const driverRow = Array.isArray(delivery.delivery_drivers)
    ? delivery.delivery_drivers[0]
    : delivery.delivery_drivers

  return {
    deliveryId: delivery.id,
    deliveryNumber: delivery.delivery_number,
    orderId,
    orderNumber,
    storeId: delivery.store_id,
    customerId,
    customerName: delivery.customer_name ?? null,
    customerPhone: delivery.customer_phone ?? null,
    driverName: driverRow?.name ?? 'Жолооч',
    driverTelegramChatId: driverRow?.telegram_chat_id ?? null,
  }
}

/** Send a message to the customer via driver_messages (store side) + notification */
async function notifyCustomer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  ctx: DeliveryContext,
  message: string
): Promise<void> {
  if (!ctx.customerId) return

  // Push notification to customer (uses existing notification system)
  dispatchNotification(ctx.storeId, 'order_status', {
    customer_id: ctx.customerId,
    order_number: ctx.orderNumber ?? ctx.deliveryNumber,
    message,
  })
}

// ---------------------------------------------------------------------------
// Intent handlers
// ---------------------------------------------------------------------------

export interface DriverChatResult {
  /** Reply sent back to driver */
  driverReply: string
  /** Intent that was detected */
  intent: DriverIntent
  /** Whether an order/delivery status was updated */
  statusUpdated: boolean
}

/**
 * Process a driver message through the intent engine.
 * Called from the Telegram webhook and from the web driver chat POST handler.
 */
export async function processDriverMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  driverId: string,
  message: string,
  /** If via Telegram, the chat_id to reply to. If via web, null. */
  telegramChatId: number | null = null
): Promise<DriverChatResult> {
  const intent = detectDriverIntent(message)
  const ctx = await getActiveDelivery(supabase, driverId)

  // Helper: reply to driver
  const replyToDriver = async (text: string) => {
    if (telegramChatId) {
      await tgSend(telegramChatId, text)
    }
    // Always log to driver_messages (for dashboard visibility)
    if (ctx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('driver_messages').insert({
        store_id: ctx.storeId,
        driver_id: driverId,
        sender_type: 'store',
        message: text.replace(/<[^>]+>/g, ''),
      })
    }
  }

  if (!ctx) {
    const reply = 'Одоогоор идэвхтэй захиалга байхгүй байна.'
    await replyToDriver(reply)
    return { driverReply: reply, intent, statusUpdated: false }
  }

  switch (intent) {
    // ── Delivery completed ───────────────────────────────────────────────
    case 'delivery_completed': {
      // Update delivery + order status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.all([
        (supabase as any).from('deliveries')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('id', ctx.deliveryId),
        ctx.orderId
          ? (supabase as any).from('orders')
              .update({ status: 'delivered', updated_at: new Date().toISOString() })
              .eq('id', ctx.orderId)
          : Promise.resolve(),
      ])

      // Notify customer
      await notifyCustomer(
        supabase,
        ctx,
        `📦 Таны захиалга хүргэгдлээ! ${ctx.driverName} жолоочтой хамт ирлээ.\n\nБидэнтэй дахин уулзвал сайхан. Яаж байсан бэ? ⭐`
      )

      // Dispatch notification for dashboard
      dispatchNotification(ctx.storeId, 'delivery_completed', {
        order_number: ctx.orderNumber ?? ctx.deliveryNumber,
        driver_name: ctx.driverName,
      })

      const reply = `✅ Баярлалаа! #${ctx.orderNumber ?? ctx.deliveryNumber} хүргэлт бүртгэгдлээ.\nХарилцагч мэдэгдэл авлаа.`
      await replyToDriver(reply)
      return { driverReply: reply, intent, statusUpdated: true }
    }

    // ── Picked up ────────────────────────────────────────────────────────
    case 'picked_up': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries')
        .update({ status: 'in_transit', updated_at: new Date().toISOString() })
        .eq('id', ctx.deliveryId)

      // Notify customer
      await notifyCustomer(
        supabase,
        ctx,
        `🚗 ${ctx.driverName} жолооч таны захиалгыг авч явж байна!\n\nТун удахгүй хүрнэ. Бэлэн байна уу!`
      )

      const reply = `✅ #${ctx.orderNumber ?? ctx.deliveryNumber} бүртгэгдлээ — замдаа байна.\nХарилцагч мэдэгдэл авлаа.`
      await replyToDriver(reply)
      return { driverReply: reply, intent, statusUpdated: true }
    }

    // ── Customer unreachable ─────────────────────────────────────────────
    case 'customer_unreachable': {
      // Urgent message to customer
      await notifyCustomer(
        supabase,
        ctx,
        `🚪 Таны захиалгын жолооч хаалган дээр байна!\n\nХаалга нээж авна уу. 10 минут хүлээх болно — хүлээлгийн хугацаа дуусвал захиалга хойшлогдоно.`
      )

      const reply =
        `📨 Харилцагч руу яаралтай мэдэгдэл явуулав.\n` +
        `<b>10 минут хүлээнэ үү.</b>\n` +
        `Хариу ирэхгүй бол "буцлаа" гэж бичнэ үү.`
      await replyToDriver(reply)
      return { driverReply: reply, intent, statusUpdated: false }
    }

    // ── Wrong product ────────────────────────────────────────────────────
    case 'wrong_product': {
      // Ask driver for photo, flag for human review
      const reply =
        `📸 Барааны болон савлагааны зургийг энд илгээнэ үү.\n` +
        `Менежер шалгаад шийдвэр гаргана.`
      await replyToDriver(reply)

      // Escalate to store owner via notification
      dispatchNotification(ctx.storeId, 'escalation', {
        order_number: ctx.orderNumber ?? ctx.deliveryNumber,
        driver_name: ctx.driverName,
        alert_type: 'wrong_product',
        message: `Жолооч буруу бараа мэдэгдэв — #${ctx.orderNumber ?? ctx.deliveryNumber}`,
      })

      return { driverReply: reply, intent, statusUpdated: false }
    }

    // ── Product damaged ──────────────────────────────────────────────────
    case 'product_damaged': {
      const reply =
        `📸 Барааны зургийг энд илгээнэ үү.\n\n` +
        `Харилцагчаас асуугаарай:\n` +
        `1️⃣ Хөнгөлөлттэй авах\n` +
        `2️⃣ Буцааж өгөх\n\n` +
        `Харилцагчийн сонголтыг бичнэ үү.`
      await replyToDriver(reply)

      dispatchNotification(ctx.storeId, 'escalation', {
        order_number: ctx.orderNumber ?? ctx.deliveryNumber,
        driver_name: ctx.driverName,
        alert_type: 'product_damaged',
        message: `Жолооч гэмтсэн бараа мэдэгдэв — #${ctx.orderNumber ?? ctx.deliveryNumber}`,
      })

      return { driverReply: reply, intent, statusUpdated: false }
    }

    // ── Customer won't pay ───────────────────────────────────────────────
    case 'customer_wont_pay': {
      const reply =
        `⏸️ <b>Барааг өгөхгүй байна уу.</b>\n\n` +
        `Харилцагч руу төлбөрийн линк явуулж байна.\n` +
        `10 минут хүлээнэ үү. Дараа мэдэгдэл авна.`
      await replyToDriver(reply)

      // Notify customer with payment urgency
      await notifyCustomer(
        supabase,
        ctx,
        `💳 Жолооч таны хаалган дээр байна — #${ctx.orderNumber ?? ctx.deliveryNumber}\n\n` +
        `Барааг хүлээн авахын тулд төлбөрийг хийнэ үү.\n` +
        `⏰ Жолооч 10 минут хүлээнэ.`
      )

      dispatchNotification(ctx.storeId, 'escalation', {
        order_number: ctx.orderNumber ?? ctx.deliveryNumber,
        driver_name: ctx.driverName,
        alert_type: 'payment_issue',
        message: `Жолооч: харилцагч төлбөр хийхгүй байна — #${ctx.orderNumber ?? ctx.deliveryNumber}`,
      })

      return { driverReply: reply, intent, statusUpdated: false }
    }

    // ── Delay notification ───────────────────────────────────────────────
    case 'delay_notification': {
      await notifyCustomer(
        supabase,
        ctx,
        `🕐 Захиалга #${ctx.orderNumber ?? ctx.deliveryNumber} хоцорч байна.\nЖолооч аль болох хурдан хүргэнэ. Уучлаарай!`
      )

      const reply = `✅ Хоцрол мэдэгдэл явуулав. Харилцагч мэдэж байна.`
      await replyToDriver(reply)
      return { driverReply: reply, intent, statusUpdated: false }
    }

    // ── Unknown ──────────────────────────────────────────────────────────
    default: {
      // Pass through to dashboard — store owner will reply manually
      const reply = ''  // no auto-reply for unknown messages
      return { driverReply: reply, intent, statusUpdated: false }
    }
  }
}
