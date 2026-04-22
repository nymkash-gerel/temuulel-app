import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { notify } from '@/lib/slack'

/**
 * POST /api/internal/new-store-notify
 *
 * Called by the onboarding flow right after a store is successfully created.
 * Sends a Slack notification to the team's #business channel. This is a
 * fire-and-forget signal — never block the onboarding UX if Slack is down.
 *
 * Auth: the caller must be the authenticated owner of the store_id they
 * pass in. This prevents spam from arbitrary third parties.
 */

const RATE_LIMIT = { limit: 5, windowSeconds: 60 }

export async function POST(req: NextRequest) {
  const rl = await rateLimit(getClientIp(req), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { store_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const storeId = body.store_id
  if (!storeId || typeof storeId !== 'string') {
    return NextResponse.json({ error: 'store_id required' }, { status: 400 })
  }

  // Verify the user owns this store (prevent spoofing)
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, business_type, owner_id')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found or not owned by user' }, { status: 404 })
  }

  // Fire Slack notification (non-blocking for the handler, but we wait a max of 5s inside notify())
  await notify('business', {
    emoji: '🎉',
    color: 'good',
    header: 'New store signed up',
    text: `*${store.name}* just finished onboarding`,
    fields: {
      Store: store.name,
      Vertical: store.business_type || '—',
      Owner: user.email || user.id,
    },
    context: `Store ID: ${store.id}`,
  })

  return NextResponse.json({ ok: true })
}
