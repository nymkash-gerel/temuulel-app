import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { resolveStoreId } from '@/lib/resolve-store'

/**
 * GET /api/team/telegram
 * Get current user's Telegram connection status and notification preferences.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 404 })

  // Check if user is owner (stored in stores table, not store_members)
  const { data: store } = await supabase
    .from('stores')
    .select('id, owner_id')
    .eq('id', storeId)
    .single()

  const isOwner = store?.owner_id === user.id

  if (isOwner) {
    // Owner: check store_members for their own entry, or create a virtual response
    const { data: member } = await supabase
      .from('store_members')
      .select('id, telegram_chat_id, notification_preferences')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      memberId: member?.id || null,
      telegramChatId: member?.telegram_chat_id || null,
      notificationPreferences: member?.notification_preferences || {},
      isOwner: true,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    })
  }

  // Team member
  const { data: member } = await supabase
    .from('store_members')
    .select('id, telegram_chat_id, notification_preferences')
    .eq('store_id', storeId)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  return NextResponse.json({
    memberId: member.id,
    telegramChatId: member.telegram_chat_id || null,
    notificationPreferences: member.notification_preferences || {},
    isOwner: false,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  })
}

/**
 * PUT /api/team/telegram
 * Update notification preferences for the current user.
 */
export async function PUT(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 20, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { notificationPreferences } = body as { notificationPreferences: Record<string, boolean> }

  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 404 })

  // Check if owner — owner might not have a store_members record yet
  const { data: store } = await supabase
    .from('stores')
    .select('owner_id')
    .eq('id', storeId)
    .single()

  if (store?.owner_id === user.id) {
    // Upsert owner as a store_member if not already
    const { data: existing } = await supabase
      .from('store_members')
      .select('id')
      .eq('store_id', storeId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      await supabase
        .from('store_members')
        .update({ notification_preferences: notificationPreferences })
        .eq('id', existing.id)
    } else {
      await supabase.from('store_members').insert({
        store_id: storeId,
        user_id: user.id,
        role: 'owner',
        notification_preferences: notificationPreferences,
      })
    }
  } else {
    // Team member
    await supabase
      .from('store_members')
      .update({ notification_preferences: notificationPreferences })
      .eq('store_id', storeId)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/team/telegram
 * Disconnect Telegram for the current user.
 */
export async function DELETE(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) return NextResponse.json({ error: 'No store' }, { status: 404 })

  await supabase
    .from('store_members')
    .update({ telegram_chat_id: null })
    .eq('store_id', storeId)
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
