import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — request a payout for pending commissions
export async function POST() {
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

  if (!account) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

  // Sum pending commissions
  const { data: pending } = await db
    .from('affiliate_referrals')
    .select('id, commission_amount')
    .eq('affiliate_id', account.id)
    .eq('status', 'converted')

  const pendingTotal = (pending || []).reduce(
    (s: number, r: { commission_amount?: number }) => s + (r.commission_amount || 0),
    0
  )

  if (pendingTotal < account.payout_threshold) {
    return NextResponse.json(
      { error: `Payout threshold is ${account.payout_threshold}₮. You have ${pendingTotal}₮.` },
      { status: 400 }
    )
  }

  // Create payout record
  const { data: payout, error: payoutErr } = await db
    .from('affiliate_payouts')
    .insert({
      affiliate_id: account.id,
      amount: pendingTotal,
      status: 'pending',
    })
    .select()
    .single()

  if (payoutErr) return NextResponse.json({ error: payoutErr.message }, { status: 500 })

  // Mark referrals as paid
  const referralIds = (pending || []).map((r: { id: string }) => r.id)
  if (referralIds.length > 0) {
    await db
      .from('affiliate_referrals')
      .update({ status: 'paid' })
      .in('id', referralIds)
  }

  return NextResponse.json({ payout })
}
