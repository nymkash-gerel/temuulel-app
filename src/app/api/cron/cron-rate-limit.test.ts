/**
 * Pre-auth rate limiting for the three cron routes that lacked it.
 *
 * broadcast got this in PR #13; daily-report, payment-followup and
 * reactivate-delayed had the fail-closed CRON_SECRET guard but nothing ahead
 * of it — an unauthenticated caller could grind bearer tokens at full speed.
 * The 429 must fire BEFORE the auth check and before any database read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder'

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/email', () => ({
  sendDailyReportEmail: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/qpay', () => ({
  isQPayConfigured: () => false,
  createQPayInvoice: vi.fn(),
}))
vi.mock('@/lib/messenger', () => ({
  sendTextMessage: vi.fn(async () => ({ success: true })),
  sendQuickReplies: vi.fn(async () => ({ success: true })),
}))

const { limiter } = vi.hoisted(() => ({ limiter: { success: true } }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ ...limiter, limit: 30, remaining: 29, resetAt: 0 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { GET as dailyReport } from './daily-report/route'
import { GET as paymentFollowup } from './payment-followup/route'
import { GET as reactivateDelayed } from './reactivate-delayed/route'

/** Every query resolves empty so a request that passes the guards completes. */
function emptyChain() {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self, eq: self, lte: self, not: self, order: self, limit: self,
    update: self, insert: self,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
  })
  return chain
}

function req(authHeader?: string) {
  return {
    headers: { get: (k: string) => (k === 'authorization' ? authHeader ?? null : null) },
  } as unknown as import('next/server').NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue(emptyChain())
  limiter.success = true
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const ROUTES = [
  ['daily-report', dailyReport],
  ['payment-followup', paymentFollowup],
  ['reactivate-delayed', reactivateDelayed],
] as const

describe.each(ROUTES)('GET /api/cron/%s — pre-auth rate limit', (_name, GET) => {
  it('returns 429 before the auth check — even a valid token is limited', async () => {
    limiter.success = false
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'right-secret')
    const res = await GET(req('Bearer right-secret'))
    expect(res.status).toBe(429)
    // Nothing was read: the limiter fired before auth and before any query.
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('a limited caller with a WRONG token also gets 429, not 401', async () => {
    // 401 would confirm the token was checked — the limiter must answer first,
    // so a grinder learns nothing about which tokens are wrong.
    limiter.success = false
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'right-secret')
    const res = await GET(req('Bearer wrong-secret'))
    expect(res.status).toBe(429)
  })

  it('an allowed caller with the correct token still gets through', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', 'right-secret')
    const res = await GET(req('Bearer right-secret'))
    expect(res.status).toBe(200)
  })

  it('the fail-closed CRON_SECRET guard is untouched', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', undefined as unknown as string)
    const res = await GET(req())
    expect(res.status).toBe(500)
  })
})
