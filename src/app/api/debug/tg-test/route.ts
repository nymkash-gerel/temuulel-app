/**
 * GET /api/debug/tg-test?chatId=8727332674
 * Quick test to verify DRIVER_TELEGRAM_BOT_TOKEN works.
 * DELETE THIS FILE after debugging.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get('chatId') || '8727332674'
  const token = process.env.DRIVER_TELEGRAM_BOT_TOKEN

  if (!token) {
    return NextResponse.json({ ok: false, error: 'DRIVER_TELEGRAM_BOT_TOKEN not set' })
  }

  // First: get bot info to verify token
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const meJson = await meRes.json()

  if (!meRes.ok) {
    return NextResponse.json({ ok: false, step: 'getMe', error: meJson, tokenPrefix: token.slice(0, 10) + '...' })
  }

  // Then try sending a test message
  const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '🧪 Test message from Temuulel server — TG send is working!',
      parse_mode: 'HTML',
    }),
  })
  const msgJson = await msgRes.json()

  return NextResponse.json({
    bot: meJson.result,
    sendResult: msgJson,
    chatId,
  })
}
