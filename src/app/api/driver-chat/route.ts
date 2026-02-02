import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/driver-chat
 *
 * List all driver conversations for the store owner.
 * Returns distinct drivers with their last message and unread count.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Get all drivers that have messages with this store
  const { data: drivers } = await supabase
    .from('delivery_drivers')
    .select('id, name, phone, status')
    .eq('store_id', store.id)

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ conversations: [] })
  }

  // For each driver, get last message and unread count
  const conversations = await Promise.all(
    drivers.map(async (driver) => {
      const { data: lastMsg } = await supabase
        .from('driver_messages')
        .select('message, sender_type, created_at')
        .eq('store_id', store.id)
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const { count: unreadCount } = await supabase
        .from('driver_messages')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('driver_id', driver.id)
        .eq('sender_type', 'driver')
        .is('read_at', null)

      return {
        driver_id: driver.id,
        driver_name: driver.name,
        driver_phone: driver.phone,
        driver_status: driver.status,
        last_message: lastMsg?.message || null,
        last_message_sender: lastMsg?.sender_type || null,
        last_message_at: lastMsg?.created_at || null,
        unread_count: unreadCount || 0,
      }
    })
  )

  // Sort by last message time, most recent first
  conversations.sort((a, b) => {
    if (!a.last_message_at && !b.last_message_at) return 0
    if (!a.last_message_at) return 1
    if (!b.last_message_at) return -1
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  })

  return NextResponse.json({ conversations })
}
