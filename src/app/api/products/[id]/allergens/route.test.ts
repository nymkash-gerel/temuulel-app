/**
 * Tests for PATCH /api/products/:id/allergens
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
    allergens: ['gluten', 'dairy'],
    spicy_level: 0,
    is_vegan: false,
    is_halal: false,
    is_gluten_free: false,
    dietary_tags: [],
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

describe('PATCH /api/products/:id/allergens', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { allergens: ['nuts'] }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store found', async () => {
    mockStore = null
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { allergens: ['nuts'] }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(403)
  })

  it('updates allergens list', async () => {
    mockProduct = { ...mockProduct, allergens: ['nuts', 'soy'] }
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { allergens: ['nuts', 'soy'] }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.allergens).toEqual(['nuts', 'soy'])
  })

  it('updates spicy level', async () => {
    mockProduct = { ...mockProduct, spicy_level: 3 }
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { spicy_level: 3 }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.spicy_level).toBe(3)
  })

  it('rejects spicy_level above 5', async () => {
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { spicy_level: 6 }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(400)
  })

  it('updates dietary flags', async () => {
    mockProduct = { ...mockProduct, is_vegan: true, is_halal: true, is_gluten_free: true }
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', {
      is_vegan: true,
      is_halal: true,
      is_gluten_free: true,
    }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.is_vegan).toBe(true)
    expect(json.is_halal).toBe(true)
    expect(json.is_gluten_free).toBe(true)
  })

  it('updates dietary_tags', async () => {
    mockProduct = { ...mockProduct, dietary_tags: ['keto', 'low-carb'] }
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { dietary_tags: ['keto', 'low-carb'] }, 'PATCH')
    const res = await PATCH(req, makeParams())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.dietary_tags).toEqual(['keto', 'low-carb'])
  })

  it('returns 404 if product not found', async () => {
    mockProduct = null
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { allergens: ['nuts'] }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 500 on update error', async () => {
    mockUpdateError = { message: 'DB error' }
    mockProduct = null
    const req = createTestJsonRequest('http://localhost/api/products/x/allergens', { allergens: ['nuts'] }, 'PATCH')
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(500)
  })
})
