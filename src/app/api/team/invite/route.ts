import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendTeamInviteEmail } from '@/lib/email'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, teamInviteSchema } from '@/lib/validations'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

/**
 * POST /api/team/invite
 *
 * Invite an existing user to a store's team.
 * Sends an invite email after adding to store_members.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: body, error: validationError } = await validateBody(request, teamInviteSchema)
  if (validationError) return validationError
  const { email, role } = body

  // Verify requester owns a store
  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json(
      { error: 'Зөвхөн дэлгүүрийн эзэмшигч урилга илгээх боломжтой' },
      { status: 403 }
    )
  }

  // Check team limit against subscription plan
  const { data: sub } = await supabase
    .from('store_subscriptions')
    .select('subscription_plans(limits)')
    .eq('store_id', store.id)
    .single()

  const planData = sub?.subscription_plans as { limits?: Record<string, unknown> } | null
  const planLimits = (planData?.limits ?? {}) as Record<string, unknown>
  const teamLimit = typeof planLimits.team_members === 'number' ? planLimits.team_members : 1

  const { count } = await supabase
    .from('store_members')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)

  if (teamLimit > 0 && (count || 0) >= teamLimit) {
    return NextResponse.json(
      { error: 'Багийн хязгаарт хүрсэн. Планаа шинэчилнэ үү.' },
      { status: 403 }
    )
  }

  // Look up invited user
  const { data: invitedUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single()

  if (!invitedUser) {
    return NextResponse.json(
      { error: 'Энэ имэйл хаягтай хэрэглэгч олдсонгүй. Тэд эхлээд бүртгүүлсэн байх ёстой.' },
      { status: 404 }
    )
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('store_members')
    .select('id')
    .eq('store_id', store.id)
    .eq('user_id', invitedUser.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Энэ хэрэглэгч аль хэдийн багийн гишүүн байна.' },
      { status: 409 }
    )
  }

  // Insert member
  const { error: insertError } = await supabase
    .from('store_members')
    .insert({ store_id: store.id, user_id: invitedUser.id, role })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Send invite email (non-blocking)
  sendTeamInviteEmail(
    email,
    store.name,
    role,
    user.email || 'Эзэмшигч'
  ).catch((err) => console.error('Team invite email failed:', err))

  return NextResponse.json({
    member: { user_id: invitedUser.id, email: invitedUser.email, role },
  })
}
