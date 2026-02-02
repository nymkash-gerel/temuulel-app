import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/driver/chat
 *
 * Fetch messages for the authenticated driver (from their primary store).
 * Marks store messages as read.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  if (!driver.store_id) {
    return NextResponse.json({ error: 'No store assigned' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const before = searchParams.get('before')

  let query = supabase
    .from('driver_messages')
    .select('id, sender_type, message, read_at, created_at')
    .eq('store_id', driver.store_id)
    .eq('driver_id', driver.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data: messages } = await query

  // Mark unread store messages as read
  await supabase
    .from('driver_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('store_id', driver.store_id)
    .eq('driver_id', driver.id)
    .eq('sender_type', 'store')
    .is('read_at', null)

  // Get store name for display
  const { data: store } = await supabase
    .from('stores')
    .select('name')
    .eq('id', driver.store_id)
    .single()

  return NextResponse.json({
    messages: messages || [],
    store_name: store?.name || 'Дэлгүүр',
  })
}

/**
 * POST /api/driver/chat
 *
 * Send a message from driver to their primary store.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  if (!driver.store_id) {
    return NextResponse.json({ error: 'No store assigned' }, { status: 404 })
  }

  const body = await request.json()
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!message || message.length > 2000) {
    return NextResponse.json({ error: 'Мессеж 1-2000 тэмдэгт байх ёстой' }, { status: 400 })
  }

  const { data: msg, error } = await supabase
    .from('driver_messages')
    .insert({
      store_id: driver.store_id,
      driver_id: driver.id,
      sender_type: 'driver',
      message,
    })
    .select('id, sender_type, message, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: msg })
}
