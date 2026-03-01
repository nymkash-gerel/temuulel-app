/**
 * GET  /api/admin/telegram/setup-webhook — get current webhook status from Telegram
 * POST /api/admin/telegram/setup-webhook — register webhook with Telegram
 *
 * Requires store owner auth. The Telegram bot is platform-wide so any store
 * owner can trigger registration (it's idempotent — safe to call multiple times).
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function requireStoreOwner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return { error: 'Store not found', status: 403 as const }
  return { user, store }
}

/** GET — return current webhook info from Telegram */
export async function GET() {
  const auth = await requireStoreOwner()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ configured: false, reason: 'TELEGRAM_BOT_TOKEN not set' })
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const data = await res.json() as {
    ok: boolean
    result?: { url: string; pending_update_count: number; last_error_message?: string }
  }

  if (!data.ok) {
    return NextResponse.json({ configured: false, reason: 'Failed to fetch webhook info' })
  }

  const webhookUrl = data.result?.url || ''
  const hasSecret = !!process.env.TELEGRAM_WEBHOOK_SECRET

  return NextResponse.json({
    configured: !!token,
    registered: !!webhookUrl,
    webhookUrl,
    hasSecret,
    pendingUpdates: data.result?.pending_update_count ?? 0,
    lastError: data.result?.last_error_message ?? null,
  })
}

/** POST — call Telegram setWebhook to register/update the webhook URL */
export async function POST(request: NextRequest) {
  const auth = await requireStoreOwner()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN тохиргоогүй байна. Vercel-д env var нэмнэ үү.' },
      { status: 400 }
    )
  }

  // Derive the app's public URL from the request origin
  const origin = new URL(request.url).origin
  const webhookUrl = `${origin}/api/webhook/telegram`

  const params = new URLSearchParams({ url: webhookUrl })

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    params.set('secret_token', secret)
  }

  const telegramRes = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`
  )
  const result = await telegramRes.json() as { ok: boolean; description?: string }

  if (!result.ok) {
    return NextResponse.json(
      { error: result.description ?? 'Telegram setWebhook амжилтгүй болов' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    hasSecret: !!secret,
    message: 'Telegram webhook амжилттай бүртгэгдлээ',
  })
}
