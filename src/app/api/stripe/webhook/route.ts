import { NextRequest, NextResponse } from 'next/server'
import { getTypedSupabase } from '@/lib/supabase/service'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { Json } from '@/lib/database.types'
import crypto from 'crypto'

/**
 * The HMAC signature is this endpoint's authentication — there is no user
 * session on a webhook. The limiter is a separate concern: the route is
 * publicly reachable, so an unauthenticated caller can otherwise force an HMAC
 * computation and a JSON parse on every request.
 *
 * Set well above Stripe's real delivery rate. Stripe retries a 429 with backoff
 * for up to three days, so a burst that trips this is not lost.
 */
const RATE_LIMIT = { limit: 100, windowSeconds: 60 }

// The Supabase client is created lazily per request (getTypedSupabase) — a
// module-level createClient() throws "supabaseKey is required" during Next.js build
// page-data collection when the key env var is unset (e.g. Vercel preview).

/**
 * A store's SaaS plan lives in `store_subscriptions`, NOT in `subscriptions`.
 * `subscriptions` is the subscription-BOX vertical table (036): per-customer
 * recurring boxes, keyed by customer_id, with plan_name/amount NOT NULL. This
 * route used to write there, and since none of the Stripe columns existed on it,
 * every checkout would 500 and Stripe would retry a provisioning that could never
 * succeed. 079 added the Stripe columns to store_subscriptions; the client below
 * is typed, so writing to the wrong table now fails the build instead.
 */

/**
 * Plans purchasable through Stripe. Mirrors the PRICE_IDS keys in
 * /api/stripe/checkout: a plan with no configured Stripe price can never produce
 * a session, so it must not be provisionable from a webhook either.
 *
 * Message allowances are deliberately NOT listed here — they are read from
 * subscription_plans.limits so that repricing (071) cannot leave this route
 * handing out stale limits.
 */
const STRIPE_PLAN_SLUGS = new Set(['basic', 'starter', 'pro'])

/**
 * Accepted store_subscriptions.status values. Must stay in step with the CHECK
 * constraint widened in 079_stripe_store_subscriptions.sql — a value that passes
 * here but not there turns into a 500 retry loop.
 */
const DB_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
  'cancelled',
  'expired',
])

/**
 * Map a Stripe subscription status onto the column's vocabulary, or null if it is
 * one we do not know about. Stripe spells it 'canceled'; this schema has always
 * stored 'cancelled', and 079 accepts only that spelling.
 */
function toDbStatus(stripeStatus: string): string | null {
  const normalised = stripeStatus === 'canceled' ? 'cancelled' : stripeStatus
  return DB_STATUSES.has(normalised) ? normalised : null
}

/** Pull the monthly message allowance out of the plan's JSONB limits. */
function messagesFromLimits(limits: Json): number | null {
  if (typeof limits !== 'object' || limits === null || Array.isArray(limits)) return null
  const messages = limits.messages
  return typeof messages === 'number' ? messages : null
}

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
  const rl = await rateLimit(getClientIp(req), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const sig = req.headers.get('stripe-signature') || ''
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const body = await req.text()

  if (!secret || !verifyStripeSignature(body, sig, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } }
  const db = getTypedSupabase()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      metadata?: { store_id?: string; plan?: string }
      customer?: string
      subscription?: string
    }
    const storeId = session.metadata?.store_id
    const plan = session.metadata?.plan
    if (!storeId || !plan) {
      console.error('[stripe] checkout.session.completed without store_id/plan metadata — not provisioning')
      return NextResponse.json({ error: 'Missing store_id or plan metadata' }, { status: 400 })
    }

    // Both ids are required, not optional. A row written with a null
    // stripe_subscription_id can never be matched by a later
    // customer.subscription.* event, so it would silently stop tracking renewals
    // and cancellations. Fail loudly instead of provisioning something unlinkable.
    if (!session.customer || !session.subscription) {
      console.error(`[stripe] checkout session for store ${storeId} has no customer/subscription id — not provisioning`)
      return NextResponse.json({ error: 'Missing customer or subscription id' }, { status: 400 })
    }

    // Validate the plan against the purchasable set instead of silently
    // downgrading an unexpected value to the 100-message default.
    if (!STRIPE_PLAN_SLUGS.has(plan)) {
      console.error(`[stripe] Unknown plan "${plan}" for store ${storeId} — not provisioning`)
      return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 })
    }

    // store_subscriptions.plan_id is a NOT NULL FK to subscription_plans, so the
    // slug has to be resolved to a row. That row also carries the authoritative
    // message allowance.
    const { data: planRow, error: planErr } = await db
      .from('subscription_plans')
      .select('id, limits')
      .eq('slug', plan)
      .maybeSingle()
    if (planErr) {
      console.error(`[stripe] plan lookup failed for "${plan}":`, planErr.message)
      return NextResponse.json({ error: 'Plan lookup failed' }, { status: 500 })
    }
    if (!planRow) {
      console.error(`[stripe] plan "${plan}" is not in subscription_plans — not provisioning store ${storeId}`)
      return NextResponse.json({ error: `Unknown plan: ${plan}` }, { status: 400 })
    }

    const messageLimit = messagesFromLimits(planRow.limits)
    if (messageLimit === null) {
      console.error(`[stripe] plan "${plan}" has no numeric limits.messages — not provisioning store ${storeId}`)
      return NextResponse.json({ error: 'Plan is missing a message limit' }, { status: 500 })
    }

    // Stripe delivers at least once and does not guarantee order, so this event
    // can arrive twice, or after a customer.subscription.updated that already
    // moved the row to past_due/cancelled. Writing status:'active' and a fresh
    // period unconditionally would resurrect a lapsed subscription and shift the
    // stored period away from the invoice period.
    //
    // The subscription.* events own status and period. This handler only owns
    // "which plan did they buy" and the Stripe ids. So when the row already
    // tracks this same subscription, leave the lifecycle fields alone.
    const { data: existing, error: readErr } = await db
      .from('store_subscriptions')
      .select('stripe_subscription_id')
      .eq('store_id', storeId)
      .maybeSingle()
    if (readErr) {
      console.error(`[stripe] store_subscriptions read failed for store ${storeId}:`, readErr.message)
      return NextResponse.json({ error: 'Subscription read failed' }, { status: 500 })
    }

    const isReplay = existing?.stripe_subscription_id === session.subscription

    // onConflict: 'store_id' needs the unique index added in 079. Without it
    // PostgREST would fall back to a plain INSERT and append a duplicate row,
    // which breaks the four screens that do .eq('store_id', …).single().
    //
    // current_period_end is intentionally absent: checkout.session.completed does
    // not carry the billing period, and the customer.subscription.updated event
    // that follows sets it. Omitting the key leaves any existing value alone,
    // rather than overwriting it with a guess.
    const { error: subErr } = await db
      .from('store_subscriptions')
      .upsert({
        store_id: storeId,
        plan_id: planRow.id,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        // Only stamp the lifecycle on the first event for this subscription.
        ...(isReplay ? {} : {
          status: 'active',
          current_period_start: new Date().toISOString(),
        }),
      }, { onConflict: 'store_id' })
    if (subErr) {
      // Return 5xx so Stripe retries — otherwise a paid customer silently gets no subscription.
      console.error(`[stripe] store_subscriptions upsert failed for store ${storeId}:`, subErr.message)
      return NextResponse.json({ error: 'Subscription write failed' }, { status: 500 })
    }

    const { error: storeErr } = await db.from('stores').update({
      monthly_message_limit: messageLimit,
    }).eq('id', storeId)
    if (storeErr) {
      console.error(`[stripe] message-limit update failed for store ${storeId}:`, storeErr.message)
      return NextResponse.json({ error: 'Store update failed' }, { status: 500 })
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as { id: string; status: string; current_period_end?: number }

    const status = toDbStatus(sub.status)
    if (!status) {
      // Reject rather than write a value the CHECK will refuse: a 400 surfaces in
      // the Stripe dashboard, where a 500 would just retry for three days.
      console.error(`[stripe] subscription ${sub.id} has unrecognised status "${sub.status}"`)
      return NextResponse.json({ error: `Unrecognised status: ${sub.status}` }, { status: 400 })
    }

    // A cancelled subscription must lose its paid entitlements, otherwise the
    // store keeps its Pro allowance forever. Stripe sends status 'canceled' on
    // both .updated and .deleted, so this covers either path.
    let freePlanId: string | null = null
    let freeMessageLimit: number | null = null
    if (status === 'cancelled') {
      const { data: freePlan, error: freeErr } = await db
        .from('subscription_plans')
        .select('id, limits')
        .eq('slug', 'free')
        .maybeSingle()
      if (freeErr || !freePlan) {
        console.error(`[stripe] free-plan lookup failed while cancelling ${sub.id}:`, freeErr?.message ?? 'no free plan row')
        return NextResponse.json({ error: 'Free plan lookup failed' }, { status: 500 })
      }
      freePlanId = freePlan.id
      freeMessageLimit = messagesFromLimits(freePlan.limits)
      // Bail before writing anything rather than half-applying the downgrade:
      // moving plan_id to free while leaving the paid monthly_message_limit in
      // place would hand out the old allowance indefinitely.
      if (freeMessageLimit === null) {
        console.error(`[stripe] free plan has no numeric limits.messages — not downgrading ${sub.id}`)
        return NextResponse.json({ error: 'Free plan is missing a message limit' }, { status: 500 })
      }
    }

    const patch: {
      status: string
      current_period_end?: string
      plan_id?: string
    } = { status }
    if (typeof sub.current_period_end === 'number') {
      patch.current_period_end = new Date(sub.current_period_end * 1000).toISOString()
    }
    if (freePlanId) patch.plan_id = freePlanId

    // Return store_id so the message limit can be reset without a second lookup.
    const { data: updated, error: updErr } = await db
      .from('store_subscriptions')
      .update(patch)
      .eq('stripe_subscription_id', sub.id)
      .select('store_id')
    if (updErr) {
      console.error(`[stripe] subscription ${sub.id} update failed:`, updErr.message)
      return NextResponse.json({ error: 'Subscription update failed' }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      // No row carries this Stripe id, so there is nothing to update and a retry
      // would not change that — acknowledge instead of looping for three days.
      // Provisioning failures are retried by their own checkout.session.completed
      // event, not by this one.
      console.warn(`[stripe] no store_subscriptions row for subscription ${sub.id} — ignoring ${event.type}`)
      return NextResponse.json({ received: true, ignored: 'unknown subscription' })
    }

    if (freeMessageLimit !== null) {
      const storeIds = updated.map((row) => row.store_id)
      const { error: limitErr } = await db
        .from('stores')
        .update({ monthly_message_limit: freeMessageLimit })
        .in('id', storeIds)
      if (limitErr) {
        console.error(`[stripe] downgrade of message limit failed for subscription ${sub.id}:`, limitErr.message)
        return NextResponse.json({ error: 'Store downgrade failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
