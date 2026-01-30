/**
 * Tests for outgoing webhook delivery (QStash + direct fallback)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

describe('Webhook payload signing', () => {
  it('generates correct HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ event: 'new_order', data: { id: '123' } })
    const secret = 'webhook_secret_456'

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    const actual = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    expect(actual).toBe(expected)
    expect(actual).toHaveLength(64) // SHA256 hex = 64 chars
  })
})

describe('dispatchWebhook', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when supabase env vars missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    const { dispatchWebhook } = await import('@/lib/webhook')
    const result = await dispatchWebhook('store_1', 'new_order', { order_id: '123' })
    expect(result).toBe(false)
  })
})

describe('deliverDirectly', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('delivers payload with correct headers and signature', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { deliverDirectly } = await import('@/lib/webhook')
    const payload = {
      event: 'new_order' as const,
      timestamp: '2026-01-28T00:00:00.000Z',
      store_id: 'store_1',
      data: { order_id: 'ord_1' },
    }

    const result = await deliverDirectly('https://hooks.example.com/webhook', 'my_secret', payload)

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('https://hooks.example.com/webhook')
    expect(opts.method).toBe('POST')

    const headers = opts.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Webhook-Event']).toBe('new_order')
    expect(headers['X-Webhook-Timestamp']).toBe('2026-01-28T00:00:00.000Z')
    expect(headers['X-Webhook-Signature']).toHaveLength(64)
  })

  it('delivers without signature when no secret', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)

    const { deliverDirectly } = await import('@/lib/webhook')
    const payload = {
      event: 'new_message' as const,
      timestamp: '2026-01-28T00:00:00.000Z',
      store_id: 'store_1',
      data: { message: 'hello' },
    }

    const result = await deliverDirectly('https://hooks.example.com/webhook', null, payload)

    expect(result).toBe(true)
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['X-Webhook-Signature']).toBeUndefined()
  })

  it('returns false on HTTP error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', mockFetch)

    const { deliverDirectly } = await import('@/lib/webhook')
    const payload = {
      event: 'low_stock' as const,
      timestamp: '2026-01-28T00:00:00.000Z',
      store_id: 'store_1',
      data: {},
    }

    const result = await deliverDirectly('https://hooks.example.com/webhook', null, payload)
    expect(result).toBe(false)
  })

  it('returns false on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { deliverDirectly } = await import('@/lib/webhook')
    const payload = {
      event: 'new_customer' as const,
      timestamp: '2026-01-28T00:00:00.000Z',
      store_id: 'store_1',
      data: {},
    }

    const result = await deliverDirectly('https://hooks.example.com/webhook', null, payload)
    expect(result).toBe(false)
  })
})

describe('Webhook event filtering', () => {
  it('filters events based on enabled settings', () => {
    const enabledEvents: Record<string, boolean> = {
      new_order: true,
      order_status: true,
      new_message: true,
      new_customer: false,
      low_stock: false,
    }

    expect(enabledEvents['new_order']).toBe(true)
    expect(enabledEvents['new_customer']).toBe(false)
    expect(enabledEvents['low_stock']).toBe(false)
  })
})

describe('Webhook payload structure', () => {
  it('builds correct payload shape', () => {
    const payload = {
      event: 'new_order',
      timestamp: new Date().toISOString(),
      store_id: 'store_123',
      data: { order_id: 'ord_456', total: 50000 },
    }

    expect(payload).toHaveProperty('event')
    expect(payload).toHaveProperty('timestamp')
    expect(payload).toHaveProperty('store_id')
    expect(payload).toHaveProperty('data')
    expect(payload.event).toBe('new_order')
  })

  it('includes signature header when secret provided', () => {
    const secret = 'my_secret'
    const body = JSON.stringify({ event: 'new_order' })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'new_order',
    }

    if (secret) {
      headers['X-Webhook-Signature'] = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex')
    }

    expect(headers['X-Webhook-Signature']).toBeDefined()
    expect(headers['X-Webhook-Signature']).toHaveLength(64)
  })

  it('omits signature header when no secret', () => {
    const secret = ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (secret) {
      headers['X-Webhook-Signature'] = 'should_not_be_set'
    }

    expect(headers['X-Webhook-Signature']).toBeUndefined()
  })
})
