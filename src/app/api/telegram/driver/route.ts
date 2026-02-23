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
 *   - Phone number messages → link by phone
 *   - Natural language → driver intent engine (delivered, picked up, etc.)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  tgSend,
  tgAnswerCallback,
  tgRemoveButtons,
  enRouteKeyboard,
  issueKeyboard,
  DRIVER_BOT_WELCOME,
  DRIVER_BOT_LINKED,
  DRIVER_BOT_NOT_FOUND,
  DRIVER_BOT_ALREADY_LINKED,
} from '@/lib/driver-telegram'
import { processDriverMessage } from '@/lib/driver-chat-engine'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key)
}

/** Telegram update shape (only fields we use) */
interface TgMessage {
  message_id: number
  from: { id: number; first_name: string; username?: string }
  chat: { id: number; type: string }
  text?: string
  contact?: { phone_number: string; user_id?: number }
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

/** Handle inline button taps from drivers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCallbackQuery(
  supabase: any,
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

  // Remove buttons from original message
  if (messageId) await tgRemoveButtons(chatId, messageId)

  switch (action) {
    case 'picked_up': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'picked_up' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      await tgSend(chatId,
        `✅ <b>Авлаа гэж бүртгэгдлээ.</b>\n\nХаягруу явна уу. Хүргэсэн үедээ доорх товчийг дарна уу.`,
        { replyMarkup: enRouteKeyboard(deliveryId) }
      )
      break
    }

    case 'delivered': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, '🎉 Амжилттай!')
      await tgSend(chatId, `🎉 <b>Хүргэлт амжилттай бүртгэгдлээ!</b>\n\nБаярлалаа, ${driver.name}!`)
      break
    }

    case 'unreachable': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'delayed', notes: 'Харилцагч утас авсангүй' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `📵 <b>Бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдлээ. Удахгүй зааварчилгаа ирнэ.`)
      break
    }

    case 'delay': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'delayed' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `⏰ <b>Хоцрох тухай бүртгэгдлээ.</b>\n\nХарилцагчид мэдэгдэллээ.`, { replyMarkup: enRouteKeyboard(deliveryId) })
      break
    }

    case 'issue': {
      await tgAnswerCallback(cb.id)
      await tgSend(chatId, `⚠️ <b>Ямар асуудал гарсан бэ?</b>`, { replyMarkup: issueKeyboard(deliveryId) })
      break
    }

    case 'wrong_product': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Буруу бараа' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `📦 <b>Буруу бараа гэж бүртгэгдлээ.</b>\n\nБарааг агуулахад буцааж өгнө үү.`)
      break
    }

    case 'damaged': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Гэмтсэн бараа' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `💔 <b>Гэмтсэн бараа гэж бүртгэгдлээ.</b>\n\nЗураг авч, агуулахад буцааж өгнө үү.`)
      break
    }

    case 'no_payment': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Харилцагч мөнгө өгсөнгүй' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `💰 <b>Мөнгө өгсөнгүй гэж бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдэллээ.`)
      break
    }

    case 'reject': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'pending', driver_id: null }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Татгалзлаа')
      await tgSend(chatId, `↩️ Захиалгыг татгалзлаа. Дэлгүүр өөр жолооч томилно.`)
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
  if (!msg?.text && !msg?.contact) return NextResponse.json({ ok: true })

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

      if (driver.telegram_chat_id && driver.telegram_chat_id !== chatId) {
        // Already linked to a different Telegram account
        await tgSend(chatId, DRIVER_BOT_ALREADY_LINKED(driver.name))
        return NextResponse.json({ ok: true })
      }

      // Link this Telegram chat to the driver
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('delivery_drivers')
        .update({
          telegram_chat_id: chatId,
          telegram_linked_at: new Date().toISOString(),
        })
        .eq('id', driver.id)

      await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
      return NextResponse.json({ ok: true })
    }

    // Plain /start with no param → welcome + prompt for phone
    await tgSend(chatId, DRIVER_BOT_WELCOME)
    return NextResponse.json({ ok: true })
  }

  // ── Phone number (onboarding) ────────────────────────────────────────────
  if (looksLikePhone(text) || msg.contact) {
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

    // Save chat_id (also checks if already linked via re-fetch)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('delivery_drivers')
      .update({
        telegram_chat_id: chatId,
        telegram_linked_at: new Date().toISOString(),
      })
      .eq('id', driver.id)

    if (updateError) {
      console.error(`[DriverBot] Update failed: ${updateError.message}`)
      // Column may not exist yet (migration 049 pending) — still send welcome
    }

    await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
    return NextResponse.json({ ok: true })
  }

  // ── Natural language from authenticated driver ───────────────────────────
  // Look up which driver this chat_id belongs to
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!driver) {
    // Unknown sender — prompt to link first
    await tgSend(
      chatId,
      `❓ Таны акаунт холбогдоогүй байна.\n\nУтасны дугаараа илгээнэ үү (жишээ: 99112233).`
    )
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
