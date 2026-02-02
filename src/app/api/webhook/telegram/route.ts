import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  sendTelegramMessage,
  answerCallbackQuery,
  editMessageText,
} from '@/lib/telegram'

/**
 * POST /api/webhook/telegram
 *
 * Telegram Bot webhook endpoint. Handles:
 * 1. /start STAFF_ID — Auto-link staff member's Telegram account
 * 2. callback_query — Confirm/Reject appointment buttons
 */
export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Handle callback queries (inline button taps)
  if (body.callback_query) {
    await handleCallbackQuery(supabase, body.callback_query as CallbackQuery)
    return NextResponse.json({ ok: true })
  }

  // Handle /start command for staff linking
  const message = body.message as TelegramMessage | undefined
  if (message?.text?.startsWith('/start')) {
    await handleStartCommand(supabase, message)
    return NextResponse.json({ ok: true })
  }

  // Ignore other messages
  return NextResponse.json({ ok: true })
}

// Telegram doesn't need CORS but we handle OPTIONS for completeness
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelegramMessage {
  message_id: number
  chat: { id: number }
  from?: { id: number; first_name?: string }
  text?: string
}

interface CallbackQuery {
  id: string
  from: { id: number }
  message?: {
    message_id: number
    chat: { id: number }
    text?: string
  }
  data?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

/**
 * Handle /start STAFF_ID — Links the Telegram chat to a staff member.
 */
async function handleStartCommand(
  supabase: SupabaseClient,
  message: TelegramMessage
) {
  const chatId = String(message.chat.id)
  const text = message.text || ''
  const parts = text.split(' ')
  const staffId = parts[1]?.trim()

  if (!staffId) {
    await sendTelegramMessage(chatId, 'Сайн байна уу! Ажилтны холбоос линкээр нэвтэрнэ үү.')
    return
  }

  // Look up staff member
  const { data: staffMember, error } = await supabase
    .from('staff')
    .select('id, name, store_id')
    .eq('id', staffId)
    .single()

  if (error || !staffMember) {
    await sendTelegramMessage(chatId, 'Ажилтан олдсонгүй. Линкээ шалгана уу.')
    return
  }

  // Link Telegram chat ID to staff
  const { error: updateError } = await supabase
    .from('staff')
    .update({ telegram_chat_id: chatId })
    .eq('id', staffId)

  if (updateError) {
    console.error('[telegram] Failed to link staff:', updateError)
    await sendTelegramMessage(chatId, 'Алдаа гарлаа. Дахин оролдоно уу.')
    return
  }

  await sendTelegramMessage(
    chatId,
    `Амжилттай холбогдлоо! ${staffMember.name}, та захиалгын мэдэгдэл авах болно.`
  )
}

/**
 * Handle callback query from inline keyboard (Confirm/Reject appointment).
 */
async function handleCallbackQuery(
  supabase: SupabaseClient,
  query: CallbackQuery
) {
  const data = query.data || ''
  const chatId = query.message?.chat?.id ? String(query.message.chat.id) : null
  const messageId = query.message?.message_id

  // Parse callback data: "confirm_appointment:UUID" or "reject_appointment:UUID"
  const [action, appointmentId] = data.split(':')

  if (!appointmentId || !chatId || !messageId) {
    await answerCallbackQuery(query.id, 'Алдаа гарлаа')
    return
  }

  if (action === 'confirm_appointment') {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', appointmentId)

    if (error) {
      await answerCallbackQuery(query.id, 'Алдаа: ' + error.message)
      return
    }

    await answerCallbackQuery(query.id, 'Баталгаажуулсан!')
    await editMessageText(
      chatId,
      messageId,
      (query.message?.text || '') + '\n\n✅ Баталгаажуулсан'
    )
  } else if (action === 'reject_appointment') {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)

    if (error) {
      await answerCallbackQuery(query.id, 'Алдаа: ' + error.message)
      return
    }

    await answerCallbackQuery(query.id, 'Цуцлагдсан')
    await editMessageText(
      chatId,
      messageId,
      (query.message?.text || '') + '\n\n❌ Цуцлагдсан'
    )
  } else {
    await answerCallbackQuery(query.id, 'Тодорхойгүй үйлдэл')
  }
}
