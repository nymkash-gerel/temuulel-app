import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, getClientIp } from './rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    // Reset module state between tests by using unique keys
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests within the limit', () => {
    const key = `test-allow-${Date.now()}`
    const opts = { limit: 5, windowSeconds: 60 }

    const r1 = rateLimit(key, opts)
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(4)
    expect(r1.limit).toBe(5)
  })

  it('tracks remaining correctly across multiple requests', () => {
    const key = `test-track-${Date.now()}`
    const opts = { limit: 3, windowSeconds: 60 }

    const r1 = rateLimit(key, opts)
    expect(r1.remaining).toBe(2)

    const r2 = rateLimit(key, opts)
    expect(r2.remaining).toBe(1)

    const r3 = rateLimit(key, opts)
    expect(r3.remaining).toBe(0)
    expect(r3.success).toBe(true)
  })

  it('blocks requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`
    const opts = { limit: 2, windowSeconds: 60 }

    rateLimit(key, opts) // 1
    rateLimit(key, opts) // 2

    const r3 = rateLimit(key, opts) // 3 — over limit
    expect(r3.success).toBe(false)
    expect(r3.remaining).toBe(0)
  })

  it('resets after the window expires', () => {
    const key = `test-reset-${Date.now()}`
    const opts = { limit: 1, windowSeconds: 10 }

    const r1 = rateLimit(key, opts)
    expect(r1.success).toBe(true)

    const r2 = rateLimit(key, opts)
    expect(r2.success).toBe(false)

    // Advance time past the window
    vi.advanceTimersByTime(11_000)

    const r3 = rateLimit(key, opts)
    expect(r3.success).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('returns a resetAt timestamp in the future', () => {
    const key = `test-resetat-${Date.now()}`
    const opts = { limit: 5, windowSeconds: 30 }

    const r = rateLimit(key, opts)
    expect(r.resetAt).toBeGreaterThan(Date.now())
  })

  it('isolates different keys', () => {
    const opts = { limit: 1, windowSeconds: 60 }

    const r1 = rateLimit(`key-a-${Date.now()}`, opts)
    expect(r1.success).toBe(true)

    const r2 = rateLimit(`key-b-${Date.now()}`, opts)
    expect(r2.success).toBe(true)
  })

  it('handles limit of 1 correctly', () => {
    const key = `test-limit1-${Date.now()}`
    const opts = { limit: 1, windowSeconds: 60 }

    const r1 = rateLimit(key, opts)
    expect(r1.success).toBe(true)
    expect(r1.remaining).toBe(0)

    const r2 = rateLimit(key, opts)
    expect(r2.success).toBe(false)
    expect(r2.remaining).toBe(0)
  })
})

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('192.168.1.1')
  })

  it('returns first IP when multiple are present', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('returns "unknown" when header is missing', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })

  it('returns "unknown" for empty header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '' },
    })
    expect(getClientIp(req)).toBe('unknown')
  })

  it('trims whitespace from IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  10.0.0.1  ' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })
})
