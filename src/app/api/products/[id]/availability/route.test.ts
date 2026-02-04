/**
 * Tests for PATCH /api/products/:id/availability
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestJsonRequest } from '@/lib/test-utils'

let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockProduct: Record<string, unknown> | null = null
let mockUpdateError: { message: string } | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

import { PATCH } from './route'

const PRODUCT_ID = 'prod-001'

function makeParams() {
  return { params: Promise.resolve({ id: PRODUCT_ID }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockProduct = {
    id: PRODUCT_ID,
    name: 'Бууз',
    available_today: true,
    daily_limit: 100,
    daily_sold: 0,
    sold_out: false,
    updated_at: '2026-01-30T00:00:00Z',
  }
  mockUpdateError = null

  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockStore }),
          })),
        })),
      }
    }
    if (table === 'products') {
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: mockProduct, error: mockUpdateError }),
              })),
            })),
          })),
        })),
      }
    }
    return {}
  })
})

describe('PATCH /api/products/:id/availability', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { sold_out: true }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store found', async () => {
    mockStore = null
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { sold_out: true }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(403)
  })

  it('marks product as sold out', async () => {
    mockProduct = { ...mockProduct, sold_out: true }
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { sold_out: true }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.sold_out).toBe(true)
  })

  it('updates daily limit', async () => {
    mockProduct = { ...mockProduct, daily_limit: 50 }
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { daily_limit: 50 }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.daily_limit).toBe(50)
  })

  it('toggles available_today', async () => {
    mockProduct = { ...mockProduct, available_today: false }
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { available_today: false }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.available_today).toBe(false)
  })

  it('returns 404 if product not found', async () => {
    mockProduct = null
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { sold_out: true }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 500 on update error', async () => {
    mockUpdateError = { message: 'DB error' }
    mockProduct = null
    const req = createTestJsonRequest('http://localhost/api/products/x/availability', { sold_out: true }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(500)
  })
})
