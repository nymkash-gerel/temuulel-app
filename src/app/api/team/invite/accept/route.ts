import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/team/invite/accept?token=xxx&code=xxx
 *
 * Called after email verification redirect.
 * Exchanges auth code, consumes pending invite, adds user to store_members.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.redirect(new URL('/login?error=rate_limit', request.url))

  const { searchParams, origin } = request.nextUrl
  const token = searchParams.get('token')
  const code = searchParams.get('code')

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', origin))
  }

  const supabase = await createClient()

  // Exchange auth code if present (email verification redirect)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL('/login?error=auth_callback_failed', origin))
    }
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?error=not_authenticated', origin))
  }

  // Find and validate pending invite
  const { data: invite } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (!invite) {
    return NextResponse.redirect(new URL('/dashboard?error=invite_not_found', origin))
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/login?error=invite_expired', origin))
  }

  // Verify email matches
  if (user.email !== invite.email) {
    return NextResponse.redirect(new URL('/login?error=email_mismatch', origin))
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', invite.store_id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    // Add to store_members
    await supabase.from('store_members').insert({
      store_id: invite.store_id,
      user_id: user.id,
      role: invite.role,
      permissions: invite.permissions || null,
    })

    // Create user profile if missing
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email || invite.email,
      full_name: user.user_metadata?.full_name || '',
      phone: user.user_metadata?.phone || '',
      password_hash: 'supabase_auth',
      is_verified: true,
      email_verified: true,
    }, { onConflict: 'id' })
  }

  // Delete the pending invite
  await supabase
    .from('pending_invites')
    .delete()
    .eq('id', invite.id)

  return NextResponse.redirect(new URL('/dashboard?welcome=team', origin))
}
