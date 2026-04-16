import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// GET — stats + referrals + payouts
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: account } = await db
    .from('affiliate_accounts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!account) return NextResponse.json({ stats: null })

  const { data: referrals } = await db
    .from('affiliate_referrals')
    .select('*')
    .eq('affiliate_id', account.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const { data: payouts } = await db
    .from('affiliate_payouts')
    .select('*')
    .eq('affiliate_id', account.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Aggregate stats
  const allReferrals = referrals || []
  const clicks = allReferrals.length
  const signups = allReferrals.filter((r: { status: string }) => ['signed_up', 'converted', 'paid'].includes(r.status)).length
  const conversions = allReferrals.filter((r: { status: string }) => ['converted', 'paid'].includes(r.status)).length
  const paidCommission = allReferrals
    .filter((r: { status: string }) => r.status === 'paid')
    .reduce((s: number, r: { commission_amount?: number }) => s + (r.commission_amount || 0), 0)
  const pendingCommission = allReferrals
    .filter((r: { status: string }) => r.status === 'converted')
    .reduce((s: number, r: { commission_amount?: number }) => s + (r.commission_amount || 0), 0)

  const origin = process.env.NEXT_PUBLIC_APP_URL || ''
  const shareUrl = `${origin}/signup?aff=${account.referral_code}`

  return NextResponse.json({
    stats: {
      clicks,
      signups,
      conversions,
      pending_commission: pendingCommission,
      paid_commission: paidCommission,
      total_earned: pendingCommission + paidCommission,
      conversion_rate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    },
    referrals: allReferrals,
    payouts: payouts || [],
    shareUrl,
    account,
  })
}

// POST — enroll as affiliate
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: existing } = await db
    .from('affiliate_accounts')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ enrolled: true, account_id: existing.id })

  // Generate unique code
  let code = generateCode()
  for (let i = 0; i < 5; i++) {
    const { data: conflict } = await db
      .from('affiliate_accounts')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()
    if (!conflict) break
    code = generateCode()
  }

  const { data: created, error } = await db
    .from('affiliate_accounts')
    .insert({ user_id: user.id, referral_code: code })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enrolled: true, account: created })
}
