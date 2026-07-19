import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/team/invite/verify?token=xxx
 *
 * Verify a pending invite token and return invite details.
 * Used by the /invite/[token] signup page.
 *
 * pending_invites is not readable via the anon key (see migration 072); the token
 * lookup runs server-side with the service-role client. The bearer token itself is
 * the secret, so we only echo back non-sensitive display fields (never the token).
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Token шаардлагатай' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Simple query without joins — the join on auth.users fails on production
  const { data: invite } = await admin
    .from('pending_invites')
    .select('email, role, store_id, expires_at, invited_by')
    .eq('token', token)
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Урилга олдсонгүй' }, { status: 404 })
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Урилгын хугацаа дууссан' }, { status: 410 })
  }

  // Fetch store name separately
  const { data: store } = await admin
    .from('stores')
    .select('name')
    .eq('id', invite.store_id)
    .single()

  // Fetch inviter email from public.users
  const { data: inviter } = await admin
    .from('users')
    .select('email')
    .eq('id', invite.invited_by)
    .single()

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    storeName: store?.name || '',
    inviterEmail: inviter?.email || '',
  })
}
