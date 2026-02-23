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

interface TgUpdate {
  update_id: number
  message?: TgMessage
}

/** Clean a phone number to 8 digits (Mongolian mobile) */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^976/, '').slice(-8)
}

/** Check if a string looks like a Mongolian phone number */
function looksLikePhone(text: string): boolean {
  return /^[+]?976?\d{8}$/.test(text.trim()) || /^\d{8}$/.test(text.trim())
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

  const msg = update.message
  if (!msg?.text && !msg?.contact) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id
  const text = msg.text?.trim() ?? ''

  const supabase = getSupabase()

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
    const phone = normalizePhone(rawPhone)

    // Look up driver by phone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: driver } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name, telegram_chat_id')
      .eq('phone', phone)
      .maybeSingle()

    if (!driver) {
      await tgSend(chatId, DRIVER_BOT_NOT_FOUND)
      return NextResponse.json({ ok: true })
    }

    // Already linked?
    if (driver.telegram_chat_id && driver.telegram_chat_id === chatId) {
      await tgSend(chatId, DRIVER_BOT_ALREADY_LINKED(driver.name))
      return NextResponse.json({ ok: true })
    }

    // Save chat_id
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
