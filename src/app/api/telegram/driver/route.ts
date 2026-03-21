/**
 * POST /api/telegram/driver
 *
 * Telegram webhook endpoint for the driver bot.
 * Set this as the webhook URL in BotFather:
 *   POST https://api.telegram.org/bot{TOKEN}/setWebhook
 *   { "url": "https://your-domain.vercel.app/api/telegram/driver" }
 *
 * Handles:
 *   - /start command → driver onboarding (link Telegram to driver account)
 *   - /orders        → list active deliveries
 *   - /help          → command list
 *   - Phone number messages → link by phone
 *   - Photo messages → delivery proof (auto-marks delivery as confirmed)
 *   - Natural language → driver intent engine (delivered, picked up, etc.)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  tgSend,
  tgSendButtons,
  tgAnswerCallback,
  tgRemoveButtons,
  tgEdit,
  enRouteKeyboard,
  delayKeyboard,
  issueKeyboard,
  orderAssignedKeyboard,
  intercityKeyboard,
  intercityTransportKeyboard,
  intercityConfirmKeyboard,
  intercityPaymentKeyboard,
  intercityCustomerMessage,
  paymentKeyboard,
  paymentOptionsKeyboard,
  handoffReadyKeyboard,
  sendToDriver,
  DRIVER_BOT_WELCOME,
  DRIVER_BOT_LINKED,
  DRIVER_BOT_NOT_FOUND,
  DRIVER_BOT_ALREADY_LINKED,
  DRIVER_PROACTIVE_MESSAGES,
  // Batch assignment flow keyboards
  batchReadyKeyboard,
  deliveryDenyKeyboard,
  denyReasonKeyboard,
  batchConfirmKeyboard,
  bulkListKeyboard,
  tgSetKeyboard,
  type IntercityWizard,
  type TgInlineKeyboard,
} from '@/lib/driver-telegram'
import { processDriverMessage } from '@/lib/driver-chat-engine'
import { createQPayInvoice, isQPayConfigured } from '@/lib/qpay'
import { assignDriver, DEFAULT_DELIVERY_SETTINGS } from '@/lib/ai/delivery-assigner'
import { initiatePartialPaymentResolution } from '@/lib/partial-payment-agent'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Get all staff + store_members Telegram chat IDs for a store */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStaffMemberChatIds(supabase: any, storeId: string): Promise<string[]> {
  const chatIds: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staff } = await (supabase as any)
    .from('staff').select('telegram_chat_id').eq('store_id', storeId).not('telegram_chat_id', 'is', null)
  for (const s of (staff || []) as Array<{ telegram_chat_id: string }>) {
    if (s.telegram_chat_id && !chatIds.includes(s.telegram_chat_id)) chatIds.push(s.telegram_chat_id)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (supabase as any)
    .from('store_members').select('telegram_chat_id, notification_preferences').eq('store_id', storeId).not('telegram_chat_id', 'is', null)
  for (const m of (members || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
    const prefs = m.notification_preferences || {}
    if (m.telegram_chat_id && prefs.delivery !== false && !chatIds.includes(m.telegram_chat_id)) {
      chatIds.push(m.telegram_chat_id)
    }
  }
  return chatIds
}

/** Telegram update shape (only fields we use) */
interface TgPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

interface TgMessage {
  message_id: number
  from: { id: number; first_name: string; username?: string }
  chat: { id: number; type: string }
  text?: string
  contact?: { phone_number: string; user_id?: number }
  /** Array of photo sizes (smallest → largest). Last element is highest quality. */
  photo?: TgPhotoSize[]
  caption?: string
}

interface TgCallbackQuery {
  id: string
  from: { id: number; first_name: string }
  message?: TgMessage
  data?: string
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

/** Fetch delivery info and build a consistent header line for in-place message edits */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDeliveryHeader(supabase: any, deliveryId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('deliveries')
    .select('delivery_number, delivery_address, customer_name, customer_phone')
    .eq('id', deliveryId)
    .maybeSingle()
  if (!data) return ''
  return `📦 <b>ЗАХИАЛГА — #${data.delivery_number}</b>\n\n` +
    (data.delivery_address ? `📍 ${data.delivery_address}\n` : '') +
    (data.customer_name ? `👤 ${data.customer_name}` : '') +
    (data.customer_phone ? `${data.customer_name ? ' · ' : '📞 '}<code>${data.customer_phone}</code>` : '') +
    '\n\n'
}

/**
 * Rebuild the combined bulk-assign message after driver taps confirm or deny.
 * Fetches fresh delivery states, updates text + keyboard in-place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rebuildBatchMessage(supabase: any, chatId: number, messageId: number, batchIds: string[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: batch } = await (supabase as any)
    .from('deliveries')
    .select('id, delivery_number, delivery_address, customer_name, customer_phone, status, driver_id')
    .in('id', batchIds)

  if (!batch) return

  const lines = (batch as { id: string; delivery_number: string; delivery_address: string | null; customer_name: string | null; customer_phone: string | null; status: string; driver_id: string | null }[]).map((d, i) => {
    const confirmed = ['picked_up', 'in_transit', 'delivered', 'at_store'].includes(d.status)
    const denied = !d.driver_id && ['pending', 'cancelled', 'failed'].includes(d.status)
    const icon = confirmed ? '✅' : denied ? '❌' : '📋'
    const tag = confirmed ? ' — Хүлээж авлаа' : denied ? ' — Татгалзсан' : ''
    return `${i + 1}. ${icon} <b>#${d.delivery_number}</b>${tag}\n    📍 ${d.delivery_address || '—'}\n    👤 ${d.customer_name || '—'}${d.customer_phone ? ` · <code>${d.customer_phone}</code>` : ''}`
  }).join('\n\n')

  // Build smart keyboard: assigned → accept/deny, picked_up/in_transit → delivery actions
  type BatchDelivery = { id: string; status: string; driver_id: string | null }
  const typedBatch = batch as BatchDelivery[]
  const keyboardRows = typedBatch.flatMap(d => {
    if (d.status === 'assigned' && d.driver_id) {
      return [[
        { text: '✅ Хүлээж авлаа', callback_data: `confirm_received:${d.id}` },
        { text: '❌ Татгалзах', callback_data: `deny_delivery:${d.id}` },
      ]]
    }
    if (d.status === 'picked_up' || d.status === 'in_transit') {
      return [[
        { text: '✅ Хүргэлээ', callback_data: `delivered:${d.id}` },
        { text: '⏰ Хоцрох', callback_data: `delay:${d.id}` },
      ]]
    }
    return []
  })

  const newText = `🚚 <b>ЗАХИАЛГУУД — ${batchIds.length} хүргэлт</b>\n\n${lines}`
  const newKeyboard: TgInlineKeyboard = { inline_keyboard: keyboardRows }

  await tgEdit(chatId, messageId, newText, { replyMarkup: newKeyboard })
}

/** Handle inline button taps from drivers */
async function handleCallbackQuery(
  supabase: ReturnType<typeof createClient>,
  cb: TgCallbackQuery
): Promise<void> {
  const chatId = cb.message?.chat.id ?? cb.from.id
  const messageId = cb.message?.message_id
  const data = cb.data ?? ''
  const [action, deliveryId] = data.split(':')
  if (!deliveryId) {
    await tgAnswerCallback(cb.id, '❌ Алдаа гарлаа')
    return
  }

  // Look up driver by chat_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!driver) {
    await tgAnswerCallback(cb.id, '❌ Жолооч олдсонгүй')
    return
  }

  // Actions that trigger terminal state — remove buttons from the ORIGINAL delivery card
  // Intermediate actions (delivered, delay, issue, etc.) keep the card alive and send NEW messages
  // Note: payment_custom removes buttons in its handler because it waits for text input
  const terminalActions = [
    'reject', 'reject_handoff', // rejection terminal states
    'arrived_at_store', // transitions to handoff flow - removes assignment card
    'accept_handoff', // transitions to en-route flow
    // Note: payment_* actions handle their own in-place edits — excluded here
  ]
  if (messageId && terminalActions.includes(action)) {
    await tgRemoveButtons(chatId, messageId)
  }

  switch (action) {
    case 'arrived_at_store': {
      // Driver tapped "🏪 Дэлгүүрт ирлээ"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'at_store', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      await tgAnswerCallback(cb.id, '🏪 Бүртгэгдлээ!')
      await tgSend(chatId,
        `🏪 <b>Дэлгүүрт ирсэн гэж бүртгэгдлээ.</b>\n\n` +
        `Дэлгүүрийн менежер барааг таньд өгсний дараа "Бараа өгсөн" дарна.\n` +
        `Та хүлээх шаардлагатай — Telegram-д мэдэгдэл ирнэ.`
      )
      break
    }

    case 'picked_up': {
      // Legacy callback (old messages sent before arrived_at_store flow) — still works
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'picked_up' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      await tgSend(chatId,
        `✅ <b>Авлаа гэж бүртгэгдлээ.</b>\n\nХаягруу явна уу. Хүргэсэн үедээ доорх товчийг дарна уу.`,
        { replyMarkup: enRouteKeyboard(deliveryId) }
      )
      break
    }

    case 'confirm_received': {
      // Driver confirmed they picked up the package from the store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: confirmedDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, metadata')
        .eq('id', deliveryId)
        .single()

      if (!confirmedDelivery) {
        await tgAnswerCallback(cb.id, '❌ Хүргэлт олдсонгүй')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'picked_up', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      await tgAnswerCallback(cb.id, '✅ Хүлээж авлаа!')

      // Always edit the tapped message in-place with delivery action buttons
      if (messageId) {
        const updatedText =
          `✅ <b>ЗАХИАЛГА — #${confirmedDelivery.delivery_number}</b>\n\n` +
          `📍 Хаяг: ${confirmedDelivery.delivery_address || 'Тодорхойгүй'}\n` +
          `👤 Хүлээн авагч: ${confirmedDelivery.customer_name || '—'}\n` +
          `📞 Утас: ${confirmedDelivery.customer_phone || '—'}\n\n` +
          `✅ Хүлээж авлаа — Хаягруу явна уу!`
        await tgEdit(chatId, messageId, updatedText, { replyMarkup: enRouteKeyboard(deliveryId) })
      }
      break
    }

    case 'deny_delivery': {
      // Driver denied a delivery — unassign and notify store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deniedDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, store_id, metadata')
        .eq('id', deliveryId)
        .single()

      if (!deniedDelivery) {
        await tgAnswerCallback(cb.id, '❌ Олдсонгүй')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'pending', driver_id: null, updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      await tgAnswerCallback(cb.id, 'Татгалзлаа')
      await tgSend(chatId, `↩️ <b>#${deniedDelivery.delivery_number}</b> — Татгалзлаа.\nДэлгүүрт мэдэгдлээ.`)

      // Notify store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: deniedDelivery.store_id,
        type: 'delivery_driver_denied',
        title: '❌ Жолооч татгалзлаа',
        body: `${driver.name} жолооч #${deniedDelivery.delivery_number} хүргэлтийг татгалзлаа.`,
        metadata: { delivery_id: deliveryId },
      }).then(null, () => {})

      // Always remove buttons from the tapped message
      if (messageId) {
        await tgRemoveButtons(chatId, messageId)
      }
      break
    }

    case 'delivered': {
      // NEW PAYMENT FLOW: Do NOT update delivery status yet — show payment options first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deliveryInfo } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_fee, delivery_number, delivery_address, customer_name, customer_phone')
        .eq('id', deliveryId)
        .single()

      if (!deliveryInfo) {
        await tgAnswerCallback(cb.id, '❌ Хүргэлт олдсонгүй')
        break
      }

      // Fetch order total amount
      let totalAmount = 0
      const deliveryFee = deliveryInfo.delivery_fee || 0
      if (deliveryInfo.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orderData } = await (supabase as any)
          .from('orders')
          .select('total_amount')
          .eq('id', deliveryInfo.order_id)
          .single()
        totalAmount = orderData?.total_amount || 0
      }

      const grandTotal = totalAmount + deliveryFee
      const formattedOrder = totalAmount ? new Intl.NumberFormat('mn-MN').format(totalAmount) : '0'
      const formattedDelivery = deliveryFee ? new Intl.NumberFormat('mn-MN').format(deliveryFee) : '0'
      const formattedTotal = new Intl.NumberFormat('mn-MN').format(grandTotal)

      await tgAnswerCallback(cb.id, '💰 Төлбөрийн мэдээлэл')

      // Edit the same message in-place with payment options + delivery details
      if (messageId) {
        await tgEdit(chatId, messageId,
          `💰 <b>Төлбөрийн мэдээлэл — #${deliveryInfo.delivery_number}</b>\n\n` +
          (deliveryInfo.delivery_address ? `📍 ${deliveryInfo.delivery_address}\n` : '') +
          (deliveryInfo.customer_name ? `👤 ${deliveryInfo.customer_name}` : '') +
          (deliveryInfo.customer_phone ? ` · <code>${deliveryInfo.customer_phone}</code>` : '') +
          `\n\nЗахиалгын дүн: ${formattedOrder}₮\n` +
          `Хүргэлтийн үнэ: ${formattedDelivery}₮\n` +
          `<b>Нийт: ${formattedTotal}₮</b>\n\n` +
          `Төлбөрийн байдлыг сонгоно уу:`,
          { replyMarkup: paymentOptionsKeyboard(deliveryId, grandTotal) }
        )
      }
      break
    }

    case 'payment_full': {
      // Full payment received — fetch first, then update
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fullPayDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_number, delivery_fee, delivery_address, customer_name, customer_phone, store_id')
        .eq('id', deliveryId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', deliveryId)

      let paidAmount = 0
      let orderTotal = 0
      if (fullPayDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orderData } = await (supabase as any)
          .from('orders')
          .select('total_amount')
          .eq('id', fullPayDelivery.order_id)
          .single()
        orderTotal = orderData?.total_amount || 0
        paidAmount = orderTotal + (fullPayDelivery.delivery_fee || 0)

        // Mark order as paid
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', fullPayDelivery.order_id)
      }

      const fmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n)
      const deliveryFee = fullPayDelivery?.delivery_fee || 0
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      if (messageId) {
        const successText = fullPayDelivery
          ? `💰 <b>Төлбөрийн мэдээлэл — #${fullPayDelivery.delivery_number}</b>\n\n` +
            (fullPayDelivery.delivery_address ? `📍 ${fullPayDelivery.delivery_address}\n` : '') +
            (fullPayDelivery.customer_name ? `👤 ${fullPayDelivery.customer_name}` : '') +
            (fullPayDelivery.customer_phone ? ` · <code>${fullPayDelivery.customer_phone}</code>` : '') +
            `\n\nЗахиалгын дүн: ${fmt(orderTotal)}₮\n` +
            `Хүргэлтийн үнэ: ${fmt(deliveryFee)}₮\n` +
            `Нийт: ${fmt(paidAmount)}₮\n\n` +
            `✅ <b>Бүрэн төлбөр амжилттай бүртгэгдлээ. Баярлалаа, ${driver.name}!</b>`
          : `✅ <b>Бүрэн төлбөр амжилттай бүртгэгдлээ. Баярлалаа, ${driver.name}!</b>`
        await tgEdit(chatId, messageId, successText, { replyMarkup: { inline_keyboard: [] } })
      }

      // Notify store
      if (fullPayDelivery?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: fullPayDelivery.store_id,
          type: 'delivery_completed',
          title: `✅ Хүргэлт амжилттай`,
          body: `#${fullPayDelivery.delivery_number} хүргэгдэж, ${fmt(paidAmount)}₮ авлаа.`,
          metadata: { delivery_id: deliveryId, amount: paidAmount },
        }).then(null, () => {})
      }
      break
    }

    case 'payment_custom': {
      // Custom payment — set awaiting state in driver metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .single()

      const existingMeta = (customDriver?.metadata ?? {}) as Record<string, unknown>
      const newMeta = {
        ...existingMeta,
        awaiting_custom_payment: { deliveryId, step: 'amount', messageId: messageId ?? null },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers')
        .update({ metadata: newMeta })
        .eq('telegram_chat_id', chatId)

      const custPayHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      // Edit the payment message in-place — driver types amount in their next message
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${custPayHeader}💸 <b>Хэдэн төгрөг авсан бэ?</b>\n\nТоо оруулна уу (жишээ: 25000)`,
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
      break
    }

    case 'payment_delayed': {
      // Payment delayed — mark delivered but payment pending
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: delayedPayDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_number, delivery_address, customer_name, customer_phone, delivery_fee, store_id')
        .eq('id', deliveryId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          metadata: { payment_followup: true },
        })
        .eq('id', deliveryId)

      let delayedOrderTotal = 0
      let delayedOrderNumber = ''
      let delayedCustomerId = ''
      if (delayedPayDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: delayedOrderData } = await (supabase as any).from('orders').select('total_amount, order_number, customer_id').eq('id', delayedPayDelivery.order_id).single()
        delayedOrderTotal = delayedOrderData?.total_amount || 0
        delayedOrderNumber = delayedOrderData?.order_number || ''
        delayedCustomerId = delayedOrderData?.customer_id || ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({
            payment_status: 'pending',
            notes: 'Жолооч: хүргэгдсэн боловч төлбөр аваагүй',
            metadata: { payment_reminder_count: 1, first_reminder_at: new Date().toISOString(), last_reminder_at: new Date().toISOString() },
          })
          .eq('id', delayedPayDelivery.order_id)
      }

      const delayedFmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n)
      const delayedFee = delayedPayDelivery?.delivery_fee || 0
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        const delayedText = delayedPayDelivery
          ? `💰 <b>Төлбөрийн мэдээлэл — #${delayedPayDelivery.delivery_number}</b>\n\n` +
            (delayedPayDelivery.delivery_address ? `📍 ${delayedPayDelivery.delivery_address}\n` : '') +
            (delayedPayDelivery.customer_name ? `👤 ${delayedPayDelivery.customer_name}` : '') +
            (delayedPayDelivery.customer_phone ? ` · <code>${delayedPayDelivery.customer_phone}</code>` : '') +
            `\n\nЗахиалгын дүн: ${delayedFmt(delayedOrderTotal)}₮\n` +
            `Хүргэлтийн үнэ: ${delayedFmt(delayedFee)}₮\n` +
            `Нийт: ${delayedFmt(delayedOrderTotal + delayedFee)}₮\n\n` +
            `🕐 <b>Хүргэгдсэн — төлбөр аваагүй.</b>\nДэлгүүрт мэдэгдлээ. Харилцагч руу төлбөрийн сануулга явууллаа.`
          : `🕐 <b>Хүргэгдсэн — төлбөр аваагүй.</b>\nДэлгүүрт мэдэгдлээ. Харилцагч руу төлбөрийн сануулга явууллаа.`
        await tgEdit(chatId, messageId, delayedText, { replyMarkup: { inline_keyboard: [] } })
      }

      // Notify store urgently
      if (delayedPayDelivery?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: delayedPayDelivery.store_id,
          type: 'payment_pending',
          title: `⚠️ Төлбөр аваагүй`,
          body: `#${delayedPayDelivery.delivery_number} хүргэгдсэн боловч төлбөр аваагүй — харилцагчтай холбогдоно уу.`,
          metadata: { delivery_id: deliveryId, payment_followup: true },
        }).then(null, () => {})
      }

      // Send first payment reminder to customer immediately
      if (delayedCustomerId && delayedPayDelivery?.store_id) {
        try {
          // Find the customer's most recent conversation
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: custConversation } = await (supabase as any)
            .from('conversations')
            .select('id')
            .eq('customer_id', delayedCustomerId)
            .eq('store_id', delayedPayDelivery.store_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (custConversation) {
            const totalWithFee = delayedOrderTotal + delayedFee
            const fmtTotal = delayedFmt(totalWithFee)

            // Try to create QPay payment link if configured
            let paymentLinkText = ''
            if (isQPayConfigured() && delayedPayDelivery.order_id && delayedOrderNumber) {
              try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com'
                const invoice = await createQPayInvoice({
                  orderNumber: delayedOrderNumber,
                  amount: totalWithFee,
                  description: `Захиалга #${delayedOrderNumber} — төлбөр`,
                  callbackUrl: `${baseUrl}/api/payments/callback?order_id=${delayedPayDelivery.order_id}`,
                })
                paymentLinkText = `\n\n🔗 Төлбөр хийх: ${invoice.qPay_shortUrl}`

                // Store QPay invoice info in order notes
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from('orders')
                  .update({
                    notes: JSON.stringify({
                      qpay_invoice_id: invoice.invoice_id,
                      qpay_short_url: invoice.qPay_shortUrl,
                    }),
                  })
                  .eq('id', delayedPayDelivery.order_id)
              } catch (qpayErr) {
                console.error('[DriverBot] QPay invoice for payment reminder failed:', qpayErr)
              }
            }

            const reminderMsg =
              `💳 Сайн байна уу! Таны #${delayedOrderNumber || delayedPayDelivery.delivery_number} захиалга хүргэгдсэн боловч төлбөр хүлээгдэж байна.\n\n` +
              `Төлөх дүн: ${fmtTotal}₮\n` +
              `Төлбөрөө хийнэ үү. Асуудал байвал бидэнтэй холбогдоорой.` +
              paymentLinkText

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('messages').insert({
              conversation_id: custConversation.id,
              content: reminderMsg,
              is_from_customer: false,
              is_ai_response: true,
              metadata: { type: 'payment_reminder', reminder_count: 1, delivery_id: deliveryId },
            })
          }
        } catch (custMsgErr) {
          console.error('[DriverBot] Payment reminder to customer failed:', custMsgErr)
        }
      }
      break
    }

    case 'payment_received': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: paidDelivery } = await (supabase as any)
        .from('deliveries')
        .select('order_id')
        .eq('id', deliveryId)
        .single()
      if (paidDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', paidDelivery.order_id)
      }
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `✅ <b>Төлбөр авсан гэж бүртгэгдлээ.</b>\n\nБаярлалаа, ${driver.name}!`,
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
      break
    }

    case 'payment_pending': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingDelivery } = await (supabase as any)
        .from('deliveries')
        .select('order_id, customer_phone, store_id')
        .eq('id', deliveryId)
        .single()

      if (pendingDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'pending', notes: 'Жолооч: дараа төлнө гэсэн' })
          .eq('id', pendingDelivery.order_id)
      }
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        const phone = pendingDelivery?.customer_phone
        await tgEdit(chatId, messageId,
          `⏳ <b>Дараа төлнө гэж бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдлээ.` +
          (phone ? `\n📞 Харилцагч: <code>${phone}</code>` : ''),
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
      break
    }

    case 'payment_declined': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: declinedDelivery } = await (supabase as any)
        .from('deliveries')
        .select('order_id, customer_phone, customer_name, store_id')
        .eq('id', deliveryId)
        .single()

      if (declinedDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'failed', notes: 'Жолооч: харилцагч төлбөр татгалзав' })
          .eq('id', declinedDelivery.order_id)
      }
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      const declinedPhone = declinedDelivery?.customer_phone
      await tgSend(chatId,
        `❌ <b>Татгалзав гэж бүртгэгдлээ.</b>\n\nДэлгүүрт яаралтай мэдэгдлээ.` +
        (declinedPhone ? `\n📞 Харилцагч: <code>${declinedPhone}</code> — ${declinedDelivery?.customer_name || ''}` : '')
      )
      break
    }

    case 'unreachable': {
      const unreachableHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'delayed', notes: 'Харилцагч утас авсангүй' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${unreachableHeader}📵 <b>Утас авсангүй — бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдлээ. Удахгүй зааварчилгаа ирнэ.\n\nЕрдийн хүргэлтийг үргэлжлүүлнэ үү:`,
          { replyMarkup: enRouteKeyboard(deliveryId) }
        )
      }
      break
    }

    case 'delay': {
      // Show time-choice menu in-place — edit the en-route card
      const delayHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${delayHeader}⏰ <b>Хэзээ хүргэх боломжтой вэ?</b>\nДоорхоос сонгоно уу:`,
          { replyMarkup: delayKeyboard(deliveryId) }
        )
      }
      break
    }

    case 'delay_time': {
      // callback_data format: delay_time:<choice>:<deliveryId>
      const dtParts = data.split(':')
      const delayChoice = dtParts[1]     // today | tomorrow | week | custom
      const dtDeliveryId = dtParts[2]    // actual delivery UUID

      if (delayChoice === 'custom') {
        // Save awaiting state in driver metadata — next text will be the custom time
        // Also store messageId so the reply can edit in-place
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: drvMeta } = await (supabase as any).from('delivery_drivers').select('metadata').eq('telegram_chat_id', chatId).single()
        const newMeta = { ...(drvMeta?.metadata ?? {}), awaiting_delay_time: dtDeliveryId, awaiting_delay_message_id: messageId ?? null }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({ metadata: newMeta }).eq('telegram_chat_id', chatId)
        await tgAnswerCallback(cb.id)
        const dtCustomHeader = await getDeliveryHeader(supabase, dtDeliveryId)
        if (messageId) {
          await tgEdit(chatId, messageId,
            `${dtCustomHeader}✏️ <b>Хүргэх цагийг бичнэ үү.</b>\n\nЖишээ нь:\n• "Өнөөдөр 18:00"\n• "Маргааш 10-11 цаг"\n• "Гаригт 14:00"`,
            { replyMarkup: { inline_keyboard: [] } }
          )
        }
        break
      }

      const now = new Date()
      let etaLabel = ''
      let etaIso = ''
      if (delayChoice === 'today') {
        now.setHours(now.getHours() + 3)
        etaIso = now.toISOString()
        etaLabel = 'Өнөөдөр дараа (~3 цаг)'
      } else if (delayChoice === 'tomorrow') {
        now.setDate(now.getDate() + 1)
        now.setHours(12, 0, 0, 0)
        etaIso = now.toISOString()
        etaLabel = 'Маргааш'
      } else if (delayChoice === 'week') {
        const daysToSat = (6 - now.getDay() + 7) % 7 || 7
        now.setDate(now.getDate() + daysToSat)
        now.setHours(12, 0, 0, 0)
        etaIso = now.toISOString()
        etaLabel = 'Энэ амралтын өдрүүдэд'
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delayed', estimated_delivery_time: etaIso || null, notes: `Хоцрох: ${etaLabel}` })
        .eq('id', dtDeliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: delayedDel } = await (supabase as any)
        .from('deliveries')
        .select('delivery_number, store_id, order_id')
        .eq('id', dtDeliveryId)
        .single()

      const dtHeader = await getDeliveryHeader(supabase, dtDeliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${dtHeader}⏰ <b>ХОЙШЛУУЛСАН</b>\n📅 Шинэ хугацаа: ${etaLabel}`,
          { replyMarkup: enRouteKeyboard(dtDeliveryId) }
        )
      }
      if (delayedDel) {
        // Dashboard notification
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: delayedDel.store_id, type: 'delivery_delayed',
          title: '⏰ Хүргэлт хоцорлоо',
          body: `${driver.name} — #${delayedDel.delivery_number}: ${etaLabel} хүргэнэ.`,
          metadata: { delivery_id: dtDeliveryId, eta: etaIso },
        }).then(null, () => {})

        // Update order notes
        if (delayedDel.order_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('orders')
            .update({ notes: `⏰ Хойшлуулсан: ${etaLabel}` })
            .eq('id', delayedDel.order_id)
        }

        // Telegram notification to staff + members
        const dtBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (dtBotToken) {
          const dtTgMsg =
            `⏰ <b>ХҮРГЭЛТ ХОЙШЛУУЛСАН</b>\n\n` +
            `🆔 #${delayedDel.delivery_number}\n` +
            `🚚 Жолооч: ${driver.name}\n` +
            `📅 Шинэ хугацаа: ${etaLabel}\n`
          const dtChatIds = await getStaffMemberChatIds(supabase, delayedDel.store_id)
          for (const cid of dtChatIds) {
            await fetch(`https://api.telegram.org/bot${dtBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cid, text: dtTgMsg, parse_mode: 'HTML' }),
            }).catch(() => {})
          }
        }
      }
      break
    }

    case 'issue': {
      const issueHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId, `${issueHeader}⚠️ <b>Ямар асуудал гарсан бэ?</b>`, { replyMarkup: issueKeyboard(deliveryId) })
      }
      break
    }

    case 'wrong_product': {
      const wpHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({
          status: 'failed',
          notes: 'Буруу бараа — зураг хүлээж байна',
          metadata: { awaiting_wrong_photo: true },
        })
        .eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      // Save state so photo handler knows this is a wrong-item photo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('delivery_drivers')
        .update({ metadata: { ...((driver as Record<string, unknown>).metadata as Record<string, unknown> ?? {}), awaiting_wrong_photo: deliveryId } })
        .eq('id', driver.id)
      if (messageId) await tgEdit(chatId, messageId, `${wpHeader}📦 <b>БУРУУ БАРАА</b>\n📸 Буруу барааны зургийг илгээнэ үү.`, { replyMarkup: { inline_keyboard: [] } })

      // Notification and customer message now happen in the photo handler
      // after driver sends the wrong item photo
      break
    }

    case 'wrong_returned': {
      // Driver confirms they returned the wrong item to warehouse
      const wrHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: wrDel } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, store_id, metadata')
        .eq('id', deliveryId)
        .single()

      if (wrDel) {
        const existingMeta = (wrDel.metadata ?? {}) as Record<string, unknown>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('deliveries')
          .update({
            notes: 'Буруу бараа — агуулахад буцааж өгсөн',
            metadata: { ...existingMeta, wrong_item_returned: true, wrong_item_returned_at: new Date().toISOString() },
          })
          .eq('id', deliveryId)

        await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
        if (messageId) await tgEdit(chatId, messageId, `${wrHeader}📦 <b>БУЦААЖ ӨГСӨН</b>\nБаярлалаа! Дэлгүүрт мэдэгдлээ.`, { replyMarkup: { inline_keyboard: [] } })

        // Notify staff/members via store bot
        const storeBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (storeBotToken) {
          const allChatIds: string[] = []

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: storeStaff } = await (supabase as any)
            .from('staff')
            .select('telegram_chat_id')
            .eq('store_id', wrDel.store_id)
            .not('telegram_chat_id', 'is', null)
          for (const s of (storeStaff || []) as Array<{ telegram_chat_id: string }>) {
            if (s.telegram_chat_id && !allChatIds.includes(s.telegram_chat_id)) allChatIds.push(s.telegram_chat_id)
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: storeMembers } = await (supabase as any)
            .from('store_members')
            .select('telegram_chat_id, notification_preferences')
            .eq('store_id', wrDel.store_id)
            .not('telegram_chat_id', 'is', null)
          for (const m of (storeMembers || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
            const prefs = m.notification_preferences || {}
            if (m.telegram_chat_id && prefs.delivery !== false && !allChatIds.includes(m.telegram_chat_id)) {
              allChatIds.push(m.telegram_chat_id)
            }
          }

          const returnMsg =
            `📦 <b>БУРУУ БАРАА БУЦААГДЛАА</b>\n\n` +
            `🆔 Хүргэлт: #${wrDel.delivery_number}\n` +
            `👤 Жолооч: ${(driver as Record<string, unknown>).name}\n\n` +
            `Жолооч буруу барааг агуулахад буцааж өгсөн.\n` +
            `⚠️ <b>Хүлээн авч, ямар бараа буруу илгээсэнийг тэмдэглэнэ үү.</b>\n\n` +
            `Dashboard → Захиалга → Хүргэлт #${wrDel.delivery_number}`

          for (const sChatId of allChatIds) {
            try {
              await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: sChatId, text: returnMsg, parse_mode: 'HTML' }),
              })
            } catch (tgErr) {
              console.error(`[DriverBot] Wrong return notify failed for ${sChatId}:`, tgErr)
            }
          }
        }

        // Dashboard notification
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: wrDel.store_id, type: 'delivery_failed',
          title: '📦 Буруу бараа буцаагдлаа',
          body: `${(driver as Record<string, unknown>).name} — #${wrDel.delivery_number}: буруу барааг агуулахад буцааж өгсөн. Хүлээн авч тэмдэглэнэ үү.`,
          metadata: { delivery_id: deliveryId, reason: 'wrong_product_returned' },
        }).then(null, () => {})
      } else {
        await tgAnswerCallback(cb.id, 'Хүргэлт олдсонгүй')
      }
      break
    }

    case 'damaged': {
      const dmHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Гэмтсэн бараа' }).eq('id', deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dmDel } = await (supabase as any).from('deliveries').select('delivery_number, store_id, customer_name, customer_phone, delivery_address').eq('id', deliveryId).single()
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) await tgEdit(chatId, messageId, `${dmHeader}💔 <b>ГЭМТСЭН БАРАА</b>\nЗураг авч, агуулахад буцааж өгнө үү.`, { replyMarkup: { inline_keyboard: [] } })
      if (dmDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: dmDel.store_id, type: 'delivery_failed', title: '💔 Гэмтсэн бараа', body: `${driver.name} — #${dmDel.delivery_number}: гэмтсэн бараа.`, metadata: { delivery_id: deliveryId, reason: 'damaged' } }).then(null, () => {})

        // Notify staff + members via store bot
        console.log('[DriverBot] Damaged item — notifying staff for store:', dmDel.store_id)
        const dmBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (dmBotToken) {
          const dmMsg =
            `💔 <b>ГЭМТСЭН БАРАА</b>\n\n` +
            `🆔 Хүргэлт: #${dmDel.delivery_number}\n` +
            `👤 ${dmDel.customer_name || '—'}` + (dmDel.customer_phone ? ` · <code>${dmDel.customer_phone}</code>` : '') + `\n` +
            `📍 ${dmDel.delivery_address || '—'}\n\n` +
            `🚚 Жолооч: ${(driver as Record<string, unknown>).name}\n` +
            `⚠️ Зураг авч, агуулахад буцааж өгнө.`
          const dmChatIds = await getStaffMemberChatIds(supabase, dmDel.store_id)
          for (const cid of dmChatIds) {
            await fetch(`https://api.telegram.org/bot${dmBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cid, text: dmMsg, parse_mode: 'HTML' }),
            }).catch(() => {})
          }
        }
      }
      break
    }

    case 'no_payment': {
      const npHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Харилцагч мөнгө өгсөнгүй' }).eq('id', deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: npDel } = await (supabase as any).from('deliveries').select('delivery_number, store_id, customer_name, customer_phone, delivery_address').eq('id', deliveryId).single()
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) await tgEdit(chatId, messageId, `${npHeader}💰 <b>МӨНГӨ ӨГСӨНГҮЙ</b>\nДэлгүүрт мэдэгдлээ.`, { replyMarkup: { inline_keyboard: [] } })
      if (npDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: npDel.store_id, type: 'delivery_failed', title: '💰 Мөнгө өгсөнгүй', body: `${driver.name} — #${npDel.delivery_number}: харилцагч мөнгө өгсөнгүй.`, metadata: { delivery_id: deliveryId, reason: 'no_payment' } }).then(null, () => {})

        // Notify staff + members via store bot
        console.log('[DriverBot] No payment — notifying staff for store:', npDel.store_id)
        const npBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (npBotToken) {
          const npMsg =
            `💰 <b>МӨНГӨ ӨГСӨНГҮЙ</b>\n\n` +
            `🆔 Хүргэлт: #${npDel.delivery_number}\n` +
            `👤 ${npDel.customer_name || '—'}` + (npDel.customer_phone ? ` · <code>${npDel.customer_phone}</code>` : '') + `\n` +
            `📍 ${npDel.delivery_address || '—'}\n\n` +
            `🚚 Жолооч: ${(driver as Record<string, unknown>).name}\n` +
            `⚠️ Харилцагч төлбөр төлөөгүй.`
          const npChatIds = await getStaffMemberChatIds(supabase, npDel.store_id)
          for (const cid of npChatIds) {
            await fetch(`https://api.telegram.org/bot${npBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cid, text: npMsg, parse_mode: 'HTML' }),
            }).catch(() => {})
          }
        }
      }
      break
    }

    case 'confirm_cod': {
      // Driver confirms COD payment collected — show payment keyboard in-place
      const codHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${codHeader}💳 <b>Төлбөрийн байдал?</b>\n\nХарилцагч мөнгийг өгсөн эсэхийг сонгоно уу.`,
          { replyMarkup: paymentKeyboard(deliveryId) }
        )
      }
      break
    }

    case 'customer_info': {
      // Show customer contact details as an alert popup (keeps the message unchanged)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: infoDelivery } = await (supabase as any)
        .from('deliveries')
        .select('customer_name, customer_phone, delivery_address, delivery_number')
        .eq('id', deliveryId)
        .single()
      if (!infoDelivery) {
        await tgAnswerCallback(cb.id, '❓ Мэдээлэл олдсонгүй', true)
        break
      }
      const infoText = `#${infoDelivery.delivery_number}\n` +
        `👤 ${infoDelivery.customer_name || '—'}\n` +
        `📞 ${infoDelivery.customer_phone || '—'}\n` +
        `📍 ${infoDelivery.delivery_address || '—'}`
      await tgAnswerCallback(cb.id, infoText, true)
      break
    }

    case 'receiver_complaint': {
      // Receiver has a complaint — mark delayed, notify store
      const complaintHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delayed', notes: 'Хүлээн авагч гомдол мэдэгдлээ' })
        .eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${complaintHeader}💬 <b>Гомдол бүртгэгдлээ.</b>\n\n` +
          `Дэлгүүрийн менежерт мэдэгдлээ. Удахгүй холбогдох болно.\n` +
          `Барааг хэвийнээр хүргэх эсэхийг хүлээгээрэй.`,
          { replyMarkup: enRouteKeyboard(deliveryId) }
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: complaintDelivery } = await (supabase as any)
        .from('deliveries')
        .select('delivery_number, store_id')
        .eq('id', deliveryId)
        .single()
      if (complaintDelivery) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: complaintDelivery.store_id,
          type: 'delivery_delayed',
          title: 'Хүлээн авагч гомдол мэдэгдлээ',
          body: `${driver.name} — Захиалга #${complaintDelivery.delivery_number}: хүлээн авагч гомдол мэдэгдлээ. Холбогдоно уу.`,
          metadata: { delivery_id: deliveryId, reason: 'receiver_complaint' },
        }).then(null, () => {})
      }
      break
    }

    case 'reject': {
      // Reset delivery to pending
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rejectedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'pending', driver_id: null })
        .eq('id', deliveryId)
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, store_id, order_id')
        .single()

      await tgAnswerCallback(cb.id, 'Татгалзлаа')
      await tgSend(chatId, `↩️ Татгалзлаа. Баярлалаа — дэлгүүр өөр жолооч томилно.`)

      // Auto-reassign: find next available driver
      if (rejectedDelivery) {
        try {
          // Get other available drivers (excluding the rejecting driver)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: otherDrivers } = await (supabase as any)
            .from('delivery_drivers')
            .select('id, name, vehicle_type, current_location, delivery_zones')
            .eq('store_id', rejectedDelivery.store_id)
            .neq('id', driver.id)
            .in('status', ['active', 'on_delivery'])

          if (otherDrivers && otherDrivers.length > 0) {
            // Build candidates
            const candidates = await Promise.all(otherDrivers.map(async (d: Record<string, unknown>) => {
              const { count } = await supabase
                .from('deliveries')
                .select('id', { count: 'exact', head: true })
                .eq('driver_id', d.id)
                .in('status', ['assigned', 'picked_up', 'in_transit'])
              return {
                id: d.id, name: d.name,
                location: d.current_location,
                active_delivery_count: count || 0,
                vehicle_type: d.vehicle_type,
                completion_rate: 100,
                delivery_zones: d.delivery_zones || [],
              }
            }))

            const result = await assignDriver(
              { address: rejectedDelivery.delivery_address },
              candidates,
              { ...DEFAULT_DELIVERY_SETTINGS, assignment_mode: 'auto' }
            )

            if (result.recommended_driver_id) {
              // Assign new driver
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from('deliveries')
                .update({ status: 'assigned', driver_id: result.recommended_driver_id })
                .eq('id', deliveryId)

              // Notify new driver via Telegram
              await sendToDriver(
                supabase,
                result.recommended_driver_id,
                DRIVER_PROACTIVE_MESSAGES.orderAssigned({
                  orderNumber: rejectedDelivery.delivery_number,
                  deliveryAddress: rejectedDelivery.delivery_address,
                  customerName: rejectedDelivery.customer_name,
                  customerPhone: rejectedDelivery.customer_phone,
                }),
                orderAssignedKeyboard(deliveryId)
              )
              console.log(`[DriverBot] Auto-reassigned ${deliveryId} to ${result.recommended_driver_id}`)
            } else {
              // No driver available — log for store owner
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('notifications').insert({
                store_id: rejectedDelivery.store_id,
                type: 'delivery_unassigned',
                title: `Хүргэлт томилогдоогүй — #${rejectedDelivery.delivery_number}`,
                message: `${driver.name} татгалзсан. Боломжтой жолооч байхгүй байна.`,
                metadata: { delivery_id: deliveryId },
              }).then(null, () => {})
              console.log(`[DriverBot] No available driver for ${deliveryId} after rejection`)
            }
          }
        } catch (err) {
          console.error('[DriverBot] Auto-reassign failed:', err)
        }
      }
      break
    }

    // ── Intercity wizard ─────────────────────────────────────────────────

    case 'intercity_start': {
      // Driver tapped "🚌 Тээвэрт өгсөн" — start wizard
      await tgAnswerCallback(cb.id, '📋 Мэдээлэл оруулна уу')
      // Save wizard state to driver metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow) { await tgAnswerCallback(cb.id, '❌ Жолооч олдсонгүй'); break }

      const wizard: IntercityWizard = { delivery_id: deliveryId, step: 'transport_type' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...(driverRow.metadata as object || {}), intercity_wizard: wizard },
      }).eq('id', driverRow.id)

      await tgSend(chatId,
        `🚌 <b>Хотоор хоорондын тээвэр</b>\n\nТээврийн төрлийг сонгоно уу:`,
        { replyMarkup: intercityTransportKeyboard(deliveryId) }
      )
      break
    }

    case 'intercity_type': {
      // action = 'intercity_type', deliveryId = 'bus' or 'private', third part = actual id
      // callback_data format: intercity_type:bus:deliveryId
      const parts = data.split(':')
      const transport = parts[1] as 'bus' | 'private'
      const actualDeliveryId = parts[2]
      if (!transport || !actualDeliveryId) { await tgAnswerCallback(cb.id, '❌ Алдаа'); break }

      await tgAnswerCallback(cb.id, transport === 'bus' ? '🚌 Автобус' : '🚗 Хувийн жолооч')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow2 } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow2) break

      const wizard2: IntercityWizard = {
        delivery_id: actualDeliveryId,
        step: 'phone',
        transport,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...(driverRow2.metadata as object || {}), intercity_wizard: wizard2 },
      }).eq('id', driverRow2.id)

      const label = transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
      await tgSend(chatId,
        `${label} сонгогдлоо.\n\n📞 <b>Жолоочийн утасны дугаар</b> оруулна уу:\n(жишээ: 99112233)`
      )
      break
    }

    case 'intercity_pay_yes':
    case 'intercity_pay_no': {
      const paymentCollected = action === 'intercity_pay_yes'
      await tgAnswerCallback(cb.id, paymentCollected ? '✅ Баталгаажлаа' : '📋 Бүртгэгдлээ')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ipDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!ipDriver) break

      const ipMeta = ipDriver.metadata as Record<string, unknown> | null
      const ipWiz = ipMeta?.intercity_wizard as IntercityWizard | undefined
      if (!ipWiz) break

      const updatedWiz: IntercityWizard = { ...ipWiz, step: 'confirm', payment_collected: paymentCollected }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...ipMeta, intercity_wizard: updatedWiz },
      }).eq('id', ipDriver.id)

      // Show summary for confirmation
      const tLabel = ipWiz.transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
      const payLabel = paymentCollected ? '✅ Урьдчилж авсан' : '⏳ Дараа авна'
      await tgSend(chatId,
        `💳 Төлбөр: <b>${payLabel}</b> ✅\n\n` +
        `──────────────────\n` +
        `📋 <b>Дараах мэдээлэл үнэн зөв үү?</b>\n\n` +
        `${tLabel}\n` +
        `📞 Жолоочийн утас: <b>${ipWiz.phone}</b>\n` +
        `🚗 Машины дугаар: <b>${ipWiz.license}</b>\n` +
        `⏰ Ирэх хугацаа: <b>${ipWiz.eta}</b>\n` +
        `💳 Төлбөр: <b>${payLabel}</b>`,
        { replyMarkup: intercityConfirmKeyboard(ipWiz.delivery_id) }
      )
      break
    }

    case 'intercity_confirm': {
      // Confirm — save to DB + send customer message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow3 } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow3) { await tgAnswerCallback(cb.id, '❌ Алдаа'); break }

      const meta3 = driverRow3.metadata as Record<string, unknown> | null
      const wiz3 = meta3?.intercity_wizard as IntercityWizard | undefined
      if (!wiz3 || wiz3.step !== 'confirm' || !wiz3.transport || !wiz3.phone || !wiz3.license || !wiz3.eta) {
        await tgAnswerCallback(cb.id, '❌ Мэдээлэл дутуу — дахин оролдоно уу')
        break
      }

      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')

      const handoff = {
        transport: wiz3.transport,
        phone: wiz3.phone,
        license: wiz3.license,
        eta: wiz3.eta,
        payment_collected: wiz3.payment_collected ?? false,
        dispatched_at: new Date().toISOString(),
      }

      // Update delivery status + store handoff in metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({
          status: 'in_transit',
          estimated_delivery_time: wiz3.eta,
          metadata: { intercity_handoff: handoff },
          updated_at: new Date().toISOString(),
        })
        .eq('id', wiz3.delivery_id)
        .select('id, order_id, delivery_number, store_id')
        .single()

      // Clear wizard state from driver
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearedMeta = { ...(driverRow3.metadata as object || {}) }
      delete (clearedMeta as Record<string, unknown>).intercity_wizard
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('id', driverRow3.id)

      // Send customer notification via messages table
      if (updatedDelivery?.order_id) {
        try {
          // Get order number
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: order } = await (supabase as any)
            .from('orders')
            .select('order_number, customer_id')
            .eq('id', updatedDelivery.order_id)
            .single()

          if (order?.customer_id) {
            // Find the most recent conversation for this customer + store
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: conversation } = await (supabase as any)
              .from('conversations')
              .select('id')
              .eq('customer_id', order.customer_id)
              .eq('store_id', updatedDelivery.store_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (conversation) {
              const customerMsg = intercityCustomerMessage(order.order_number, handoff)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('messages').insert({
                conversation_id: conversation.id,
                content: customerMsg,
                is_from_customer: false,
                is_ai_response: false,
                metadata: { type: 'intercity_dispatch', handoff },
              })
            }
          }
        } catch (notifyErr) {
          console.error('[DriverBot] Customer notify failed:', notifyErr)
        }
      }

      // Confirm to driver
      const transportLabel = wiz3.transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
      const paymentLabel = wiz3.payment_collected ? '✅ Авсан' : '⏳ Дараа'
      await tgSend(chatId,
        `✅ <b>Амжилттай бүртгэгдлээ!</b>\n\n` +
        `📦 Захиалга: #${updatedDelivery?.delivery_number || wiz3.delivery_id}\n` +
        `${transportLabel}\n` +
        `📞 Жолоочийн утас: ${wiz3.phone}\n` +
        `🚗 Машины дугаар: ${wiz3.license}\n` +
        `⏰ Ирэх хугацаа: ${wiz3.eta}\n` +
        `💳 Төлбөр: ${paymentLabel}\n\n` +
        `Харилцагч руу мэдэгдэл явуулсан. Баярлалаа!`
      )
      break
    }

    case 'intercity_retry': {
      // Reset wizard back to transport_type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow4 } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow4) { await tgAnswerCallback(cb.id, '❌ Алдаа'); break }

      const meta4 = driverRow4.metadata as Record<string, unknown> | null
      const wiz4 = meta4?.intercity_wizard as IntercityWizard | undefined
      const retryDeliveryId = wiz4?.delivery_id || deliveryId

      const freshWizard: IntercityWizard = { delivery_id: retryDeliveryId, step: 'transport_type' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...(driverRow4.metadata as object || {}), intercity_wizard: freshWizard },
      }).eq('id', driverRow4.id)

      await tgAnswerCallback(cb.id, '🔄 Дахин оруулна уу')
      await tgSend(chatId,
        `🔄 <b>Дахин оруулна уу.</b>\n\nТээврийн төрлийг сонгоно уу:`,
        { replyMarkup: intercityTransportKeyboard(retryDeliveryId) }
      )
      break
    }

    // ── Handoff accept/reject (Feature 3) ────────────────────────────────────

    case 'accept_handoff': {
      // Driver accepts handoff → transition to picked_up
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: acceptedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'picked_up', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, store_id')
        .single()

      await tgAnswerCallback(cb.id, '✅ Хүлээж авлаа!')

      // Send en-route keyboard
      await tgSend(chatId,
        `🚚 <b>Амжилт хүргэе!</b>\n\n` +
        `📦 Захиалга: #${acceptedDelivery?.delivery_number || ''}\n` +
        (acceptedDelivery?.customer_name ? `👤 ${acceptedDelivery.customer_name}\n` : '') +
        `📍 Хаяг: ${acceptedDelivery?.delivery_address || 'Тодорхойгүй'}\n` +
        (acceptedDelivery?.customer_phone ? `📞 <code>${acceptedDelivery.customer_phone}</code>\n` : ''),
        { replyMarkup: enRouteKeyboard(deliveryId) }
      )
      break
    }

    case 'reject_handoff': {
      // Driver rejects handoff → revert to assigned, notify store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rejectedHandoff } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .select('id, delivery_number, store_id, driver_id')
        .single()

      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `❌ <b>Бүртгэгдлээ.</b>\n\nМенежертэй холбогдоно уу.`)

      // Notify store manager
      if (rejectedHandoff?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: rejectedHandoff.store_id,
          type: 'handoff_rejected',
          title: `❌ Жолооч татгалзлаа`,
          body: `${driver.name} #${rejectedHandoff.delivery_number} барааг хүлээж авахаас татгалзлаа.`,
          metadata: { delivery_id: deliveryId, driver_id: rejectedHandoff.driver_id },
        }).then(null, () => {})
      }
      break
    }

    // ── Batch assignment flow (batch_ready, deny, deny_reason, batch_confirm) ────

    case 'batch_ready': {
      // Driver tapped "✅ Бэлэн байна — хүргэлтүүдийг харах"
      // deliveryId here is actually the batchKey
      const batchKey = deliveryId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, name, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

      if (!batchDriver) {
        await tgAnswerCallback(cb.id, '❌ Жолооч олдсонгүй')
        break
      }

      const bMeta = batchDriver.metadata as Record<string, unknown> | null
      const pendingBatch = bMeta?.pending_batch as { batchKey: string; deliveryIds: string[]; storeId?: string } | undefined
      if (!pendingBatch || pendingBatch.batchKey !== batchKey) {
        await tgAnswerCallback(cb.id, '❌ Хуучин мэдэгдэл')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchDeliveries } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, delivery_address, customer_name, customer_phone')
        .in('id', pendingBatch.deliveryIds)
        .eq('driver_id', batchDriver.id)
        .eq('status', 'assigned')

      if (!batchDeliveries || batchDeliveries.length === 0) {
        await tgAnswerCallback(cb.id, 'Захиалга байхгүй')
        await tgSend(chatId, '📭 Хуваарилагдсан захиалга байхгүй байна.')
        break
      }

      if (messageId) await tgRemoveButtons(chatId, messageId)
      await tgAnswerCallback(cb.id, `${batchDeliveries.length} хүргэлт`)

      // Send each delivery as a review card with deny button
      for (const d of batchDeliveries as { id: string; delivery_number: string; delivery_address: string; customer_name: string | null; customer_phone: string | null }[]) {
        await tgSend(chatId,
          `📋 <b>#${d.delivery_number}</b>\n📍 ${d.delivery_address}\n👤 ${d.customer_name || '—'}${d.customer_phone ? ` · <code>${d.customer_phone}</code>` : ''}`,
          { replyMarkup: deliveryDenyKeyboard(d.id) }
        )
      }

      // Final confirm button
      await tgSend(chatId,
        `✅ Татгалзах гэснийг дарна уу. Үлдсэнийг автоматаар зөвшөөрнө.`,
        { replyMarkup: batchConfirmKeyboard(batchKey) }
      )
      break
    }

    case 'deny': {
      // Driver wants to deny a specific delivery — show reason options
      await tgAnswerCallback(cb.id)
      await tgSend(chatId, '❌ Татгалзах шалтгааныг сонгоно уу:', { replyMarkup: denyReasonKeyboard(deliveryId) })
      break
    }

    case 'deny_reason': {
      // callback_data format: deny_reason:area:UUID → split(':') gives ['deny_reason','area','UUID']
      const drParts = data.split(':')
      const drReason = drParts[1]
      const drDeliveryId = drParts[2]
      if (!drReason || !drDeliveryId) {
        await tgAnswerCallback(cb.id, '❌ Алдаа')
        break
      }

      const DENY_LABELS: Record<string, string> = {
        area: 'Бүсэд биш',
        far: 'Хэт алс',
        heavy: 'Хэт их ачаа',
        busy: 'Цаг гаргахгүй',
        other: 'Бусад',
      }
      const reasonLabel = DENY_LABELS[drReason] ?? drReason

      // If "other" reason, ask for custom text
      if (drReason === 'other') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: otherDriver } = await (supabase as any)
          .from('delivery_drivers')
          .select('id, metadata')
          .eq('telegram_chat_id', chatId)
          .single()

        if (otherDriver) {
          const nm = { ...(otherDriver.metadata ?? {}), awaiting_deny_reason: { deliveryId: drDeliveryId } }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('delivery_drivers').update({ metadata: nm }).eq('id', otherDriver.id)
        }

        if (messageId) await tgRemoveButtons(chatId, messageId)
        await tgAnswerCallback(cb.id)
        await tgSend(chatId, '✏️ <b>Татгалзах шалтгааныг бичнэ үү:</b>')
        break
      }

      // Deny with preset reason — update delivery to pending, clear driver, record denial_info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deniedDel } = await (supabase as any)
        .from('deliveries')
        .update({
          status: 'pending',
          driver_id: null,
          denial_info: {
            driver_id: driver.id,
            driver_name: driver.name,
            reason: drReason,
            reason_label: reasonLabel,
            denied_at: new Date().toISOString(),
          },
        })
        .eq('id', drDeliveryId)
        .select('delivery_number, store_id')
        .single()

      if (messageId) await tgRemoveButtons(chatId, messageId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `↩️ <b>#${deniedDel?.delivery_number}</b> — татгалзлаа (${reasonLabel}). Менежерт мэдэгдлээ.`)

      // Notify store
      if (deniedDel?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: deniedDel.store_id,
          type: 'delivery_denied',
          title: '❌ Жолооч татгалзлаа',
          body: `${driver.name} #${deniedDel.delivery_number} татгалзлаа: ${reasonLabel}`,
          metadata: { delivery_id: drDeliveryId, reason: drReason },
        }).then(null, () => {})
      }
      break
    }

    case 'batch_confirm': {
      // Driver confirms all non-denied deliveries
      const confirmBatchKey = deliveryId // batchKey is in "deliveryId" slot after split
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cbDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, name, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

      if (!cbDriver) {
        await tgAnswerCallback(cb.id, '❌ Алдаа')
        break
      }

      const cbMeta = cbDriver.metadata as Record<string, unknown> | null
      const cbBatch = cbMeta?.pending_batch as { batchKey: string; deliveryIds: string[] } | undefined

      const deliveryIds = cbBatch?.deliveryIds ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: remaining } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number')
        .in('id', deliveryIds)
        .eq('driver_id', cbDriver.id)
        .eq('status', 'assigned')

      if (messageId) await tgRemoveButtons(chatId, messageId)

      // Clear the pending_batch from driver metadata
      const clearedMeta = { ...cbMeta }
      delete clearedMeta.pending_batch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('id', cbDriver.id)

      if (!remaining || remaining.length === 0) {
        await tgAnswerCallback(cb.id, 'Бүгдийг татгалзлаа')
        await tgSend(chatId, '📭 Бүх хүргэлтийг татгалзлаа. Менежерт мэдэгдлээ.')
      } else {
        await tgAnswerCallback(cb.id, `✅ ${remaining.length} баталлаа!`)
        await tgSend(chatId,
          `✅ <b>${remaining.length} хүргэлт баталлаа!</b>\n\n` +
          `Дэлгүүр рүү очиж барааг хүлээж аваарай.\n` +
          `Мэдэгдэл ирнэ.`
        )
      }
      break
    }

    // ── Customer Refusal (Feature 7) ─────────────────────────────────────────

    case 'customer_refused': {
      // Customer refused to accept delivery — driver will enter reason (edit in-place)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: refusalDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .single()

      if (refusalDriver) {
        const existingMeta = (refusalDriver.metadata ?? {}) as Record<string, unknown>
        const newMeta = {
          ...existingMeta,
          awaiting_refusal_reason: { deliveryId, messageId: messageId ?? null },
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers')
          .update({ metadata: newMeta })
          .eq('telegram_chat_id', chatId)
      }

      const refusalHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${refusalHeader}🚫 <b>Татгалзсан шалтгааныг бичнэ үү:</b>`,
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
      break
    }

    default:
      await tgAnswerCallback(cb.id, '❓ Тодорхойгүй үйлдэл')
  }
}

/** Clean a phone number to 8 digits (Mongolian mobile) */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^976/, '').slice(-8)
}

// ─── TG Account History ─────────────────────────────────────────────────────

interface TgAccountEntry {
  chat_id: number
  first_name: string
  last_name?: string
  username?: string
  linked_at: string
}

/**
 * Record a Telegram account link into driver metadata.telegram_history.
 * Always saves the new chat_id as current; old one gets pushed to history.
 */
async function recordTgHistory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient<any>>,
  driverId: string,
  newChatId: number,
  from: { id: number; first_name?: string; last_name?: string; username?: string }
): Promise<boolean> {
  // Fetch current driver metadata + existing chat_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drv } = await (supabase as any)
    .from('delivery_drivers')
    .select('telegram_chat_id, metadata')
    .eq('id', driverId)
    .single()

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta: Record<string, any> = drv?.metadata ?? {}
  const history: TgAccountEntry[] = meta.telegram_history ?? []

  // Add the new account at the front (most recent first)
  const newEntry: TgAccountEntry = {
    chat_id: newChatId,
    first_name: from.first_name ?? 'Unknown',
    ...(from.last_name ? { last_name: from.last_name } : {}),
    ...(from.username ? { username: from.username } : {}),
    linked_at: now,
  }

  // Deduplicate: remove previous entry for this chat_id (if re-linking)
  const filtered = history.filter((h) => h.chat_id !== newChatId)
  const updatedHistory = [newEntry, ...filtered].slice(0, 20) // keep last 20

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('delivery_drivers')
    .update({
      telegram_chat_id: newChatId,
      telegram_linked_at: now,
      metadata: { ...meta, telegram_history: updatedHistory },
    })
    .eq('id', driverId)

  if (error) {
    console.error(`[DriverBot] recordTgHistory FAILED driver=${driverId} chat=${newChatId}:`, error)
    return false
  }
  return true
}

/** Check if a string looks like a Mongolian phone number (any common format) */
function looksLikePhone(text: string): boolean {
  const digits = text.replace(/\D/g, '')
  // 8 digits (local), 11 digits (976 + 8), 12 digits (+976 + 8)
  return digits.length === 8 || digits.length === 11 || digits.length === 12
}

export async function POST(request: NextRequest) {
  // Verify request is from Telegram (optional secret header)
  const secret = process.env.DRIVER_TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token')
    if (header !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let update: TgUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true }) // Telegram retries on non-200, always return 200
  }

  const supabase = getSupabase()

  // ── Inline button callback ───────────────────────────────────────────────
  if (update.callback_query) {
    await handleCallbackQuery(supabase, update.callback_query)
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  if (!msg?.text && !msg?.contact && !msg?.photo) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id
  const text = msg.text?.trim() ?? ''

  // ── /start command ───────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    // Deep-link: /start <driverId> — auto-link without needing phone number
    const param = text.split(' ')[1]?.trim()
    if (param && param.length > 10) {
      // Looks like a UUID-based driver ID — try to link directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, name, telegram_chat_id')
        .eq('id', param)
        .maybeSingle()

      if (!driver) {
        await tgSend(chatId,
          `❌ Холбоос хүчингүй байна.\n\nДэлгүүрийн менежерээсээ шинэ холбоос авна уу.`
        )
        return NextResponse.json({ ok: true })
      }

      // Link this Telegram chat to the driver (record full history)
      const linked = await recordTgHistory(supabase, driver.id, chatId, msg.from ?? { id: chatId })

      if (!linked) {
        await tgSend(chatId, '❌ Холбоход алдаа гарлаа. Дахин оролдоно уу.')
        return NextResponse.json({ ok: true })
      }

      await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
      return NextResponse.json({ ok: true })
    }

    // Plain /start with no param → welcome + prompt for phone
    await tgSend(chatId, DRIVER_BOT_WELCOME)
    return NextResponse.json({ ok: true })
  }

  // ── /help command ───────────────────────────────────────────────────────
  if (text === '/help') {
    await tgSend(chatId,
      `🚚 <b>Жолоочийн бот — тушаалууд</b>\n\n` +
      `/orders — Миний идэвхтэй захиалгууд\n` +
      `/unlink — Энэ аккаунтаас салгах\n` +
      `/help — Тушаалын жагсаалт\n\n` +
      `<b>Статус шинэчлэх:</b>\n` +
      `Товч дарах замаар шинэчилнэ үү (товч тогтоогүй бол доорхийг бичнэ үү):\n` +
      `• "Авлаа" — бараа авсан\n` +
      `• "Хүргэлээ" — хүргэлт дууссан\n` +
      `• "Дэлгүүрт ирлээ" — дэлгүүрт очсон\n` +
      `• "Холбогдохгүй байна" — хэрэглэгч утас аваагүй\n\n` +
      `📸 <b>Хүргэлтийн зургийг илгээвэл автоматаар бүртгэгдэнэ.</b>`
    )
    return NextResponse.json({ ok: true })
  }

  // ── /unlink command ──────────────────────────────────────────────────────
  if (text === '/unlink') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: unlinkDriver } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (!unlinkDriver) {
      await tgSend(chatId, `❓ Энэ аккаунт ямар ч жолоочтой холбогдоогүй байна.`)
      return NextResponse.json({ ok: true })
    }

    // Clear telegram_chat_id — history stays intact
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('delivery_drivers')
      .update({ telegram_chat_id: null, telegram_linked_at: null })
      .eq('id', unlinkDriver.id)

    await tgSend(chatId,
      `✅ <b>${unlinkDriver.name}</b> — амжилттай салгалаа.\n\n` +
      `Дахин холбогдохын тулд утасны дугаараа илгээнэ үү.`
    )
    return NextResponse.json({ ok: true })
  }

  // ── /orders command ──────────────────────────────────────────────────────
  if (text === '/orders') {
    // Look up the driver by Telegram chat ID first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ordersDriver } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (!ordersDriver) {
      await tgSend(chatId, `❓ Таны акаунт холбогдоогүй байна.\nУтасны дугаараа илгээнэ үү.`)
      return NextResponse.json({ ok: true })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deliveries } = await (supabase as any)
      .from('deliveries')
      .select(`
        id, status, delivery_type, created_at,
        orders!inner(order_number, shipping_address, total_amount),
        customers(name, phone)
      `)
      .eq('driver_id', ordersDriver.id)
      .in('status', ['assigned', 'at_store', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: true })
      .limit(10)

    if (!deliveries || deliveries.length === 0) {
      await tgSend(chatId, `📭 Одоогоор хуваарилагдсан захиалга байхгүй байна.`)
      return NextResponse.json({ ok: true })
    }

    const STATUS_LABEL: Record<string, string> = {
      assigned: '🟡 Хуваарилагдсан',
      at_store: '🏪 Дэлгүүрт хүлээж байна',
      picked_up: '📦 Авсан — хүргэж байна',
      in_transit: '🚚 Замд яваа',
      delayed: '⏰ Хоцорсон',
    }

    // Send a header first
    await tgSend(chatId, `🚚 <b>Таны захиалгууд (${deliveries.length})</b>\nДоорх захиалга тус бүрд шаардлагатай үйлдлийг сонгоно уу:`)

    // Send each delivery as a separate card with action buttons
    for (const d of deliveries as {
      id: string; status: string; delivery_type: string
      delivery_number?: string; customer_name?: string; customer_phone?: string; delivery_address?: string
      orders: { order_number: string; shipping_address: string; total_amount: number } | null
    }[]) {
      const statusLabel = STATUS_LABEL[d.status] ?? d.status
      const orderNum = d.delivery_number ?? d.orders?.order_number ?? d.id.slice(0, 8)
      const address = d.delivery_address ?? d.orders?.shipping_address ?? '—'
      const customer = d.customer_name ?? '—'
      const phone = d.customer_phone ?? ''
      const tag = d.delivery_type === 'intercity_post' ? ' 🚌' : ''

      const cardText =
        `📋 <b>${orderNum}${tag}</b> — ${statusLabel}\n` +
        `👤 ${customer}${phone ? ` · <code>${phone}</code>` : ''}\n` +
        `📍 ${address.slice(0, 80)}${address.length > 80 ? '…' : ''}`

      // Choose keyboard based on current status
      let keyboard: TgInlineKeyboard | undefined
      if (d.status === 'assigned' || d.status === 'at_store') {
        keyboard = orderAssignedKeyboard(d.id)
      } else if (['picked_up', 'in_transit', 'delayed'].includes(d.status)) {
        keyboard = enRouteKeyboard(d.id)
      }

      await tgSend(chatId, cardText, keyboard ? { replyMarkup: keyboard } : undefined)
    }

    return NextResponse.json({ ok: true })
  }

  // ── /find command — search delivery by number (Feature 4) ───────────────────
  if (text.startsWith('/find')) {
    // Parse the search query: /find ORD-12345 or /find 12345 or /find ORD12345
    const searchQuery = text.replace(/^\/find\s*/i, '').trim()

    if (!searchQuery) {
      await tgSend(chatId, `❓ <b>Хүргэлтийн дугаар оруулна уу.</b>\n\nЖишээ:\n• /find ORD-12345\n• /find 12345`)
      return NextResponse.json({ ok: true })
    }

    // Look up driver first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: findDriver } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (!findDriver) {
      await tgSend(chatId, `❓ Таны акаунт холбогдоогүй байна.\nУтасны дугаараа илгээнэ үү.`)
      return NextResponse.json({ ok: true })
    }

    // Normalize search: strip "ORD-" prefix, spaces
    const normalizedSearch = searchQuery.replace(/^ORD-?/i, '').replace(/\s/g, '')

    // Search deliveries by number (must belong to this driver)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: foundDeliveries } = await (supabase as any)
      .from('deliveries')
      .select(`
        id, delivery_number, status, delivery_address, customer_name, customer_phone,
        delivery_fee, order_id,
        orders(order_number, total_amount, order_items(quantity, products(name)))
      `)
      .eq('driver_id', findDriver.id)
      .ilike('delivery_number', `%${normalizedSearch}%`)
      .limit(3)

    if (!foundDeliveries || foundDeliveries.length === 0) {
      await tgSend(chatId, `❌ <b>Хүргэлт олдсонгүй:</b> "${searchQuery}"\n\nДугаараа шалгаж дахин оролдоно уу.`)
      return NextResponse.json({ ok: true })
    }

    const FIND_STATUS_LABEL: Record<string, string> = {
      pending: '⏳ Хүлээгдэж буй',
      assigned: '🟡 Оноосон',
      at_store: '🏪 Дэлгүүрт',
      picked_up: '📦 Авсан',
      in_transit: '🚚 Замд',
      delivered: '✅ Хүргэсэн',
      failed: '❌ Амжилтгүй',
      cancelled: '🚫 Цуцлагдсан',
      delayed: '⚠️ Хоцорсон',
    }

    // Send each found delivery as a card
    for (const del of foundDeliveries as {
      id: string
      delivery_number: string
      status: string
      delivery_address: string
      customer_name: string | null
      customer_phone: string | null
      delivery_fee: number | null
      order_id: string | null
      orders: { order_number: string; total_amount: number; order_items: { quantity: number; products: { name: string } | null }[] } | null
    }[]) {
      const statusLabel = FIND_STATUS_LABEL[del.status] || del.status

      // Build product list
      let productList = ''
      if (del.orders?.order_items && del.orders.order_items.length > 0) {
        productList = del.orders.order_items
          .map(item => `• ${item.products?.name || 'Бараа'} x${item.quantity}`)
          .join('\n')
      }

      const totalAmount = del.orders?.total_amount || 0
      const deliveryFee = del.delivery_fee || 0
      const grandTotal = totalAmount + deliveryFee

      const cardText =
        `📦 <b>#${del.delivery_number}</b> — ${statusLabel}\n\n` +
        `👤 ${del.customer_name || '—'} | 📞 ${del.customer_phone ? `<code>${del.customer_phone}</code>` : '—'}\n` +
        `📍 ${del.delivery_address || '—'}\n` +
        (productList ? `\n🛍️ <b>Бараа:</b>\n${productList}\n` : '') +
        `\n💰 Нийт: ${new Intl.NumberFormat('mn-MN').format(grandTotal)}₮` +
        (deliveryFee > 0 ? ` (+${new Intl.NumberFormat('mn-MN').format(deliveryFee)}₮ хүргэлт)` : '')

      // Choose keyboard based on status
      let keyboard: TgInlineKeyboard | undefined
      if (del.status === 'assigned' || del.status === 'at_store') {
        keyboard = orderAssignedKeyboard(del.id)
      } else if (['picked_up', 'in_transit', 'delayed'].includes(del.status)) {
        keyboard = enRouteKeyboard(del.id)
      }

      await tgSend(chatId, cardText, keyboard ? { replyMarkup: keyboard } : undefined)
    }

    return NextResponse.json({ ok: true })
  }

  // ── Early driver lookup — needed to protect wizard from phone-linking handler ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: earlyDriver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, metadata')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  const earlyMeta = earlyDriver?.metadata as Record<string, unknown> | null
  const earlyWizard = earlyMeta?.intercity_wizard as IntercityWizard | undefined
  const hasActiveWizard = !!earlyWizard

  // ── Custom delay time input ───────────────────────────────────────────────
  // Driver typed a custom delivery time after clicking "✏️ Өөр цаг оруулах"
  const awaitingDelayDeliveryId = earlyMeta?.awaiting_delay_time as string | undefined
  const awaitingDelayMsgId = earlyMeta?.awaiting_delay_message_id as number | null | undefined
  if (awaitingDelayDeliveryId && text && !text.startsWith('/')) {
    // Save the custom ETA text as a note + mark delayed (separate update from select)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('deliveries')
      .update({ status: 'delayed', notes: `Хоцрох: ${text}` })
      .eq('id', awaitingDelayDeliveryId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customDelDel } = await (supabase as any)
      .from('deliveries')
      .select('delivery_number, store_id, order_id')
      .eq('id', awaitingDelayDeliveryId)
      .single()

    // Clear the awaiting flags
    const clearedMeta = { ...earlyMeta }
    delete clearedMeta.awaiting_delay_time
    delete clearedMeta.awaiting_delay_message_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

    const customDelayHeader = await getDeliveryHeader(supabase, awaitingDelayDeliveryId)
    if (awaitingDelayMsgId) {
      await tgEdit(chatId, awaitingDelayMsgId,
        `${customDelayHeader}⏰ <b>ХОЙШЛУУЛСАН</b>\n📅 Шинэ хугацаа: "${text}"`,
        { replyMarkup: enRouteKeyboard(awaitingDelayDeliveryId) }
      )
    } else {
      await tgSend(chatId,
        `⏰ <b>Бүртгэгдлээ.</b>\n\n📅 Шинэ хугацаа: "${text}"\nДэлгүүрт мэдэгдлээ.`,
        { replyMarkup: enRouteKeyboard(awaitingDelayDeliveryId) }
      )
    }
    if (customDelDel) {
      // Dashboard notification
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: customDelDel.store_id, type: 'delivery_delayed',
        title: '⏰ Хүргэлт хоцорлоо',
        body: `${earlyDriver?.name ?? 'Жолооч'} — #${customDelDel.delivery_number}: "${text}" хүргэнэ.`,
        metadata: { delivery_id: awaitingDelayDeliveryId, eta_text: text },
      }).then(null, () => {})

      // Update order notes
      if (customDelDel.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ notes: `⏰ Хойшлуулсан: ${text}` })
          .eq('id', customDelDel.order_id)
      }

      // Telegram notification to staff + members
      const delayBotToken = process.env.TELEGRAM_BOT_TOKEN
      if (delayBotToken) {
        const delayTgMsg =
          `⏰ <b>ХҮРГЭЛТ ХОЙШЛУУЛСАН</b>\n\n` +
          `🆔 #${customDelDel.delivery_number}\n` +
          `🚚 Жолооч: ${earlyDriver?.name ?? '—'}\n` +
          `📅 Шинэ хугацаа: "${text}"\n`
        const delayChatIds = await getStaffMemberChatIds(supabase, customDelDel.store_id)
        for (const cid of delayChatIds) {
          await fetch(`https://api.telegram.org/bot${delayBotToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: cid, text: delayTgMsg, parse_mode: 'HTML' }),
          }).catch(() => {})
        }
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── Custom deny reason input (batch flow) ────────────────────────────────────
  // Driver typed a custom reason after selecting "✏️ Бусад шалтгаан"
  const awaitingDenyReason = earlyMeta?.awaiting_deny_reason as { deliveryId: string } | undefined
  if (awaitingDenyReason && text && !text.startsWith('/')) {
    const drId = awaitingDenyReason.deliveryId

    // Clear the awaiting flag
    const clearedM = { ...earlyMeta }
    delete clearedM.awaiting_deny_reason
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('delivery_drivers').update({ metadata: clearedM }).eq('telegram_chat_id', chatId)

    // Update delivery to pending, clear driver, record denial_info with custom reason
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deniedDelCustom } = await (supabase as any)
      .from('deliveries')
      .update({
        status: 'pending',
        driver_id: null,
        denial_info: {
          driver_id: earlyDriver?.id,
          driver_name: earlyDriver?.name ?? 'Жолооч',
          reason: 'other',
          reason_label: `Бусад: ${text}`,
          denied_at: new Date().toISOString(),
        },
      })
      .eq('id', drId)
      .select('delivery_number, store_id')
      .single()

    // Notify store
    if (deniedDelCustom?.store_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: deniedDelCustom.store_id,
        type: 'delivery_denied',
        title: '❌ Жолооч татгалзлаа',
        body: `${earlyDriver?.name ?? 'Жолооч'} #${deniedDelCustom.delivery_number} татгалзлаа: ${text}`,
        metadata: { delivery_id: drId },
      }).then(null, () => {})
    }

    await tgSend(chatId, `↩️ Татгалзлаа. Менежерт мэдэгдлээ.`)
    return NextResponse.json({ ok: true })
  }

  // ── Custom payment amount input ─────────────────────────────────────────────
  // Driver is entering a custom payment amount or reason
  const awaitingCustomPayment = earlyMeta?.awaiting_custom_payment as { deliveryId: string; step: 'amount' | 'reason'; amount?: number; messageId?: number | null } | undefined
  if (awaitingCustomPayment && text && !text.startsWith('/')) {
    const custMsgId = awaitingCustomPayment.messageId ?? null
    if (awaitingCustomPayment.step === 'amount') {
      // Parse the amount from text
      const amount = parseInt(text.replace(/[^\d]/g, ''), 10)
      if (isNaN(amount) || amount <= 0) {
        await tgSend(chatId, `❌ Зөв тоо оруулна уу (жишээ: 25000)`)
        return NextResponse.json({ ok: true })
      }

      // Update awaiting state to ask for reason
      const updatedMeta = {
        ...earlyMeta,
        awaiting_custom_payment: { ...awaitingCustomPayment, step: 'reason', amount },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: updatedMeta }).eq('telegram_chat_id', chatId)

      const custPayHdr = await getDeliveryHeader(supabase, awaitingCustomPayment.deliveryId)
      if (custMsgId) {
        await tgEdit(chatId, custMsgId, `${custPayHdr}💰 Дүн: <b>${new Intl.NumberFormat('mn-MN').format(amount)}₮</b>\n\n📝 <b>Шалтгааныг тайлбарлана уу:</b>`, { replyMarkup: { inline_keyboard: [] } })
      } else {
        await tgSend(chatId, `💰 Дүн: <b>${new Intl.NumberFormat('mn-MN').format(amount)}₮</b>\n\n📝 <b>Шалтгааныг тайлбарлана уу:</b>`)
      }
      return NextResponse.json({ ok: true })
    }

    if (awaitingCustomPayment.step === 'reason') {
      const reason = text
      const amount = awaitingCustomPayment.amount || 0
      const delId = awaitingCustomPayment.deliveryId

      // Mark delivery as delivered with custom payment info
      // Note: .update().select().single() chain fails silently with non-standard key — separate the calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          metadata: { custom_payment: { amount, reason, recorded_at: new Date().toISOString() } },
        })
        .eq('id', delId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customPayDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_number, store_id, customer_name, customer_phone, delivery_address')
        .eq('id', delId)
        .single()
      console.log('[DriverBot] Custom payment delivery update:', { delId, customPayDelivery: !!customPayDelivery })

      // Mark order as partially paid — fetch order_id from delivery independently
      let customPayOrderTotal = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cpDelOrder } = await (supabase as any).from('deliveries').select('order_id').eq('id', delId).single()
      const cpOrderId = customPayDelivery?.order_id || cpDelOrder?.order_id
      if (cpOrderId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cpOrder } = await (supabase as any).from('orders').select('total_amount').eq('id', cpOrderId).single()
        customPayOrderTotal = cpOrder?.total_amount || 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'partial', notes: `Жолооч: ${amount}₮ авсан. Шалтгаан: ${reason}` })
          .eq('id', cpOrderId)
      }

      // Clear the awaiting flag
      const clearedMeta = { ...earlyMeta }
      delete clearedMeta.awaiting_custom_payment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

      const formattedAmount = new Intl.NumberFormat('mn-MN').format(amount)
      const custReasonHdr = await getDeliveryHeader(supabase, delId)
      if (custMsgId) {
        await tgEdit(chatId, custMsgId, `${custReasonHdr}💸 <b>ДУТУУ ТӨЛБӨР</b>\n${formattedAmount}₮ авсан\n📝 Шалтгаан: ${reason}`, { replyMarkup: { inline_keyboard: [] } })
      } else {
        await tgSend(chatId, `✅ <b>Бүртгэгдлээ.</b>\n\n💸 ${formattedAmount}₮ авсан\n📝 Шалтгаан: ${reason}\n\nБаярлалаа!`)
      }

      const cpDelInfo = customPayDelivery
      console.log('[DriverBot] Custom payment notify check:', { delId, hasData: !!cpDelInfo, storeId: cpDelInfo?.store_id })

      // Notify store (dashboard + Telegram)
      if (cpDelInfo?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: cpDelInfo.store_id,
          type: 'delivery_completed',
          title: `💸 Дутуу төлбөр`,
          body: `#${cpDelInfo.delivery_number} хүргэгдэж, ${formattedAmount}₮ авлаа. Шалтгаан: ${reason}`,
          metadata: { delivery_id: delId, amount, reason },
        }).then(null, () => {})

        // Send directly to store staff + members via Telegram
        const fmtTotal = new Intl.NumberFormat('mn-MN').format(customPayOrderTotal)
        const fmtDiff = new Intl.NumberFormat('mn-MN').format(customPayOrderTotal - amount)
        const storeBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (storeBotToken) {
          const cpStoreMsg =
            `💸 <b>ДУТУУ ТӨЛБӨР</b>\n\n` +
            `🆔 Хүргэлт: #${cpDelInfo.delivery_number}\n` +
            `👤 Хүлээн авагч: ${cpDelInfo.customer_name || '—'}` +
            (cpDelInfo.customer_phone ? ` · <code>${cpDelInfo.customer_phone}</code>` : '') + `\n` +
            `📍 Хаяг: ${cpDelInfo.delivery_address || '—'}\n\n` +
            `💰 Захиалгын дүн: ${fmtTotal}₮\n` +
            `✅ Авсан: ${formattedAmount}₮\n` +
            `❌ Дутуу: ${fmtDiff}₮\n\n` +
            `📝 Шалтгаан: ${reason}\n\n` +
            `⚠️ Харилцагчтай холбогдож үлдсэн төлбөрийг авна уу.`

          const cpChatIds = await getStaffMemberChatIds(supabase, cpDelInfo.store_id)
          console.log('[DriverBot] Partial payment TG notify:', { storeId: cpDelInfo.store_id, chatIds: cpChatIds })
          for (const sChatId of cpChatIds) {
            const tgRes = await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: sChatId, text: cpStoreMsg, parse_mode: 'HTML' }),
            }).catch((e) => { console.error('[DriverBot] TG send failed:', e); return null })
            if (tgRes) {
              const tgJson = await tgRes.json().catch(() => null)
              console.log('[DriverBot] TG send result:', { chatId: sChatId, ok: tgJson?.ok, error: tgJson?.description })
            }
          }
        }
      }

      // Initiate AI agent to contact customer about partial payment
      const agentOrderId = cpDelInfo?.order_id || cpOrderId
      if (agentOrderId && cpDelInfo?.store_id) {
        try {
          await initiatePartialPaymentResolution({
            deliveryId: delId,
            orderId: agentOrderId,
            storeId: cpDelInfo.store_id,
            paidAmount: amount,
            driverReason: reason,
            customerName: cpDelInfo.customer_name,
            customerPhone: cpDelInfo.customer_phone,
          })
        } catch (err) {
          console.error('[DriverBot] Partial payment agent error:', err)
        }
      }

      return NextResponse.json({ ok: true })
    }
  }

  // ── Customer refusal reason input (Feature 7) ───────────────────────────────
  // Driver is entering the reason why customer refused the delivery
  const awaitingRefusalReason = earlyMeta?.awaiting_refusal_reason as { deliveryId: string; messageId?: number | null } | undefined
  if (awaitingRefusalReason && text && !text.startsWith('/')) {
    const reason = text
    const delId = awaitingRefusalReason.deliveryId
    const refusalMsgId = awaitingRefusalReason.messageId ?? null

    // Clear the awaiting flag first
    const clearedMeta = { ...earlyMeta }
    delete clearedMeta.awaiting_refusal_reason
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

    // Fetch delivery info for notifications
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: refusedDelivery } = await (supabase as any)
      .from('deliveries')
      .update({
        status: 'failed',
        metadata: { refusal_reason: reason, customer_refused: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', delId)
      .select('id, order_id, delivery_number, store_id')
      .single()

    // Update order status to cancelled
    let orderNumber = ''
    let customerId = ''
    if (refusedDelivery?.order_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orderData } = await (supabase as any)
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `Харилцагч хүлээж аваагүй: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', refusedDelivery.order_id)
        .select('order_number, customer_id')
        .single()

      orderNumber = orderData?.order_number || ''
      customerId = orderData?.customer_id || ''
    }

    // Notify store
    if (refusedDelivery?.store_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: refusedDelivery.store_id,
        type: 'delivery_failed',
        title: `🚫 Харилцагч татгалзлаа`,
        body: `#${refusedDelivery.delivery_number} — харилцагч авахаас татгалзлаа. Шалтгаан: ${reason}`,
        metadata: { delivery_id: delId, reason, customer_refused: true },
      }).then(null, () => {})
    }

    // Send AI follow-up message to customer conversation
    if (customerId && refusedDelivery?.store_id) {
      try {
        // Find the most recent conversation for this customer + store
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: conversation } = await (supabase as any)
          .from('conversations')
          .select('id')
          .eq('customer_id', customerId)
          .eq('store_id', refusedDelivery.store_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (conversation) {
          const orderRef = orderNumber ? `#${orderNumber}` : `#${refusedDelivery.delivery_number}`
          const followUpMsg =
            `Таны ${orderRef} захиалга хүргэгдэх гэсэн боловч хүлээж аваагүй байна. ` +
            `Шалтгаан: ${reason}. ` +
            `Дахин хүргүүлэх үү? Хэрэв тийм бол бид удахгүй хүргэлтийг дахин зохион байгуулна.`

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('messages').insert({
            conversation_id: conversation.id,
            content: followUpMsg,
            is_from_customer: false,
            is_ai_response: true, // Mark as AI to trigger follow-up flow
            metadata: { type: 'customer_refusal_followup', delivery_id: delId, reason },
          })

          // Also mark delivery metadata for tracking
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('deliveries').update({
            metadata: { refusal_reason: reason, customer_refused: true, customer_refusal_followup: true },
          }).eq('id', delId)
        }
      } catch (followUpErr) {
        console.error('[DriverBot] Customer refusal follow-up failed:', followUpErr)
      }
    }

    const refusalHeader = await getDeliveryHeader(supabase, delId)
    if (refusalMsgId) {
      await tgEdit(chatId, refusalMsgId,
        `${refusalHeader}🚫 <b>АВАХААС ТАТГАЛЗСАН</b>\n📝 Шалтгаан: ${reason}\n\nДэлгүүрт мэдэгдлээ.`,
        { replyMarkup: { inline_keyboard: [] } }
      )
    } else {
      await tgSend(chatId, `✅ <b>Бүртгэгдлээ.</b>\n\nХарилцагчид AI агентаар мэдэгдлээ.`)
    }
    return NextResponse.json({ ok: true })
  }

  // ── Phone number (onboarding) ────────────────────────────────────────────
  // Skip if driver is already linked AND has an active wizard (their text is wizard input)
  if (!hasActiveWizard && (looksLikePhone(text) || msg.contact)) {
    const rawPhone = msg.contact?.phone_number ?? text
    const phone = normalizePhone(rawPhone) // Always 8 digits e.g. "99112233"

    // Look up driver — phones may be stored in any format (8 digits, +976..., 976...)
    // so we match against the last 8 digits using ilike
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: driver, error: lookupError } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name, phone')
      .ilike('phone', `%${phone}`)
      .maybeSingle()

    if (lookupError || !driver) {
      console.log(`[DriverBot] NOT FOUND — phone "${phone}" not in DB`)
      await tgSend(chatId, DRIVER_BOT_NOT_FOUND)
      return NextResponse.json({ ok: true })
    }

    // Save chat_id with full history
    const linked = await recordTgHistory(supabase, driver.id, chatId, msg.from ?? { id: chatId })

    if (!linked) {
      await tgSend(chatId, '❌ Холбоход алдаа гарлаа. Дахин оролдоно уу.')
      return NextResponse.json({ ok: true })
    }

    await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
    return NextResponse.json({ ok: true })
  }

  // ── Natural language from authenticated driver ───────────────────────────
  // Reuse earlyDriver from above (already fetched by chatId)
  const driver = earlyDriver as { id: string; name?: string; metadata?: unknown } | null

  if (!driver) {
    // Unknown sender — prompt to link first
    await tgSend(
      chatId,
      `❓ Таны акаунт холбогдоогүй байна.\n\nУтасны дугаараа илгээнэ үү (жишээ: 99112233).`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Intercity wizard text-input handler ─────────────────────────────────
  // Reuse earlyMeta / earlyWizard from above
  const driverMetadata = earlyMeta
  const activeWizard = earlyWizard

  if (activeWizard) {
    const wiz = activeWizard

    switch (wiz.step) {
      case 'phone': {
        // Driver sent phone number for the bus/private driver
        const updatedWiz: IntercityWizard = { ...wiz, step: 'license', phone: text }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({
          metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
        }).eq('id', driver.id)

        await tgSend(chatId,
          `📞 Утас: <b>${text}</b> ✅\n\n🚗 <b>Машины дугаар</b> оруулна уу:\n(жишээ: 1234 УНА)`
        )
        return NextResponse.json({ ok: true })
      }

      case 'license': {
        // Driver sent the license plate
        const updatedWiz: IntercityWizard = { ...wiz, step: 'eta', license: text }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({
          metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
        }).eq('id', driver.id)

        await tgSend(chatId,
          `🚗 Дугаар: <b>${text}</b> ✅\n\n⏰ <b>Ойролцоо ирэх хугацаа</b> оруулна уу:\n(жишээ: Маргааш 14:00, Ням гарагт 18:00)`
        )
        return NextResponse.json({ ok: true })
      }

      case 'eta': {
        // Driver sent estimated arrival time → ask about payment
        const updatedWiz: IntercityWizard = { ...wiz, step: 'payment', eta: text }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({
          metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
        }).eq('id', driver.id)

        await tgSend(chatId,
          `⏰ Хугацаа: <b>${text}</b> ✅\n\n` +
          `💳 <b>Барааны төлбөр урьдчилж авсан уу?</b>`,
          { replyMarkup: intercityPaymentKeyboard(wiz.delivery_id) }
        )
        return NextResponse.json({ ok: true })
      }

      case 'payment': {
        // They sent text instead of pressing a button on the payment step
        await tgSend(chatId, `⬆️ Дээрх товчийг дарна уу: ✅ Тийм, авсан эсвэл ❌ Аваагүй / Дараа`)
        return NextResponse.json({ ok: true })
      }

      case 'confirm': {
        // They sent text instead of pressing a button — remind
        await tgSend(chatId,
          `⬆️ Дээрх товчийг дарна уу: ✅ Тийм, илгээ эсвэл 🔄 Дахин оруулах`
        )
        return NextResponse.json({ ok: true })
      }

      default:
        break // transport_type step — they should press button, not type
    }
  }

  // ── Wrong item photo ────────────────────────────────────────────────────
  // If driver was asked to send a wrong-item photo, handle it first.
  const driverMeta = ((driver as Record<string, unknown>).metadata ?? {}) as Record<string, unknown>
  if (msg.photo && msg.photo.length > 0 && driverMeta.awaiting_wrong_photo) {
    const wrongDeliveryId = driverMeta.awaiting_wrong_photo as string
    const fileId = msg.photo[msg.photo.length - 1].file_id as string

    // Clear awaiting state
    const { awaiting_wrong_photo: _, ...cleanMeta } = driverMeta
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('delivery_drivers')
      .update({ metadata: cleanMeta })
      .eq('id', driver.id)

    // Download photo from Telegram and upload to Supabase Storage
    let wrongPhotoUrl = ''
    let wrongPhotoBlob: Blob | null = null
    try {
      const driverBotToken = process.env.DRIVER_TELEGRAM_BOT_TOKEN
      if (driverBotToken) {
        const getFileRes = await fetch(`https://api.telegram.org/bot${driverBotToken}/getFile?file_id=${encodeURIComponent(fileId)}`)
        const getFileData = await getFileRes.json() as { ok: boolean; result?: { file_path: string } }
        if (getFileData.ok && getFileData.result?.file_path) {
          const photoUrl = `https://api.telegram.org/file/bot${driverBotToken}/${getFileData.result.file_path}`
          const photoRes = await fetch(photoUrl)
          const arrayBuf = await photoRes.arrayBuffer()
          const photoBuf = Buffer.from(arrayBuf)
          wrongPhotoBlob = new Blob([photoBuf])
          const ext = getFileData.result.file_path.split('.').pop() || 'jpg'
          const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
          const storagePath = `${wrongDeliveryId}/wrong_item_${Date.now()}.${ext}`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: uploadErr } = await (supabase as any).storage
            .from('delivery-proofs')
            .upload(storagePath, photoBuf, { contentType, upsert: true })
          if (uploadErr) {
            console.error('[DriverBot] Wrong item photo upload error:', uploadErr)
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: urlData } = (supabase as any).storage.from('delivery-proofs').getPublicUrl(storagePath)
            wrongPhotoUrl = urlData?.publicUrl || ''
            console.log('[DriverBot] Wrong item photo uploaded:', wrongPhotoUrl)
          }
        } else {
          console.error('[DriverBot] getFile failed:', JSON.stringify(getFileData))
        }
      } else {
        console.error('[DriverBot] DRIVER_TELEGRAM_BOT_TOKEN not set')
      }
    } catch (photoErr) {
      console.error('[DriverBot] Wrong item photo upload error:', photoErr)
    }

    // Save wrong photo URL to delivery metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: wpDel } = await (supabase as any)
      .from('deliveries')
      .update({
        notes: 'Буруу бараа — зураг илгээсэн',
        metadata: { awaiting_wrong_photo: false, wrong_item_photo_url: wrongPhotoUrl, wrong_item_photo_file_id: fileId },
      })
      .eq('id', wrongDeliveryId)
      .select('delivery_number, store_id, order_id, customer_name, customer_phone, delivery_address')
      .single()

    await tgSend(chatId, `📸 Зураг хүлээн авлаа. Дэлгүүрт мэдэгдлээ.\nБарааг агуулахад буцааж өгнө үү.`, {
      replyMarkup: {
        inline_keyboard: [
          [{ text: '📦 Агуулахад буцааж өгсөн', callback_data: `wrong_returned:${wrongDeliveryId}` }],
        ],
      },
    })

    if (wpDel) {
      // Fetch order items
      let orderItemsText = ''
      let customerId = ''
      if (wpDel.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orderData } = await (supabase as any)
          .from('orders')
          .select('order_number, customer_id, order_items(quantity, unit_price, variant_label, products(name), product_variants(size, color))')
          .eq('id', wpDel.order_id)
          .single()

        customerId = orderData?.customer_id || ''
        if (orderData?.order_items) {
          orderItemsText = (orderData.order_items as Array<{
            quantity: number; unit_price: number; variant_label: string | null
            products: { name: string } | null
            product_variants: { size: string | null; color: string | null } | null
          }>).map((item) => {
            const name = item.products?.name || 'Бараа'
            const parts = [name]
            if (item.product_variants?.size) parts.push(`Размер: ${item.product_variants.size}`)
            if (item.product_variants?.color) parts.push(`Өнгө: ${item.product_variants.color}`)
            if (item.variant_label) parts.push(item.variant_label)
            return `• ${parts.join(' / ')} x${item.quantity}`
          }).join('\n')
        }
      }

      // Send customer confirmation
      if (customerId && wpDel.store_id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: conversation } = await (supabase as any)
            .from('conversations')
            .select('id')
            .eq('customer_id', customerId)
            .eq('store_id', wpDel.store_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (conversation) {
            const confirmMsg =
              `Уучлаарай, таны захиалгад асуудал гарсан байна.\n\n` +
              `📦 Таны захиалсан бараа:\n${orderItemsText || '(мэдээлэл олдсонгүй)'}\n\n` +
              `Та дээрх захиалга зөв эсэхийг баталгаажуулна уу. Бид дэлгүүрт мэдэгдэж, зөв барааг дахин хүргүүлнэ.`
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('messages').insert({
              conversation_id: conversation.id,
              content: confirmMsg,
              is_from_customer: false,
              is_ai_response: true,
              metadata: { type: 'wrong_product_confirmation', delivery_id: wrongDeliveryId },
            })
          }
        } catch (customerMsgErr) {
          console.error('[DriverBot] Wrong product customer message failed:', customerMsgErr)
        }
      }

      // Build staff notification message
      const storeMsg =
        `📦 <b>БУРУУ БАРАА МЭДЭГДЭЛ</b>\n\n` +
        `🆔 Хүргэлт: #${wpDel.delivery_number}\n` +
        `👤 Хүлээн авагч: ${wpDel.customer_name || '—'}\n` +
        `📞 Утас: ${wpDel.customer_phone || '—'}\n` +
        `📍 Хаяг: ${wpDel.delivery_address || '—'}\n\n` +
        `🛒 <b>Захиалсан бараа:</b>\n${orderItemsText || '(мэдээлэл олдсонгүй)'}\n\n` +
        `⚠️ Жолооч буруу бараа мэдэгдэж, зураг илгээсэн.\n` +
        `Барааг шалгаж, зөв барааг бэлдэнэ үү.`

      const storeKeyboard = {
        inline_keyboard: [
          [{ text: '✅ Зөв бараа бэлдлээ — дахин хүргэх', callback_data: `wrong_product_resend:${wrongDeliveryId}` }],
          [{ text: '❌ Илгээсэн бараа зөв байсан', callback_data: `wrong_product_correct:${wrongDeliveryId}` }],
        ],
      }

      const storeBotToken = process.env.TELEGRAM_BOT_TOKEN

      // Collect all chat IDs to notify: staff + store_members
      const allChatIds: string[] = []

      // Legacy staff table
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: storeStaff } = await (supabase as any)
        .from('staff')
        .select('telegram_chat_id')
        .eq('store_id', wpDel.store_id)
        .not('telegram_chat_id', 'is', null)

      for (const s of (storeStaff || []) as Array<{ telegram_chat_id: string }>) {
        if (s.telegram_chat_id && !allChatIds.includes(s.telegram_chat_id)) allChatIds.push(s.telegram_chat_id)
      }

      // New store_members table (owners, admins, staff with Telegram)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: storeMembers } = await (supabase as any)
        .from('store_members')
        .select('telegram_chat_id, notification_preferences')
        .eq('store_id', wpDel.store_id)
        .not('telegram_chat_id', 'is', null)

      for (const m of (storeMembers || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
        // Check if member wants delivery notifications (default: true)
        const prefs = m.notification_preferences || {}
        const wantsDelivery = prefs.delivery !== false
        if (m.telegram_chat_id && wantsDelivery && !allChatIds.includes(m.telegram_chat_id)) {
          allChatIds.push(m.telegram_chat_id)
        }
      }

      // Send photo + message to all staff/members via store bot
      if (storeBotToken && allChatIds.length > 0) {
        for (const sChatId of allChatIds) {
          try {
            // Send wrong item photo first via multipart upload
            if (wrongPhotoBlob) {
              const formData = new FormData()
              formData.append('chat_id', sChatId)
              formData.append('photo', wrongPhotoBlob, 'wrong_item.jpg')
              formData.append('caption', `📦 Буруу бараа — #${wpDel.delivery_number}\n📸 Жолоочийн илгээсэн зураг`)
              formData.append('parse_mode', 'HTML')
              await fetch(`https://api.telegram.org/bot${storeBotToken}/sendPhoto`, {
                method: 'POST',
                body: formData,
              })
            }
            // Then send details with action buttons
            await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: sChatId,
                text: storeMsg,
                parse_mode: 'HTML',
                reply_markup: storeKeyboard,
              }),
            })
          } catch (tgErr) {
            console.error(`[DriverBot] Staff TG notify failed for ${sChatId}:`, tgErr)
          }
        }
      }

      // Dashboard notification
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: wpDel.store_id, type: 'delivery_failed',
        title: '📦 Буруу бараа',
        body: `${(driver as Record<string, unknown>).name} — #${wpDel.delivery_number}: буруу бараа. Зураг илгээсэн.`,
        metadata: {
          delivery_id: wrongDeliveryId, reason: 'wrong_product',
          wrong_item_photo_url: wrongPhotoUrl,
          order_items: orderItemsText,
        },
      }).then(null, () => {})
    }

    return NextResponse.json({ ok: true })
  }

  // ── Photo proof ─────────────────────────────────────────────────────────
  // Driver sends a photo → store as delivery confirmation.
  // If delivery is in picked_up / in_transit state, auto-mark as delivered.
  if (msg.photo && msg.photo.length > 0) {
    // Largest photo is the last element
    const fileId = msg.photo[msg.photo.length - 1].file_id as string

    // Find most recent active delivery for this driver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeDelivery } = await (supabase as any)
      .from('deliveries')
      .select('id, status, metadata, order_id, orders!inner(order_number, store_id)')
      .eq('driver_id', driver.id)
      .in('status', ['assigned', 'at_store', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeDelivery) {
      await tgSend(chatId,
        `📸 Зураг хүлээн авлаа, гэхдээ идэвхтэй хүргэлт олдсонгүй.\n` +
        `Хэрэв хүргэлт дууссан бол товч дарах эсвэл "Хүргэлээ" гэж бичнэ үү.`
      )
      return NextResponse.json({ ok: true })
    }

    const existingMeta = (activeDelivery.metadata ?? {}) as Record<string, unknown>
    const orderNum = activeDelivery.orders?.order_number ?? activeDelivery.id.slice(0, 8)
    const storeId = activeDelivery.orders?.store_id as string | undefined

    // Save proof photo + timestamp
    const updatedMeta = {
      ...existingMeta,
      proof_photo_file_id: fileId,
      proof_photo_at: new Date().toISOString(),
    }

    // Auto-complete delivery if it was in picked_up or in_transit
    const canComplete = ['picked_up', 'in_transit'].includes(activeDelivery.status)
    const newStatus = canComplete ? 'delivered' : activeDelivery.status

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('deliveries')
      .update({
        status: newStatus,
        metadata: updatedMeta,
        ...(canComplete ? { actual_delivery_time: new Date().toISOString() } : {}),
      })
      .eq('id', activeDelivery.id)

    // If we auto-completed the delivery, also update the order status
    if (canComplete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', activeDelivery.order_id)
        .then(null, () => {}) // non-blocking
    }

    // Write a dashboard notification so the store owner can see the photo
    if (storeId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: storeId,
        type: 'delivery_photo_proof',
        title: `📸 Хүргэлтийн зураг — ${orderNum}`,
        message: canComplete
          ? `Жолооч зураг илгээж хүргэлтийг баталгаажуулав. Захиалга #${orderNum}.`
          : `Жолооч хүргэлтийн зураг илгээв. Захиалга #${orderNum}.`,
        metadata: {
          delivery_id: activeDelivery.id,
          proof_photo_file_id: fileId,
          driver_name: (driver as { id: string; name?: string }).name,
        },
      }).then(null, () => {}) // non-blocking — don't fail if notifications table schema differs
    }

    const confirmMsg = canComplete
      ? `✅ Зураг хүлээн авлаа. Захиалга <b>#${orderNum}</b> хүргэгдсэн гэж бүртгэгдлээ. Баярлалаа! 🙏`
      : `📸 Зураг хүлээн авлаа. Захиалга <b>#${orderNum}</b>-д хадгалагдлаа.`

    await tgSend(chatId, confirmMsg)
    return NextResponse.json({ ok: true })
  }

  // Run through the driver intent engine
  const result = await processDriverMessage(supabase, driver.id, text, chatId)

  // For unknown intents, let the message pass through to the dashboard
  // (store owner can reply manually from /dashboard/driver-chat)
  // No auto-reply needed for unknown — silence is fine.
  console.log(`[DriverBot] ${driver.name}: "${text}" → intent: ${result.intent}`)

  return NextResponse.json({ ok: true })
}
