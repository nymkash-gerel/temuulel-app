import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/driver-chat/:driverId
 *
 * Fetch messages between store and driver.
 * Marks driver messages as read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  const { driverId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const before = searchParams.get('before') // cursor for pagination

  let query = supabase
    .from('driver_messages')
    .select('id, sender_type, message, read_at, created_at')
    .eq('store_id', store.id)
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data: messages } = await query

  // Mark unread driver messages as read
  await supabase
    .from('driver_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('store_id', store.id)
    .eq('driver_id', driverId)
    .eq('sender_type', 'driver')
    .is('read_at', null)

  return NextResponse.json({ messages: messages || [] })
}

/**
 * POST /api/driver-chat/:driverId
 *
 * Send a message from store owner to driver.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  const { driverId } = await params
  const rl = await rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body = await request.json()
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!message || message.length > 2000) {
    return NextResponse.json({ error: 'Мессеж 1-2000 тэмдэгт байх ёстой' }, { status: 400 })
  }

  // Verify driver belongs to store
  const { data: driver } = await supabase
    .from('delivery_drivers')
    .select('id')
    .eq('id', driverId)
    .eq('store_id', store.id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const { data: msg, error } = await supabase
    .from('driver_messages')
    .insert({
      store_id: store.id,
      driver_id: driverId,
      sender_type: 'store',
      message,
    })
    .select('id, sender_type, message, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: msg })
}
