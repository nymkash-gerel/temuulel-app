import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/notifications
 *
 * Fetch recent notifications for the current user's store.
 * Returns unread first, then recent read notifications.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20')

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, is_read, created_at')
    .eq('store_id', store.id)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also get unread count
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('is_read', false)

  return NextResponse.json({
    store_id: store.id,
    notifications: notifications || [],
    unread_count: count || 0,
  })
}

/**
 * PATCH /api/notifications
 *
 * Mark notification(s) as read.
 * Body: { ids: string[] } or { mark_all: true }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const body = await request.json()

  if (body.mark_all) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('store_id', store.id)
      .eq('is_read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ updated: true })
  }

  const ids = body.ids as string[] | undefined
  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: 'ids or mark_all required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('store_id', store.id)
    .in('id', ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
