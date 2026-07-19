import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase/service'
import crypto from 'crypto'

function verifyStripeSignature(payload: string, signature: string, secret: string): boolean {
  const elements = signature.split(',').reduce((acc, e) => {
    const [k, v] = e.split('=')
    acc[k] = v
    return acc
  }, {} as Record<string, string>)
  const timestamp = elements.t
  const sig = elements.v1
  if (!timestamp || !sig) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch { return false }
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') || ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const body = await req.text()

  if (!secret || !verifyStripeSignature(body, sig, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } }
  const sb = getSupabase()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata: { store_id: string; plan: string }; customer: string; subscription: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('subscriptions').upsert({
      store_id: session.metadata.store_id,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      plan: session.metadata.plan,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    // Bump message limit based on plan
    const limits = { basic: 10000, starter: 15000, pro: 30000 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('stores').update({
      monthly_message_limit: limits[session.metadata.plan as keyof typeof limits] || 100,
    }).eq('id', session.metadata.store_id)
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as { id: string; status: string; current_period_end: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('subscriptions').update({
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
