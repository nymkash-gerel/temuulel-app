import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, pushSubscribeSchema } from '@/lib/validations'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

/**
 * POST /api/push/subscribe
 *
 * Save a browser push subscription for the authenticated user.
 * Upserts on (user_id, endpoint) to handle re-subscriptions.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: body, error: validationError } = await validateBody(request, pushSubscribeSchema)
  if (validationError) return validationError
  const { endpoint, keys } = body

  // @ts-expect-error - push_subscriptions table schema
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/push/subscribe
 *
 * Remove a push subscription (for unsubscribe).
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { endpoint } = await request.json()
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  await supabase
  // @ts-expect-error - push_subscriptions table schema
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
