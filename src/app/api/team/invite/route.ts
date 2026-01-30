import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendTeamInviteEmail } from '@/lib/email'

/**
 * POST /api/team/invite
 *
 * Invite an existing user to a store's team.
 * Sends an invite email after adding to store_members.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { email, role } = body

  if (!email || !role || !['admin', 'staff'].includes(role)) {
    return NextResponse.json(
      { error: 'email and valid role (admin/staff) required' },
      { status: 400 }
    )
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    )
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planLimits = (sub?.subscription_plans as any)?.limits || {}
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
  const trimmedEmail = email.trim()
  const { data: invitedUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', trimmedEmail)
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
    trimmedEmail,
    store.name,
    role,
    user.email || 'Эзэмшигч'
  ).catch((err) => console.error('Team invite email failed:', err))

  return NextResponse.json({
    member: { user_id: invitedUser.id, email: invitedUser.email, role },
  })
}
