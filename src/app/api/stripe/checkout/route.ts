import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC,        // 89,900₮ ≈ $26
  starter: process.env.STRIPE_PRICE_STARTER,    // 149,900₮ ≈ $44
  pro: process.env.STRIPE_PRICE_PRO,            // 249,900₮ ≈ $73
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json() as { plan: 'basic' | 'starter' | 'pro' }
  const priceId = PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: 'Stripe not configured for this plan' }, { status: 400 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel-app.vercel.app'

  const body = new URLSearchParams({
    'payment_method_types[]': 'card',
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
    customer_email: user.email || '',
    'metadata[store_id]': member.store_id,
    'metadata[plan]': plan,
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await res.json() as { url?: string; error?: { message: string } }
  if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 })
  return NextResponse.json({ url: data.url })
}
