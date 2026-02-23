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
      console.error(`[Telegram] sendMessage failed for chat ${chatId}:`, err)
      return false
    }
    return true
  } catch (err) {
    console.error('[Telegram] sendMessage error:', err)
    return false
  }
}

/** Send a message to a driver by their DB driver_id. Returns false if no Telegram linked. */
export async function sendToDriver(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  driverId: string,
  text: string
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

  return tgSend(driver.telegram_chat_id, text)
}

/** Also save the message to driver_messages table for the dashboard */
export async function sendToDriverWithLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  driverId: string,
  storeId: string,
  text: string
): Promise<void> {
  // Send via Telegram (best-effort)
  await sendToDriver(supabase, driverId, text)

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
    `📞 Утас: ${order.customerPhone || '—'}\n\n` +
    `Захиалгыг хүлээн авсан бол <b>авлаа</b> гэж бичнэ үү.`,

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
