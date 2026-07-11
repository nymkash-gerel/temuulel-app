import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Controllable Supabase write outcomes.
const { sbConfig } = vi.hoisted(() => ({
  sbConfig: {
    upsert: { error: null as { message: string } | null },
    update: { error: null as { message: string } | null },
  },
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabase: () => ({
    from: () => ({
      upsert: () => Promise.resolve(sbConfig.upsert),
      update: () => ({ eq: () => Promise.resolve(sbConfig.update) }),
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

function checkoutBody(plan: string) {
  return JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { metadata: { store_id: 'store-1', plan }, customer: 'cus_1', subscription: 'sub_1' } },
  })
}

describe('POST /api/stripe/webhook (HIGH #7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = SECRET
    sbConfig.upsert = { error: null }
    sbConfig.update = { error: null }
  })

  it('rejects an invalid signature with 400', async () => {
    const body = checkoutBody('pro')
    const res = await POST(makeReq(body, 't=1700000000,v1=deadbeef'))
    expect(res.status).toBe(400)
  })

  it('rejects an unknown plan with 400 instead of silently defaulting', async () => {
    const body = checkoutBody('enterprise') // not in the known set
    const res = await POST(makeReq(body, sign(body)))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Unknown plan')
  })

  it('returns 500 (so Stripe retries) when the subscription write fails', async () => {
    sbConfig.upsert = { error: { message: 'db down' } }
    const body = checkoutBody('pro')
    const res = await POST(makeReq(body, sign(body)))
    expect(res.status).toBe(500)
  })

  it('returns 500 when the message-limit update fails', async () => {
    sbConfig.update = { error: { message: 'db down' } }
    const body = checkoutBody('pro')
    const res = await POST(makeReq(body, sign(body)))
    expect(res.status).toBe(500)
  })

  it('returns 200 on a fully successful provisioning', async () => {
    const body = checkoutBody('pro')
    const res = await POST(makeReq(body, sign(body)))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })
})
