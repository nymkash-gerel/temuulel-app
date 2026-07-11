import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/team/invite/signup
 *
 * Server-side signup for invite flow.
 * Creates user with email pre-confirmed (they proved ownership by clicking invite link).
 * Then adds user to store_members and deletes the pending invite.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 5, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await request.json()
  const { token, password, fullName, phone } = body as {
    token: string
    password: string
    fullName: string
    phone: string
  }

  if (!token || !password || !fullName) {
    return NextResponse.json({ error: 'Бүх талбарыг бөглөнө үү' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой' }, { status: 400 })
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  // Validate the invite token server-side with the service-role client.
  // pending_invites is not exposed to the anon key (migration 072).
  const { data: invite } = await admin
    .from('pending_invites')
    .select('id, email, role, store_id, permissions, expires_at')
    .eq('token', token)
    .single()

  if (!invite) {
    return NextResponse.json({ error: 'Урилга олдсонгүй' }, { status: 404 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Урилгын хугацаа дууссан' }, { status: 410 })
  }

  // Create user via admin API — email pre-confirmed, no verification email sent.
  const { data: authData, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      invite_token: token,
    },
  })

  let userId: string

  if (createError) {
    if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
      // The invited email already has an account. Do NOT create/overwrite its
      // credentials here — resetting the password from a token-only flow would let
      // an invite-token holder take over an existing account. Instead, direct them
      // to log in and accept the invite via /api/team/invite/accept, which verifies
      // the authenticated user's email matches the invite before granting access.
      return NextResponse.json(
        {
          error: 'Энэ имэйл аль хэдийн бүртгэлтэй байна. Нэвтэрч орж урилгаа хүлээн авна уу.',
          needsLogin: true,
        },
        { status: 409 }
      )
    } else {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
  } else {
    userId = authData.user.id
  }

  // Create public user profile
  await admin
    .from('users')
    .upsert({
      id: userId,
      email: invite.email,
      full_name: fullName,
      phone: phone || '',
      password_hash: 'supabase_auth',
      is_verified: true,
      email_verified: true,
    }, { onConflict: 'id' })

  // Add to store_members
  await admin.from('store_members').insert({
    store_id: invite.store_id,
    user_id: userId,
    role: invite.role,
    permissions: invite.permissions || null,
  })

  // Delete the pending invite
  await admin
    .from('pending_invites')
    .delete()
    .eq('id', invite.id)

  // Sign in the user so they get a session cookie
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  })

  if (signInError) {
    // User was created but sign-in failed — they can still log in manually
    return NextResponse.json({
      success: true,
      needsLogin: true,
      message: 'Бүртгэл амжилттай. Нэвтэрч орно уу.',
    })
  }

  return NextResponse.json({
    success: true,
    needsLogin: false,
    message: 'Амжилттай! Багт нэмэгдлээ.',
  })
}
