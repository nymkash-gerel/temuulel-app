/**
 * POST /api/delivery-drivers/:id/sync-telegram
 *
 * Fetches user info from Telegram for the driver's current telegram_chat_id
 * and upserts it into metadata.telegram_history.
 * Useful for drivers linked before history tracking was added.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, telegram_chat_id, telegram_linked_at, metadata')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  if (!driver.telegram_chat_id) return NextResponse.json({ error: 'No Telegram account linked' }, { status: 400 })

  const token = process.env.DRIVER_TELEGRAM_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })

  // Call Telegram getChat to get user info
  const tgRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: driver.telegram_chat_id }),
  })
  const tgJson = await tgRes.json() as {
    ok: boolean
    result?: { id: number; first_name?: string; last_name?: string; username?: string; type: string }
    description?: string
  }

  if (!tgJson.ok || !tgJson.result) {
    return NextResponse.json({ error: `Telegram error: ${tgJson.description ?? 'unknown'}` }, { status: 502 })
  }

  const tgUser = tgJson.result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta: Record<string, any> = driver.metadata ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history: any[] = meta.telegram_history ?? []

  const syncedEntry = {
    chat_id: tgUser.id,
    first_name: tgUser.first_name ?? 'Unknown',
    ...(tgUser.last_name ? { last_name: tgUser.last_name } : {}),
    ...(tgUser.username ? { username: tgUser.username } : {}),
    linked_at: driver.telegram_linked_at ?? new Date().toISOString(),
  }

  // Upsert: replace existing entry for this chat_id, or add at front
  const updatedHistory = [syncedEntry, ...history.filter((h) => h.chat_id !== tgUser.id)]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('delivery_drivers')
    .update({ metadata: { ...meta, telegram_history: updatedHistory } })
    .eq('id', id)
    .eq('store_id', store.id)

  return NextResponse.json({ ok: true, entry: syncedEntry })
}
