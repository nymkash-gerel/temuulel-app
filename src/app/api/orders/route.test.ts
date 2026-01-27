/**
 * Tests for POST /api/orders — order creation with shipping calculation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock notifications
vi.mock('@/lib/notifications', () => ({
  dispatchNotification: vi.fn(),
}))

// Mock rate-limit to always allow
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 10, remaining: 9, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// Set dummy env vars so getSupabase() guard passes (createClient is mocked)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Supabase mock state
let mockStore: Record<string, unknown> | null = null
let mockInsertedOrder: Record<string, unknown> | null = null
let mockOrderInsertError: { message: string } | null = null
let mockItemsInsertError: { message: string } | null = null

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockStore }),
            })),
          })),
        }
      }
      if (table === 'orders') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: mockInsertedOrder,
                error: mockOrderInsertError,
              }),
            })),
          })),
        }
      }
      if (table === 'order_items') {
        return {
          insert: vi.fn().mockResolvedValue({ error: mockItemsInsertError }),
        }
      }
      return {}
    }),
  })),
}))

import { dispatchNotification } from '@/lib/notifications'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Request
}

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = {
      id: 'store_1',
      shipping_settings: {
        free_shipping_enabled: true,
        free_shipping_minimum: 50000,
        zones: [
          { name: 'Улаанбаатар хот (төв)', price: 5000, estimatedDays: '1-2 өдөр', enabled: true },
          { name: 'Дархан, Эрдэнэт', price: 10000, estimatedDays: '2-4 өдөр', enabled: true },
          { name: 'Бусад аймаг', price: 15000, estimatedDays: '3-7 өдөр', enabled: false },
        ],
      },
    }
    mockInsertedOrder = {
      id: 'order_abc',
      order_number: 'ORD-123',
      total_amount: 55000,
      shipping_amount: 5000,
      status: 'pending',
      payment_status: 'pending',
      created_at: '2026-01-28T00:00:00Z',
    }
    mockOrderInsertError = null
    mockItemsInsertError = null
  })

  // --- Validation ---

  it('returns 400 if store_id is missing', async () => {
    const res = await POST(makeRequest({ items: [{ unit_price: 1000 }] }) as never)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/store_id/)
  })

  it('returns 400 if items is missing', async () => {
    const res = await POST(makeRequest({ store_id: 'store_1' }) as never)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/items/)
  })

  it('returns 400 if items is empty array', async () => {
    const res = await POST(makeRequest({ store_id: 'store_1', items: [] }) as never)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/items/)
  })

  it('returns 400 if an item has negative unit_price', async () => {
    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: -100 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/unit_price/)
  })

  it('returns 400 if an item has zero quantity', async () => {
    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 1000, quantity: 0 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/quantity/)
  })

  it('returns 404 if store not found', async () => {
    mockStore = null
    const res = await POST(makeRequest({
      store_id: 'nonexistent',
      items: [{ unit_price: 1000 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toMatch(/Store not found/)
  })

  // --- Shipping calculation ---

  it('applies shipping zone price when subtotal is below free shipping minimum', async () => {
    mockInsertedOrder = {
      id: 'order_abc',
      order_number: 'ORD-123',
      total_amount: 30000 + 5000,
      shipping_amount: 5000,
      status: 'pending',
      payment_status: 'pending',
      created_at: '2026-01-28T00:00:00Z',
    }

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 15000, quantity: 2 }],
      shipping_zone: 'Улаанбаатар хот (төв)',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.subtotal).toBe(30000)
    expect(json.shipping_amount).toBe(5000)
    expect(json.total_amount).toBe(35000)
  })

  it('applies free shipping when subtotal meets minimum', async () => {
    mockInsertedOrder = {
      id: 'order_abc',
      order_number: 'ORD-123',
      total_amount: 60000,
      shipping_amount: 0,
      status: 'pending',
      payment_status: 'pending',
      created_at: '2026-01-28T00:00:00Z',
    }

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 30000, quantity: 2 }],
      shipping_zone: 'Улаанбаатар хот (төв)',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.subtotal).toBe(60000)
    expect(json.shipping_amount).toBe(0)
  })

  it('returns 0 shipping when zone is disabled', async () => {
    mockInsertedOrder = {
      id: 'order_abc',
      order_number: 'ORD-123',
      total_amount: 10000,
      shipping_amount: 0,
      status: 'pending',
      payment_status: 'pending',
      created_at: '2026-01-28T00:00:00Z',
    }

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 10000 }],
      shipping_zone: 'Бусад аймаг',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.shipping_amount).toBe(0)
  })

  it('returns 0 shipping when no zone specified', async () => {
    mockInsertedOrder = {
      id: 'order_abc',
      order_number: 'ORD-123',
      total_amount: 10000,
      shipping_amount: 0,
      status: 'pending',
      payment_status: 'pending',
      created_at: '2026-01-28T00:00:00Z',
    }

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 10000 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.shipping_amount).toBe(0)
  })

  // --- Order creation ---

  it('creates order and dispatches notification on success', async () => {
    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ product_id: 'p1', unit_price: 25000, quantity: 2 }],
      shipping_zone: 'Улаанбаатар хот (төв)',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.order_id).toBe('order_abc')
    expect(json.status).toBe('pending')
    expect(json.payment_status).toBe('pending')

    expect(dispatchNotification).toHaveBeenCalledTimes(1)
    expect(dispatchNotification).toHaveBeenCalledWith('store_1', 'new_order', {
      order_id: 'order_abc',
      order_number: 'ORD-123',
      total_amount: mockInsertedOrder!.total_amount,
      payment_method: null,
    })
  })

  it('returns 500 if order insert fails', async () => {
    mockInsertedOrder = null
    mockOrderInsertError = { message: 'DB error' }

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 1000 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })

  it('returns 500 if order_items insert fails', async () => {
    mockItemsInsertError = { message: 'Items insert error' }

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 1000 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Items insert error')
  })

  // --- Rate limiting ---

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 60000,
    })

    const res = await POST(makeRequest({
      store_id: 'store_1',
      items: [{ unit_price: 1000 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(429)
    expect(json.error).toMatch(/Too many requests/)
  })
})
