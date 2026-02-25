/**
 * driver-telegram.ts — Telegram Bot API helpers for driver communication
 *
 * All driver-facing proactive messages (order assigned, cancelled, hold,
 * payment confirmed, return) go through here.
 *
 * Bot token: DRIVER_TELEGRAM_BOT_TOKEN env var
 * Set webhook: POST https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain/api/telegram/driver
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Telegram API
// ---------------------------------------------------------------------------

const TELEGRAM_API = 'https://api.telegram.org'

function botToken(): string {
  const t = process.env.DRIVER_TELEGRAM_BOT_TOKEN
  if (!t) throw new Error('DRIVER_TELEGRAM_BOT_TOKEN not set')
  return t
}

// ---------------------------------------------------------------------------
// Inline keyboard types
// ---------------------------------------------------------------------------

export interface TgInlineButton {
  text: string
  callback_data?: string
  url?: string
}

export interface TgInlineKeyboard {
  inline_keyboard: TgInlineButton[][]
}

// ---------------------------------------------------------------------------
// Inline keyboard builders
// ---------------------------------------------------------------------------

/** Buttons shown when a new order is assigned */
export function orderAssignedKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🏪 Дэлгүүрт ирлээ', callback_data: `arrived_at_store:${deliveryId}` },
        { text: '❌ Татгалзах', callback_data: `reject:${deliveryId}` },
      ],
    ],
  }
}

/** Buttons shown after driver picks up (en-route) */
export function enRouteKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Хүргэлээ', callback_data: `delivered:${deliveryId}` },
        { text: '📵 Утас авсангүй', callback_data: `unreachable:${deliveryId}` },
      ],
      [
        { text: '⏰ Хоцрох', callback_data: `delay:${deliveryId}` },
        { text: '⚠️ Асуудал', callback_data: `issue:${deliveryId}` },
      ],
    ],
  }
}

/** Sub-buttons when driver reports an issue */
export function issueKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '📦 Буруу бараа', callback_data: `wrong_product:${deliveryId}` },
        { text: '💔 Гэмтсэн', callback_data: `damaged:${deliveryId}` },
      ],
      [
        { text: '💰 Мөнгө өгсөнгүй', callback_data: `no_payment:${deliveryId}` },
      ],
    ],
  }
}

/** Buttons shown when an intercity order is assigned to driver */
export function intercityKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🚌 Тээвэрт өгсөн', callback_data: `intercity_start:${deliveryId}` },
        { text: '❌ Татгалзах', callback_data: `reject:${deliveryId}` },
      ],
    ],
  }
}

/** Transport type selection for intercity wizard */
export function intercityTransportKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '🚌 Хотын автобус', callback_data: `intercity_type:bus:${deliveryId}` },
        { text: '🚗 Хувийн жолооч', callback_data: `intercity_type:private:${deliveryId}` },
      ],
    ],
  }
}

/** Confirm / retry buttons shown at the end of the intercity wizard */
export function intercityConfirmKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Тийм, илгээ', callback_data: `intercity_confirm:${deliveryId}` },
        { text: '🔄 Дахин оруулах', callback_data: `intercity_retry:${deliveryId}` },
      ],
    ],
  }
}

/** Payment status buttons shown after inner-city delivery */
export function paymentKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Төлбөр авлаа', callback_data: `payment_received:${deliveryId}` },
        { text: '⏳ Дараа төлнө', callback_data: `payment_pending:${deliveryId}` },
      ],
      [
        { text: '❌ Татгалзав', callback_data: `payment_declined:${deliveryId}` },
      ],
    ],
  }
}

/** Payment confirmation for intercity wizard (was pre-payment collected?) */
export function intercityPaymentKeyboard(deliveryId: string): TgInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Тийм, авсан', callback_data: `intercity_pay_yes:${deliveryId}` },
        { text: '❌ Аваагүй / Дараа', callback_data: `intercity_pay_no:${deliveryId}` },
      ],
    ],
  }
}

// ---------------------------------------------------------------------------
// Intercity wizard state (stored in delivery_drivers.metadata)
// ---------------------------------------------------------------------------

export type IntercityWizardStep = 'transport_type' | 'phone' | 'license' | 'eta' | 'payment' | 'confirm'

export interface IntercityWizard {
  delivery_id: string
  step: IntercityWizardStep
  transport?: 'bus' | 'private'
  phone?: string
  license?: string
  eta?: string
  payment_collected?: boolean  // was prepayment collected before dispatch?
}

// ---------------------------------------------------------------------------
// Intercity customer notification message
// ---------------------------------------------------------------------------

export interface IntercityHandoff {
  transport: 'bus' | 'private'
  phone: string
  license: string
  eta: string
  payment_collected?: boolean
}

export function intercityCustomerMessage(
  orderNumber: string,
  handoff: IntercityHandoff
): string {
  const transportLabel = handoff.transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
  const paymentNote = handoff.payment_collected
    ? `✅ Барааны төлбөр урьдчилж баталгаажсан.\n`
    : `💳 Тээврийн үнэ хүлээн авахдаа шуудангийн газарт/жолоочид төлнө үү.\n`
  return (
    `📦 Таны захиалга хотоор хоорондын тээврээр илгээгдлээ!\n\n` +
    `🆔 Захиалга: #${orderNumber}\n` +
    `${transportLabel}\n` +
    `📞 Жолоочийн утас: ${handoff.phone}\n` +
    `🚗 Машины дугаар: ${handoff.license}\n` +
    `⏰ Ойролцоо ирэх хугацаа: ${handoff.eta}\n\n` +
    paymentNote +
    `Асуулт байвал дэлгүүртэй холбогдоно уу. 🙏`
  )
}

// ---------------------------------------------------------------------------
// Telegram API helpers
// ---------------------------------------------------------------------------

/** Low-level Telegram sendMessage */
export async function tgSend(chatId: number | string, text: string, options?: {
  parseMode?: 'HTML' | 'Markdown'
  replyMarkup?: object
}): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${botToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode ?? 'HTML',
        reply_markup: options?.replyMarkup,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error(`[Telegram] sendMessage FAILED chat=${chatId} status=${res.status}:`, err)
      return false
    }
    console.log(`[Telegram] sendMessage OK chat=${chatId}`)
    return true
  } catch (err) {
    console.error('[Telegram] sendMessage error:', err)
    return false
  }
}

/** Send a message with inline keyboard buttons */
export async function tgSendButtons(
  chatId: number | string,
  text: string,
  keyboard: TgInlineKeyboard
): Promise<boolean> {
  return tgSend(chatId, text, { replyMarkup: keyboard })
}

/** Answer a callback query (dismisses the loading spinner on button) */
export async function tgAnswerCallback(
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken()}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    })
  } catch (err) {
    console.error('[Telegram] answerCallbackQuery error:', err)
  }
}

/** Remove buttons from a message after driver taps one */
export async function tgRemoveButtons(
  chatId: number | string,
  messageId: number
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken()}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    })
  } catch (err) {
    console.error('[Telegram] editMessageReplyMarkup error:', err)
  }
}

/** Send a message to a driver by their DB driver_id. Returns false if no Telegram linked. */
export async function sendToDriver(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  driverId: string,
  text: string,
  keyboard?: TgInlineKeyboard
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver } = await (supabase as any)
    .from('delivery_drivers')
    .select('telegram_chat_id, name')
    .eq('id', driverId)
    .single()

  if (!driver?.telegram_chat_id) {
    console.warn(`[Telegram] Driver ${driverId} has no telegram_chat_id — falling back to driver_messages only`)
    return false
  }

  return tgSend(driver.telegram_chat_id, text, keyboard ? { replyMarkup: keyboard } : undefined)
}

/** Also save the message to driver_messages table for the dashboard */
export async function sendToDriverWithLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  driverId: string,
  storeId: string,
  text: string,
  keyboard?: TgInlineKeyboard
): Promise<void> {
  // Send via Telegram (best-effort)
  await sendToDriver(supabase, driverId, text, keyboard)

  // Always save to DB so dashboard shows it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('driver_messages')
    .insert({
      store_id: storeId,
      driver_id: driverId,
      sender_type: 'store',
      message: text.replace(/<[^>]+>/g, ''), // strip HTML for DB
    })
}

// ---------------------------------------------------------------------------
// Proactive message templates (Section 5.1 of behavior guide)
// ---------------------------------------------------------------------------

interface OrderInfo {
  orderNumber: string
  deliveryAddress?: string
  customerName?: string
  customerPhone?: string
  items?: string
  cancelReason?: string
  newDeliveryDate?: string
}

export const DRIVER_PROACTIVE_MESSAGES = {
  /** New order assigned — send pickup details */
  orderAssigned: (order: OrderInfo) =>
    `🆕 <b>ШИНЭ ЗАХИАЛГА — #${order.orderNumber}</b>\n\n` +
    `📦 Бараа: ${order.items || 'Дэлгэрэнгүй апп-с харна уу'}\n` +
    `📍 Хаяг: ${order.deliveryAddress || 'Тодорхойгүй'}\n` +
    `👤 Хүлээн авагч: ${order.customerName || '—'}\n` +
    `📞 Утас: ${order.customerPhone || '—'}`,

  /** Order cancelled — do NOT deliver */
  orderCancelled: (order: OrderInfo) =>
    `⚠️ <b>ЗАХИАЛГА ЦУЦЛАГДЛАА — #${order.orderNumber}</b>\n\n` +
    `Барааг хүргэхгүй байна.\n` +
    (order.cancelReason ? `Шалтгаан: ${order.cancelReason}\n\n` : '\n') +
    `Барааг агуулахад буцааж өгнө үү.\n` +
    `Хүлээн авсан бол <b>хүлээлээ</b> гэж бичнэ үү.`,

  /** Hold — waiting for payment before handing over */
  holdForPayment: (order: OrderInfo) =>
    `⏸️ <b>ХҮЛЭЭ — #${order.orderNumber}</b>\n\n` +
    `Харилцагч төлбөр хийгээгүй байна.\n` +
    `<b>Барааг өгөхгүй байна уу.</b>\n\n` +
    `Төлбөр орсны дараа ногоон гэрэл илгээнэ. Хүлээнэ үү.`,

  /** Payment received — now hand over */
  paymentConfirmed: (order: OrderInfo) =>
    `✅ <b>ТӨЛБӨР ОРЛОО — #${order.orderNumber}</b>\n\n` +
    `Харилцагч төлбөрөө хийлээ.\n` +
    `Барааг одоо өгч болно. Баярлалаа!`,

  /** Return request — collect and bring back */
  returnRequest: (order: OrderInfo) =>
    `🔄 <b>БУЦААЛТ — #${order.orderNumber}</b>\n\n` +
    `Харилцагч барааг буцааж байна.\n` +
    `Барааг авахаасаа өмнө <b>зураг аваарай.</b>\n` +
    `Дараа нь агуулахад буцааж өгнө үү.`,

  /** Customer is at door, payment pending — urgent */
  paymentUrging: (order: OrderInfo, deadlineMin: number) =>
    `⏰ <b>ХҮЛЭЭ — #${order.orderNumber}</b>\n\n` +
    `Харилцагч руу төлбөрийн линк явуулж байна.\n` +
    `<b>${deadlineMin} минут хүлээнэ үү.</b>\n\n` +
    `Хэрэв төлбөр ороогүй бол барааг агуулахад аваачна.`,
}

// ---------------------------------------------------------------------------
// Onboarding helpers
// ---------------------------------------------------------------------------

/** Welcome message when driver starts the bot */
export const DRIVER_BOT_WELCOME =
  `👋 <b>Сайн уу! Теmuулэл жолоочийн бот.</b>\n\n` +
  `Холбогдохын тулд утасны дугаараа илгээнэ үү.\n` +
  `Жишээ: <code>99112233</code>`

export const DRIVER_BOT_LINKED =
  (name: string) =>
    `✅ <b>Амжилттай холбогдлоо!</b>\n\n` +
    `Сайн байна уу, ${name}!\n` +
    `Цаашид захиалгын мэдэгдлүүд энд ирнэ.`

export const DRIVER_BOT_NOT_FOUND =
  `❌ Таны утасны дугаар системд бүртгэлгүй байна.\n\n` +
  `Дэлгүүрийн менежертэй холбогдоно уу.`

export const DRIVER_BOT_ALREADY_LINKED =
  (name: string) =>
    `✅ Таны акаунт аль хэдийн холбогдсон байна.\n` +
    `Сайн байна уу, ${name}!`
