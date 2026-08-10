/**
 * Auth guard for GET /api/cron/broadcast.
 *
 * The previous guard compared the Authorization header to
 * process.env.CRON_SECRET directly:
 *
 *   const secret = req.headers.get('authorization')?.replace('Bearer ', '')
 *   if (secret !== process.env.CRON_SECRET) return 401
 *
 * With the variable unset and no header, both sides were `undefined`, so the
 * comparison was false and the request proceeded — anyone could trigger a
 * broadcast send through the service-role client. These tests pin the
 * fail-closed behaviour the other three cron routes already had.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://placeholder.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'placeholder'

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/messenger', () => ({
  sendTextMessage: vi.fn(async () => ({ success: true })),
}))

import { GET } from './route'

/** No campaigns due, so a request that passes the guard returns processed: 0. */
function noCampaigns() {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    eq: self,
    lte: () => Promise.resolve({ data: [], error: null }),
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
  mockFrom.mockReturnValue(noCampaigns())
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/** `undefined` for the secret means the variable is not set at all. */
function setEnv(nodeEnv: string, secret?: string) {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.stubEnv('CRON_SECRET', secret as string)
}

describe('GET /api/cron/broadcast — auth guard', () => {
  it('fails closed in production when CRON_SECRET is unset', async () => {
    setEnv('production', undefined)
    const res = await GET(req())
    expect(res.status).toBe(500)
    // Nothing was read, so nothing could have been sent.
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('fails closed in production even if a caller supplies a bearer token', async () => {
    setEnv('production', undefined)
    const res = await GET(req('Bearer anything'))
    expect(res.status).toBe(500)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects a wrong token when CRON_SECRET is configured', async () => {
    setEnv('production', 'right-secret')
    const res = await GET(req('Bearer wrong-secret'))
    expect(res.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects a missing header when CRON_SECRET is configured', async () => {
    setEnv('production', 'right-secret')
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('accepts the correct token', async () => {
    setEnv('production', 'right-secret')
    const res = await GET(req('Bearer right-secret'))
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalled()
  })

  it('still allows unauthenticated local runs in development', async () => {
    setEnv('development', undefined)
    const res = await GET(req())
    expect(res.status).toBe(200)
  })
})
