import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
)

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

  // The Stripe billing tables predate the generated Database types (QPay is the
  // active billing path), so narrow to one loosely-typed handle here rather than an
  // untyped cast at each call site — while still surfacing the write error.
  type StripeDb = {
    from: (table: string) => {
      upsert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }
  const db = sb as unknown as StripeDb

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata: { store_id: string; plan: string }; customer: string; subscription: string }

    // Validate the plan against the known set instead of silently downgrading an
    // unexpected value to the 100-message default.
    const limits: Record<string, number> = { basic: 10000, starter: 15000, pro: 30000 }
    const plan = session.metadata.plan
    if (!(plan in limits)) {
      console.error(`[stripe] Unknown plan "${plan}" for store ${session.metadata.store_id} — not provisioning`)
      return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 })
    }

    const { error: subErr } = await db.from('subscriptions').upsert({
      store_id: session.metadata.store_id,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      plan,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    if (subErr) {
      // Return 5xx so Stripe retries — otherwise a paid customer silently gets no subscription.
      console.error(`[stripe] subscriptions upsert failed for store ${session.metadata.store_id}:`, subErr.message)
      return NextResponse.json({ error: 'Subscription write failed' }, { status: 500 })
    }

    const { error: storeErr } = await db.from('stores').update({
      monthly_message_limit: limits[plan],
    }).eq('id', session.metadata.store_id)
    if (storeErr) {
      console.error(`[stripe] message-limit update failed for store ${session.metadata.store_id}:`, storeErr.message)
      return NextResponse.json({ error: 'Store update failed' }, { status: 500 })
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as { id: string; status: string; current_period_end: number }
    const { error: updErr } = await db.from('subscriptions').update({
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', sub.id)
    if (updErr) {
      console.error(`[stripe] subscription ${sub.id} update failed:`, updErr.message)
      return NextResponse.json({ error: 'Subscription update failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
