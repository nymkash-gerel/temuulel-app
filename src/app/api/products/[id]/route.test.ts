/**
 * Tests for PATCH /api/products/[id]
 *
 * This handler did not exist: dashboard/menu/[id] already PATCHed here, so
 * every menu-item edit came back 405 and silently failed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestJsonRequest } from '@/lib/test-utils'

let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockProduct: { id: string } | null = null
let mockUpdateError: { message: string } | null = null
let capturedUpdate: Record<string, unknown> | null = null
let capturedStoreEq: string | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/resolve-store', () => ({
  resolveStore: vi.fn(async () => mockStore),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { PATCH } from './route'

const PRODUCT_ID = 'a1b2c3d4-e5f6-4789-ab01-234567890abc'
const params = Promise.resolve({ id: PRODUCT_ID })

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockProduct = { id: PRODUCT_ID }
  mockUpdateError = null
  capturedUpdate = null
  capturedStoreEq = null

  mockFrom.mockImplementation((table: string) => {
    if (table !== 'products') throw new Error(`unexpected table ${table}`)
    return {
      // ownership pre-check: .select().eq('id').eq('store_id').single()
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn((col: string, val: string) => {
            if (col === 'store_id') capturedStoreEq = val
            return { single: vi.fn().mockResolvedValue({ data: mockProduct }) }
          }),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        capturedUpdate = payload
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockUpdateError ? null : { id: PRODUCT_ID, ...payload },
                  error: mockUpdateError,
                }),
              })),
            })),
          })),
        }
      }),
    }
  })
})

function patch(body: unknown) {
  return PATCH(
    createTestJsonRequest(`http://localhost/api/products/${PRODUCT_ID}`, body),
    { params }
  )
}

describe('PATCH /api/products/[id]', () => {
  it('updates the changed fields and returns the product', async () => {
    const res = await patch({ name: 'Шинэ нэр', base_price: 12000 })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.product.name).toBe('Шинэ нэр')
    expect(capturedUpdate).toEqual({ name: 'Шинэ нэр', base_price: 12000 })
  })

  it('scopes the update to the caller store, not just the id', async () => {
    await patch({ name: 'x' })
    expect(capturedStoreEq).toBe('store-001')
  })

  it('rejects an unauthenticated caller', async () => {
    mockUser = null
    const res = await patch({ name: 'x' })
    expect(res.status).toBe(401)
  })

  it('404s when the product belongs to another store', async () => {
    mockProduct = null
    const res = await patch({ name: 'x' })
    expect(res.status).toBe(404)
  })

  it('404s when the user has no store', async () => {
    mockStore = null
    const res = await patch({ name: 'x' })
    expect(res.status).toBe(404)
  })

  it('rejects an empty patch rather than issuing a no-op update', async () => {
    const res = await patch({})
    expect(res.status).toBe(400)
  })

  it('rejects an invalid status value', async () => {
    const res = await patch({ status: 'bogus' })
    expect(res.status).toBe(400)
  })

  it('rejects a negative price', async () => {
    const res = await patch({ base_price: -1 })
    expect(res.status).toBe(400)
  })

  it('accepts null to clear an optional text field', async () => {
    const res = await patch({ sku: null })
    expect(res.status).toBe(200)
    expect(capturedUpdate).toEqual({ sku: null })
  })

  it('surfaces a database error as 500', async () => {
    mockUpdateError = { message: 'boom' }
    const res = await patch({ name: 'x' })
    expect(res.status).toBe(500)
  })
})
