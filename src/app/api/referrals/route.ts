import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateCode(): string {
  // 8-char alphanumeric
  return Math.random().toString(36).substring(2, 6).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: referrals } = await (supabase as any)
    .from('referrals')
    .select('*')
    .eq('referrer_store_id', member.store_id)
    .order('created_at', { ascending: false })

  const rewarded = (referrals || []).filter((r: { status: string }) => r.status === 'rewarded').length
  const totalMonthsEarned = (referrals || [])
    .filter((r: { status: string }) => r.status === 'rewarded')
    .reduce((s: number, r: { reward_months: number }) => s + (r.reward_months || 1), 0)

  return NextResponse.json({
    referrals: referrals || [],
    stats: {
      total: (referrals || []).length,
      rewarded,
      monthsEarned: totalMonthsEarned,
    },
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('referrals')
    .insert({
      referrer_store_id: member.store_id,
      referral_code: generateCode(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel-app.vercel.app'}/signup?ref=${data.referral_code}`
  return NextResponse.json({ referral: data, shareUrl })
}
