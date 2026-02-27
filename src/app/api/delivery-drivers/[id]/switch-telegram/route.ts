/**
 * POST /api/delivery-drivers/:id/switch-telegram
 *
 * Switch the active Telegram account for a driver.
 * Picks a chat_id from metadata.telegram_history and sets it as the current one.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
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

  const body = await request.json() as { chat_id: number }
  if (!body.chat_id || typeof body.chat_id !== 'number') {
    return NextResponse.json({ error: 'chat_id required' }, { status: 400 })
  }

  // Fetch driver to verify ownership + get metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, metadata, telegram_chat_id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meta: Record<string, any> = driver.metadata ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history: any[] = meta.telegram_history ?? []

  // Verify the requested chat_id is in history
  const entry = history.find((h) => h.chat_id === body.chat_id)
  if (!entry) {
    return NextResponse.json({ error: 'chat_id not found in history' }, { status: 400 })
  }

  // Bump its linked_at to now (mark it as newly active) and move to front
  const now = new Date().toISOString()
  const updatedEntry = { ...entry, linked_at: now }
  const updatedHistory = [updatedEntry, ...history.filter((h) => h.chat_id !== body.chat_id)]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('delivery_drivers')
    .update({
      telegram_chat_id: body.chat_id,
      telegram_linked_at: now,
      metadata: { ...meta, telegram_history: updatedHistory },
      updated_at: now,
    })
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, active_chat_id: body.chat_id })
}
