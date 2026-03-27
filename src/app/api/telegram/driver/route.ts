/**
 * POST /api/telegram/driver
 *
 * Telegram webhook endpoint for the driver bot.
 * Set this as the webhook URL in BotFather:
 *   POST https://api.telegram.org/bot{TOKEN}/setWebhook
 *   { "url": "https://your-domain.vercel.app/api/telegram/driver" }
 *
 * Handles:
 *   - /start command -> driver onboarding (link Telegram to driver account)
 *   - /orders        -> list active deliveries
 *   - /help          -> command list
 *   - Phone number messages -> link by phone
 *   - Photo messages -> delivery proof (auto-marks delivery as confirmed)
 *   - Natural language -> driver intent engine (delivered, picked up, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/service'
import type { TgUpdate } from '@/lib/telegram/driver-utils'
import { handleCallbackQuery } from '@/lib/telegram/driver-callbacks'
import { handleMessage } from '@/lib/telegram/driver-handlers'

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

  // ── Message handling ─────────────────────────────────────────────────────
  const msg = update.message
  if (!msg?.text && !msg?.contact && !msg?.photo) return NextResponse.json({ ok: true })

  await handleMessage(supabase, msg)
  return NextResponse.json({ ok: true })
}
