/**
 * GET /api/admin/telegram/test-driver?driver_id=<uuid>
 *
 * Diagnostic endpoint — checks every step of the Telegram notification chain
 * and returns a detailed status object. Requires store owner auth.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_API = 'https://api.telegram.org'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).single()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const driverId = request.nextUrl.searchParams.get('driver_id')
  const send = request.nextUrl.searchParams.get('send') === '1'

  const result: Record<string, unknown> = {}

  // 1. Check bot token
  const botToken = process.env.DRIVER_TELEGRAM_BOT_TOKEN
  result.bot_token_set = !!botToken
  result.bot_token_prefix = botToken ? botToken.slice(0, 10) + '...' : null

  // 2. Check Supabase service role key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  result.service_role_key_set = !!serviceKey

  // 3. Check driver telegram_chat_id (via admin client)
  if (driverId) {
    try {
      const admin = createAdminClient()
      const { data: driver, error } = await admin
        .from('delivery_drivers')
        .select('id, name, telegram_chat_id, telegram_linked_at, store_id')
        .eq('id', driverId)
        .single()

      if (error) {
        result.driver_lookup = { error: error.message }
      } else {
        result.driver_lookup = {
          found: !!driver,
          name: driver?.name,
          store_id: driver?.store_id,
          belongs_to_your_store: driver?.store_id === store.id,
          telegram_chat_id: driver?.telegram_chat_id ?? null,
          telegram_linked_at: driver?.telegram_linked_at ?? null,
          telegram_linked: !!driver?.telegram_chat_id,
        }
      }

      // 4. Test Telegram API (bot info)
      if (botToken) {
        const meRes = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`)
        const me = await meRes.json()
        result.telegram_bot = meRes.ok ? { ok: true, username: me.result?.username } : { ok: false, error: me }
      }

      // 5. Optionally send a test message
      if (send && driver?.telegram_chat_id && botToken) {
        const msgRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: driver.telegram_chat_id,
            text: `🔧 <b>Тест мэдэгдэл</b>\n\nТелеграм холболт амжилттай ажиллаж байна!`,
            parse_mode: 'HTML',
          }),
        })
        const msgBody = await msgRes.json()
        result.test_message_sent = msgRes.ok
        result.test_message_result = msgBody
      }
    } catch (err) {
      result.driver_lookup_error = String(err)
    }
  }

  return NextResponse.json(result)
}
