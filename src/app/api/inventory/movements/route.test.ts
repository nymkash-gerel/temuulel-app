/**
 * Tests for GET/POST /api/inventory/movements
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockInsertedItem: Record<string, unknown> | null = null
let mockInsertError: { message: string } | null = null
let mockSelectError: { message: string } | null = null
let mockProduct: { id: string } | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

import { GET, POST } from './route'

function makeRequest(url: string, body?: unknown): Request {
  if (body) {
    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request(url, { method: 'GET' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockData = []
  mockDataCount = 0
  mockInsertedItem = {
    id: 'mov-001',
    product_id: 'a0000000-0000-4000-8000-000000000010',
    variant_id: null,
    location_id: null,
    movement_type: 'received',
    quantity: 50,
    reference_type: 'purchase_order',
    reference_id: 'a0000000-0000-4000-8000-000000000020',
    unit_cost: 1500,
    notes: 'Received from supplier',
    created_at: '2026-02-01T00:00:00Z',
  }
  mockInsertError = null
  mockSelectError = null
  mockProduct = { id: 'a0000000-0000-4000-8000-000000000010' }

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
    if (table === 'inventory_movements') {
      // Chainable + thenable for GET
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // Insert chain for POST
      const insertQuery: Record<string, unknown> = {}
      insertQuery.select = vi.fn(() => insertQuery)
      insertQuery.single = vi.fn().mockResolvedValue({
        data: mockInsertedItem,
        error: mockInsertError,
      })

      return {
        select: vi.fn(() => dataQuery),
        insert: vi.fn(() => insertQuery),
      }
    }
    if (table === 'products') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockProduct }),
        })),
      }
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    }
  })
})

// ---------------------------------------------------------------------------
// GET /api/inventory/movements
// ---------------------------------------------------------------------------
describe('GET /api/inventory/movements', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/inventory/movements') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/inventory/movements') as never)
    expect(res.status).toBe(403)
  })

  it('returns inventory movements list', async () => {
    mockData = [
      { id: 'mov-1', movement_type: 'received', quantity: 50 },
      { id: 'mov-2', movement_type: 'sold', quantity: -3 },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/inventory/movements') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no movements', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/inventory/movements') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports product_id filter', async () => {
    mockData = [{ id: 'mov-1', product_id: 'prod-001', movement_type: 'received' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/inventory/movements?product_id=prod-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports movement_type filter', async () => {
    mockData = [{ id: 'mov-1', movement_type: 'sold' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/inventory/movements?movement_type=sold') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports location_id filter', async () => {
    mockData = [{ id: 'mov-1', location_id: 'loc-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/inventory/movements?location_id=loc-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'mov-1', product_id: 'prod-001', movement_type: 'received', location_id: 'loc-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/inventory/movements?product_id=prod-001&movement_type=received&location_id=loc-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid movement_type filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/inventory/movements?movement_type=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'mov-5' }]
    mockDataCount = 200
    const res = await GET(makeRequest('http://localhost/api/inventory/movements?limit=10&offset=100') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(200)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/inventory/movements') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/inventory/movements
// ---------------------------------------------------------------------------
describe('POST /api/inventory/movements', () => {
  const validBody = {
    product_id: 'a0000000-0000-4000-8000-000000000010',
    movement_type: 'received',
    quantity: 50,
    reference_type: 'purchase_order',
    reference_id: 'a0000000-0000-4000-8000-000000000020',
    unit_cost: 1500,
    notes: 'Received from supplier',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates an inventory movement with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.movement_type).toBe('received')
  })

  it('creates a movement with only required fields', async () => {
    const body = {
      product_id: 'a0000000-0000-4000-8000-000000000010',
      movement_type: 'adjusted',
      quantity: -5,
    }
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', body) as never)
    expect(res.status).toBe(201)
  })

  it('creates a movement with variant_id and location_id', async () => {
    const body = {
      product_id: 'a0000000-0000-4000-8000-000000000010',
      variant_id: 'a0000000-0000-4000-8000-000000000099',
      location_id: 'a0000000-0000-4000-8000-000000000088',
      movement_type: 'transferred',
      quantity: 20,
    }
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', body) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when product_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', {
      movement_type: 'received',
      quantity: 10,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when movement_type is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', {
      product_id: 'a0000000-0000-4000-8000-000000000010',
      quantity: 10,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when quantity is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', {
      product_id: 'a0000000-0000-4000-8000-000000000010',
      movement_type: 'received',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid movement_type value', async () => {
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', {
      product_id: 'a0000000-0000-4000-8000-000000000010',
      movement_type: 'unknown_type',
      quantity: 10,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid product_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', {
      product_id: 'not-a-uuid',
      movement_type: 'received',
      quantity: 10,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if product not found in store', async () => {
    mockProduct = null
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toMatch(/Product not found/)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/inventory/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('accepts all valid movement_type values', async () => {
    for (const mt of ['received', 'sold', 'returned', 'adjusted', 'transferred', 'damaged', 'expired']) {
      const res = await POST(makeRequest('http://localhost/api/inventory/movements', {
        product_id: 'a0000000-0000-4000-8000-000000000010',
        movement_type: mt,
        quantity: 1,
      }) as never)
      expect(res.status).toBe(201)
    }
  })

  it('returns 500 when database insert fails', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/inventory/movements', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
