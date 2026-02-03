import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  edgeRateLimit,
  getEdgeClientIp,
  shouldSkipRateLimit,
  resolveTier,
} from './middleware-rate-limit'

describe('edgeRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests within the limit', () => {
    const key = `test-allow-${Date.now()}`
    const opts = { limit: 5, windowSeconds: 60 }

    const r1 = edgeRateLimit(key, opts)
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(4)
    expect(r1.limit).toBe(5)
  })

  it('tracks remaining correctly across multiple requests', () => {
    const key = `test-track-${Date.now()}`
    const opts = { limit: 3, windowSeconds: 60 }

    const r1 = edgeRateLimit(key, opts)
    expect(r1.remaining).toBe(2)

    const r2 = edgeRateLimit(key, opts)
    expect(r2.remaining).toBe(1)

    const r3 = edgeRateLimit(key, opts)
    expect(r3.remaining).toBe(0)
    expect(r3.success).toBe(true)
  })

  it('blocks requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`
    const opts = { limit: 2, windowSeconds: 60 }

    edgeRateLimit(key, opts)
    edgeRateLimit(key, opts)

    const r3 = edgeRateLimit(key, opts)
    expect(r3.success).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('resets after the window expires', () => {
    const key = `test-reset-${Date.now()}`
    const opts = { limit: 1, windowSeconds: 10 }

    const r1 = edgeRateLimit(key, opts)
    expect(r1.success).toBe(true)

    const r2 = edgeRateLimit(key, opts)
    expect(r2.success).toBe(false)

    vi.advanceTimersByTime(11_000)

    const r3 = edgeRateLimit(key, opts)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('returns a resetAt timestamp in the future', () => {
    const key = `test-resetat-${Date.now()}`
    const opts = { limit: 5, windowSeconds: 30 }

    const r = edgeRateLimit(key, opts)
    expect(r.resetAt).toBeGreaterThan(Date.now())
  })

  it('isolates different keys', () => {
    const opts = { limit: 1, windowSeconds: 60 }

    const r1 = edgeRateLimit(`key-a-${Date.now()}`, opts)
    expect(r1.success).toBe(true)

    const r2 = edgeRateLimit(`key-b-${Date.now()}`, opts)
    expect(r2.success).toBe(true)
  })
})

describe('getEdgeClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    })
    expect(getEdgeClientIp(req)).toBe('192.168.1.1')
  })

  it('returns "unknown" when header is missing', () => {
    const req = new Request('http://localhost')
    expect(getEdgeClientIp(req)).toBe('unknown')
  })

  it('trims whitespace from IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  10.0.0.1  ' },
    })
    expect(getEdgeClientIp(req)).toBe('10.0.0.1')
  })
})

describe('shouldSkipRateLimit', () => {
  it('exempts webhook paths', () => {
    expect(shouldSkipRateLimit('/api/webhook/deliver')).toBe(true)
    expect(shouldSkipRateLimit('/api/webhook/messenger')).toBe(true)
    expect(shouldSkipRateLimit('/api/webhook/telegram')).toBe(true)
    expect(shouldSkipRateLimit('/api/webhook/delivery')).toBe(true)
  })

  it('exempts cron paths', () => {
    expect(shouldSkipRateLimit('/api/cron/daily-report')).toBe(true)
  })

  it('exempts health endpoint', () => {
    expect(shouldSkipRateLimit('/api/health')).toBe(true)
  })

  it('does not exempt regular API paths', () => {
    expect(shouldSkipRateLimit('/api/orders')).toBe(false)
    expect(shouldSkipRateLimit('/api/chat/ai')).toBe(false)
    expect(shouldSkipRateLimit('/api/auth/callback')).toBe(false)
  })

  it('does not exempt health subpaths', () => {
    expect(shouldSkipRateLimit('/api/health/check')).toBe(false)
  })
})

describe('resolveTier', () => {
  it('returns strict limits for auth routes', () => {
    expect(resolveTier('/api/auth/callback')).toEqual({ limit: 20, windowSeconds: 60 })
    expect(resolveTier('/api/auth/facebook')).toEqual({ limit: 20, windowSeconds: 60 })
    expect(resolveTier('/api/driver/auth/register')).toEqual({ limit: 20, windowSeconds: 60 })
  })

  it('returns strict limits for AI routes', () => {
    expect(resolveTier('/api/chat/ai')).toEqual({ limit: 15, windowSeconds: 60 })
    expect(resolveTier('/api/products/enrich')).toEqual({ limit: 10, windowSeconds: 60 })
    expect(resolveTier('/api/analytics/insights')).toEqual({ limit: 10, windowSeconds: 60 })
  })

  it('returns strict limits for batch generation', () => {
    expect(resolveTier('/api/commissions/generate')).toEqual({ limit: 5, windowSeconds: 60 })
    expect(resolveTier('/api/driver-payouts/generate')).toEqual({ limit: 5, windowSeconds: 60 })
  })

  it('returns moderate limits for financial routes', () => {
    expect(resolveTier('/api/pos/checkout')).toEqual({ limit: 30, windowSeconds: 60 })
    expect(resolveTier('/api/payments/create')).toEqual({ limit: 20, windowSeconds: 60 })
    expect(resolveTier('/api/orders')).toEqual({ limit: 20, windowSeconds: 60 })
  })

  it('returns analytics limits for analytics routes', () => {
    expect(resolveTier('/api/analytics/stats')).toEqual({ limit: 30, windowSeconds: 60 })
    expect(resolveTier('/api/analytics/delivery')).toEqual({ limit: 30, windowSeconds: 60 })
  })

  it('returns default for unmatched API routes', () => {
    expect(resolveTier('/api/customers')).toEqual({ limit: 60, windowSeconds: 60 })
    expect(resolveTier('/api/products')).toEqual({ limit: 60, windowSeconds: 60 })
    expect(resolveTier('/api/some-random-route')).toEqual({ limit: 60, windowSeconds: 60 })
  })

  it('matches compute-heavy routes', () => {
    expect(resolveTier('/api/driver/deliveries/optimize')).toEqual({ limit: 10, windowSeconds: 60 })
  })
})
