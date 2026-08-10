import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import type { Database } from '@/lib/database.types'

type StoreSubscriptionInsert = Database['public']['Tables']['store_subscriptions']['Insert']

/**
 * The columns checkout.session.completed is allowed to write.
 *
 * `satisfies Array<keyof …Insert>` is the point of this list: the compiler
 * rejects any entry that is not a real column of store_subscriptions. The
 * previous version of this route wrote stripe_customer_id / stripe_subscription_id
 * / plan to the `subscriptions` table — which has none of them — and the test
 * suite stayed green because its mock ignored both the table name and the
 * payload. Asserting the payload keys against a schema-checked list is what
 * makes that failure mode visible from a unit test.
 */
const UPSERT_COLUMNS = [
  'store_id',
  'plan_id',
  'status',
  'stripe_customer_id',
  'stripe_subscription_id',
  'current_period_start',
] satisfies Array<keyof StoreSubscriptionInsert>

type RecordedCall = {
  table: string
  op: 'select' | 'upsert' | 'update'
  payload?: Record<string, unknown>
  onConflict?: string
  filters: Array<[string, unknown]>
}

const { calls, cfg } = vi.hoisted(() => ({
  calls: [] as RecordedCall[],
  cfg: {
    planRow: { id: 'plan-pro-uuid', limits: { messages: 30000 } } as Record<string, unknown> | null,
    freePlanRow: { id: 'plan-free-uuid', limits: { messages: 100 } } as Record<string, unknown> | null,
    planError: null as { message: string } | null,
    upsertError: null as { message: string } | null,
    updateError: null as { message: string } | null,
    storeUpdateError: null as { message: string } | null,
    updatedRows: [{ store_id: 'store-1' }] as Array<{ store_id: string }>,
    /** Row already in store_subscriptions for this store, or null if none. */
    existingSubscription: null as { stripe_subscription_id: string | null } | null,
    subscriptionReadError: null as { message: string } | null,
  },
}))

// The signature is this route's authentication; the limiter is separate and
// always allows in tests.
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 100, remaining: 99, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

/**
 * A Supabase stand-in that records which table each write targets and what it
 * carries, so tests can assert against the real schema instead of trusting the
 * route.
 */
vi.mock('@/lib/supabase/service', () => ({
  getTypedSupabase: () => ({
    from: (table: string) => ({
      select: () => {
        const filters: Array<[string, unknown]> = []
        const builder = {
          eq: (col: string, val: unknown) => { filters.push([col, val]); return builder },
          maybeSingle: async () => {
            calls.push({ table, op: 'select', filters: [...filters] })
            if (table === 'store_subscriptions') {
              if (cfg.subscriptionReadError) return { data: null, error: cfg.subscriptionReadError }
              return { data: cfg.existingSubscription, error: null }
            }
            if (cfg.planError) return { data: null, error: cfg.planError }
            const slug = filters.find(([c]) => c === 'slug')?.[1]
            return { data: slug === 'free' ? cfg.freePlanRow : cfg.planRow, error: null }
          },
        }
        return builder
      },
      upsert: async (payload: Record<string, unknown>, opts?: { onConflict?: string }) => {
        calls.push({ table, op: 'upsert', payload, onConflict: opts?.onConflict, filters: [] })
        return { error: cfg.upsertError }
      },
      update: (payload: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = []
        const settle = () => {
          calls.push({ table, op: 'update', payload, filters: [...filters] })
          const error = table === 'stores' ? cfg.storeUpdateError : cfg.updateError
          return { data: error ? null : cfg.updatedRows, error }
        }
        // A lazy thenable, so the call is recorded once, when awaited, with the
        // full filter chain — `.eq(…)` is awaited directly in one branch and
        // followed by `.select(…)` in another.
        const chain = () => ({
          eq: (col: string, val: unknown) => { filters.push([col, val]); return chain() },
          in: (col: string, val: unknown) => { filters.push([col, val]); return chain() },
          select: () => chain(),
          then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) =>
            Promise.resolve(settle()).then(ok, fail),
        })
        return chain()
      },
    }),
  }),
}))

import { POST } from './route'

const SECRET = 'whsec_test'

function sign(body: string): string {
  const t = '1700000000'
  const v1 = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex')
  return `t=${t},v1=${v1}`
}

function makeReq(body: string, signature: string) {
  return {
    headers: { get: (k: string) => (k === 'stripe-signature' ? signature : null) },
    text: async () => body,
  } as unknown as import('next/server').NextRequest
}

function checkoutBody(plan: string, metadata?: Record<string, string>) {
  return JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        metadata: metadata ?? { store_id: 'store-1', plan },
        customer: 'cus_1',
        subscription: 'sub_1',
      },
    },
  })
}

function subscriptionBody(type: string, status: string, periodEnd?: number) {
  return JSON.stringify({
    type,
    data: { object: { id: 'sub_1', status, current_period_end: periodEnd } },
  })
}

/** POST a body with a valid signature. */
async function post(body: string) {
  return POST(makeReq(body, sign(body)))
}

const writes = () => calls.filter((c) => c.op !== 'select')
const on = (table: string) => calls.filter((c) => c.table === table)
/** The write to a table, skipping the ownership/replay reads that precede it. */
const wrote = (table: string) => calls.filter((c) => c.table === table && c.op !== 'select')

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calls.length = 0
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    cfg.planRow = { id: 'plan-pro-uuid', limits: { messages: 30000 } }
    cfg.freePlanRow = { id: 'plan-free-uuid', limits: { messages: 100 } }
    cfg.planError = null
    cfg.upsertError = null
    cfg.updateError = null
    cfg.storeUpdateError = null
    cfg.updatedRows = [{ store_id: 'store-1' }]
    cfg.existingSubscription = null
    cfg.subscriptionReadError = null
  })

  describe('signature and metadata guards', () => {
    it('rejects an invalid signature with 400', async () => {
      const res = await POST(makeReq(checkoutBody('pro'), 't=1700000000,v1=deadbeef'))
      expect(res.status).toBe(400)
      expect(writes()).toHaveLength(0)
    })

    it('rejects a checkout session with no store_id/plan metadata', async () => {
      const res = await post(checkoutBody('pro', {}))
      expect(res.status).toBe(400)
      expect(writes()).toHaveLength(0)
    })

    it('rejects an unknown plan with 400 instead of silently defaulting', async () => {
      const res = await post(checkoutBody('enterprise'))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toContain('Unknown plan')
      expect(writes()).toHaveLength(0)
    })

    it('refuses to provision a row it could never link to later Stripe events', async () => {
      // A null stripe_subscription_id makes every customer.subscription.* event
      // for this store a silent no-op.
      const body = JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: { metadata: { store_id: 'store-1', plan: 'pro' }, customer: 'cus_1' } },
      })
      const res = await post(body)
      expect(res.status).toBe(400)
      expect(writes()).toHaveLength(0)
    })
  })

  describe('checkout.session.completed provisioning', () => {
    it('writes the subscription to store_subscriptions, never to the subscription-box table', async () => {
      await post(checkoutBody('pro'))

      // `subscriptions` (036) is the per-customer subscription-BOX table for the
      // vertical; a store's SaaS plan belongs in store_subscriptions (001).
      expect(on('subscriptions')).toHaveLength(0)
      // One replay-check read, then exactly one write.
      expect(wrote('store_subscriptions')).toHaveLength(1)
      expect(wrote('store_subscriptions')[0].op).toBe('upsert')
    })

    it('upserts exactly the columns that exist on store_subscriptions', async () => {
      await post(checkoutBody('pro'))

      const payload = wrote('store_subscriptions')[0].payload!
      expect(Object.keys(payload).sort()).toEqual([...UPSERT_COLUMNS].sort())
    })

    it('upserts the values Stripe supplied, resolving the plan slug to a plan_id', async () => {
      await post(checkoutBody('pro'))

      const payload = wrote('store_subscriptions')[0].payload!
      expect(payload).toMatchObject({
        store_id: 'store-1',
        plan_id: 'plan-pro-uuid', // resolved via subscription_plans, not the slug
        status: 'active',
        stripe_customer_id: 'cus_1',
        stripe_subscription_id: 'sub_1',
      })
      expect(typeof payload.current_period_start).toBe('string')
    })

    it('conflicts on store_id so a repeat event updates rather than duplicating', async () => {
      // Four screens do .eq('store_id', …).single(); a second row breaks them.
      await post(checkoutBody('pro'))
      expect(wrote('store_subscriptions')[0].onConflict).toBe('store_id')
    })

    it('takes the message limit from the plan row, not a hardcoded table', async () => {
      cfg.planRow = { id: 'plan-pro-uuid', limits: { messages: 44444 } }
      await post(checkoutBody('pro'))

      const storeUpdate = on('stores')[0]
      expect(storeUpdate.payload).toEqual({ monthly_message_limit: 44444 })
      expect(storeUpdate.filters).toEqual([['id', 'store-1']])
    })

    it('refuses to provision when the plan row has no numeric message limit', async () => {
      cfg.planRow = { id: 'plan-pro-uuid', limits: {} }
      const res = await post(checkoutBody('pro'))
      expect(res.status).toBe(500)
      expect(on('store_subscriptions')).toHaveLength(0)
    })

    it('returns 400 when the plan slug is absent from subscription_plans', async () => {
      cfg.planRow = null
      const res = await post(checkoutBody('pro'))
      expect(res.status).toBe(400)
      expect(on('store_subscriptions')).toHaveLength(0)
    })

    it('returns 500 (so Stripe retries) when the subscription write fails', async () => {
      cfg.upsertError = { message: 'db down' }
      expect((await post(checkoutBody('pro'))).status).toBe(500)
    })

    it('returns 500 when the message-limit update fails', async () => {
      cfg.storeUpdateError = { message: 'db down' }
      expect((await post(checkoutBody('pro'))).status).toBe(500)
    })

    it('returns 200 on a fully successful provisioning', async () => {
      const res = await post(checkoutBody('pro'))
      expect(res.status).toBe(200)
      expect((await res.json()).received).toBe(true)
    })
  })

  describe('customer.subscription.updated', () => {
    it('matches the row by stripe_subscription_id and stores the period end', async () => {
      const periodEnd = 1735689600
      const res = await post(subscriptionBody('customer.subscription.updated', 'active', periodEnd))
      expect(res.status).toBe(200)

      const update = wrote('store_subscriptions')[0]
      expect(update.filters).toEqual([['stripe_subscription_id', 'sub_1']])
      expect(update.payload).toEqual({
        status: 'active',
        current_period_end: new Date(periodEnd * 1000).toISOString(),
      })
    })

    it('stores past_due verbatim rather than flattening it to active or expired', async () => {
      // 079 widened the CHECK to Stripe's vocabulary so dunning state survives.
      await post(subscriptionBody('customer.subscription.updated', 'past_due', 1735689600))
      expect(wrote('store_subscriptions')[0].payload?.status).toBe('past_due')
    })

    it('stores trialing verbatim', async () => {
      await post(subscriptionBody('customer.subscription.updated', 'trialing', 1735689600))
      expect(wrote('store_subscriptions')[0].payload?.status).toBe('trialing')
    })

    it('omits current_period_end when Stripe does not send one', async () => {
      await post(subscriptionBody('customer.subscription.updated', 'active'))
      expect(wrote('store_subscriptions')[0].payload).toEqual({ status: 'active' })
    })

    it('rejects a status the CHECK constraint would refuse, without writing', async () => {
      const res = await post(subscriptionBody('customer.subscription.updated', 'something_new'))
      expect(res.status).toBe(400)
      expect(writes()).toHaveLength(0)
    })

    it('acknowledges an event for a subscription it does not know about', async () => {
      // Retrying cannot make the row appear, so a 5xx would just loop for 3 days.
      cfg.updatedRows = []
      const res = await post(subscriptionBody('customer.subscription.updated', 'active'))
      expect(res.status).toBe(200)
      expect(on('stores')).toHaveLength(0)
    })

    it('returns 500 when the update itself fails', async () => {
      cfg.updateError = { message: 'db down' }
      expect((await post(subscriptionBody('customer.subscription.updated', 'active'))).status).toBe(500)
    })
  })

  describe('customer.subscription.deleted', () => {
    it("normalises Stripe's 'canceled' to the schema's 'cancelled'", async () => {
      await post(subscriptionBody('customer.subscription.deleted', 'canceled'))
      expect(wrote('store_subscriptions')[0].payload?.status).toBe('cancelled')
    })

    it('downgrades the store to the free plan and its message limit', async () => {
      // Without this the store keeps its Pro allowance after cancelling.
      const res = await post(subscriptionBody('customer.subscription.deleted', 'canceled'))
      expect(res.status).toBe(200)

      expect(wrote('store_subscriptions')[0].payload).toMatchObject({
        status: 'cancelled',
        plan_id: 'plan-free-uuid',
      })
      const storeUpdate = on('stores')[0]
      expect(storeUpdate.payload).toEqual({ monthly_message_limit: 100 })
      expect(storeUpdate.filters).toEqual([['id', ['store-1']]])
    })

    it('downgrades on an updated event that reports the subscription as canceled', async () => {
      await post(subscriptionBody('customer.subscription.updated', 'canceled'))
      expect(wrote('store_subscriptions')[0].payload).toMatchObject({ plan_id: 'plan-free-uuid' })
    })

    it('does not downgrade a subscription that is merely past_due', async () => {
      await post(subscriptionBody('customer.subscription.updated', 'past_due'))
      expect(wrote('store_subscriptions')[0].payload).not.toHaveProperty('plan_id')
      expect(on('stores')).toHaveLength(0)
    })

    it('returns 500 rather than cancelling without a free plan to fall back to', async () => {
      cfg.freePlanRow = null
      const res = await post(subscriptionBody('customer.subscription.deleted', 'canceled'))
      expect(res.status).toBe(500)
      expect(on('store_subscriptions')).toHaveLength(0)
    })

    it('does not half-apply the downgrade when the free plan has no message limit', async () => {
      // Moving plan_id to free while leaving the paid monthly_message_limit would
      // keep handing out the old allowance.
      cfg.freePlanRow = { id: 'plan-free-uuid', limits: {} }
      const res = await post(subscriptionBody('customer.subscription.deleted', 'canceled'))
      expect(res.status).toBe(500)
      expect(writes()).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Replay / out-of-order delivery
//
// Stripe delivers at least once and does not guarantee order. The
// subscription.* events own status and period; checkout.session.completed only
// owns which plan was bought and the Stripe ids.
// ---------------------------------------------------------------------------

describe('POST /api/stripe/webhook — replayed checkout.session.completed', () => {
  beforeEach(() => {
    calls.length = 0
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    cfg.planRow = { id: 'plan-pro-uuid', limits: { messages: 30000 } }
    cfg.freePlanRow = { id: 'plan-free-uuid', limits: { messages: 100 } }
    cfg.planError = null
    cfg.upsertError = null
    cfg.updateError = null
    cfg.storeUpdateError = null
    cfg.existingSubscription = null
    cfg.subscriptionReadError = null
  })

  it('does not reset status or period when the row already tracks this subscription', async () => {
    // A past_due row that a later subscription.updated already wrote.
    cfg.existingSubscription = { stripe_subscription_id: 'sub_1' }

    const res = await post(checkoutBody('pro'))
    expect(res.status).toBe(200)

    const payload = wrote('store_subscriptions')[0].payload!
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('current_period_start')
    // Plan and ids are still reconciled.
    expect(payload).toMatchObject({
      store_id: 'store-1',
      plan_id: 'plan-pro-uuid',
      stripe_subscription_id: 'sub_1',
    })
  })

  it('still stamps the lifecycle for a store with no subscription yet', async () => {
    cfg.existingSubscription = null

    await post(checkoutBody('pro'))

    const payload = wrote('store_subscriptions')[0].payload!
    expect(payload).toMatchObject({ status: 'active' })
    expect(payload).toHaveProperty('current_period_start')
  })

  it('stamps the lifecycle when the store switches to a different subscription', async () => {
    // Re-subscribed after cancelling: a new Stripe subscription id.
    cfg.existingSubscription = { stripe_subscription_id: 'sub_OLD' }

    await post(checkoutBody('pro'))

    const payload = wrote('store_subscriptions')[0].payload!
    expect(payload).toMatchObject({ status: 'active', stripe_subscription_id: 'sub_1' })
    expect(payload).toHaveProperty('current_period_start')
  })

  it('fails loudly rather than guessing when the replay check cannot be read', async () => {
    cfg.subscriptionReadError = { message: 'connection reset' }

    const res = await post(checkoutBody('pro'))
    expect(res.status).toBe(500)
    expect(wrote('store_subscriptions')).toHaveLength(0)
  })
})
