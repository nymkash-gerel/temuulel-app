/**
 * Tests for GET/POST /api/laundry-orders
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockSelectError: { message: string } | null = null

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

// Reusable mock variables for POST flow
let mockOrderInsertError: { message: string } | null = null
let mockItemsInsertError: { message: string } | null = null
let mockFetchError: { message: string } | null = null
let mockFullOrder: Record<string, unknown> | null = null

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockData = []
  mockDataCount = 0
  mockSelectError = null
  mockOrderInsertError = null
  mockItemsInsertError = null
  mockFetchError = null
  mockFullOrder = {
    id: 'order-001',
    customer_id: null,
    order_number: 'LO-001',
    status: 'received',
    total_items: 2,
    total_amount: 3000,
    paid_amount: 0,
    rush_order: false,
    pickup_date: null,
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    customers: null,
    laundry_items: [
      { id: 'item-001', item_type: 'shirt', service_type: 'wash_fold', quantity: 2, unit_price: 1500 },
    ],
  }

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
    if (table === 'laundry_orders') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.single = vi.fn().mockResolvedValue({ data: mockFullOrder, error: mockFetchError })
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      return {
        select: vi.fn(() => dataQuery),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'order-001' }, error: mockOrderInsertError }),
          })),
        })),
      }
    }
    if (table === 'laundry_items') {
      return {
        insert: vi.fn().mockResolvedValue({ error: mockItemsInsertError }),
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
// GET /api/laundry-orders
// ---------------------------------------------------------------------------
describe('GET /api/laundry-orders', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/laundry-orders') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/laundry-orders') as never)
    expect(res.status).toBe(403)
  })

  it('returns laundry orders list', async () => {
    mockData = [
      { id: 'lo-1', order_number: 'LO-001', status: 'received', total_items: 3, total_amount: 5000 },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/laundry-orders') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no orders', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/laundry-orders') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'lo-1', status: 'washing' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/laundry-orders?status=washing') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports customer_id filter', async () => {
    mockData = [{ id: 'lo-1', customer_id: 'cust-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/laundry-orders?customer_id=cust-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'lo-5' }]
    mockDataCount = 50
    const res = await GET(makeRequest('http://localhost/api/laundry-orders?limit=10&offset=20') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/laundry-orders?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/laundry-orders') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/laundry-orders
// ---------------------------------------------------------------------------
describe('POST /api/laundry-orders', () => {
  const validBody = {
    order_number: 'LO-001',
    items: [
      { item_type: 'shirt', unit_price: 1500, quantity: 2 },
    ],
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a laundry order with valid data', async () => {
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('order-001')
  })

  it('creates an order with all optional fields', async () => {
    const fullBody = {
      order_number: 'LO-002',
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      rush_order: true,
      pickup_date: '2026-02-05',
      notes: 'Handle with care',
      items: [
        { item_type: 'suit', service_type: 'dry_clean', quantity: 1, unit_price: 5000, notes: 'Delicate fabric' },
        { item_type: 'pants', service_type: 'press_only', quantity: 3, unit_price: 2000 },
      ],
    }
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', fullBody) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when order_number is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', {
      items: [{ item_type: 'shirt', unit_price: 1500 }],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', {
      order_number: 'LO-003',
      items: [],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', {
      order_number: 'LO-004',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when item is missing unit_price', async () => {
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', {
      order_number: 'LO-005',
      items: [{ item_type: 'shirt' }],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/laundry-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 when order insert fails', async () => {
    mockOrderInsertError = { message: 'Order insert failed' }
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Order insert failed')
  })

  it('returns 500 when items insert fails', async () => {
    mockItemsInsertError = { message: 'Items insert failed' }
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Items insert failed')
  })

  it('returns 500 when final fetch fails', async () => {
    mockFetchError = { message: 'Fetch failed' }
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Fetch failed')
  })

  it('returns 400 for invalid customer_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/laundry-orders', {
      order_number: 'LO-006',
      customer_id: 'not-a-uuid',
      items: [{ item_type: 'shirt', unit_price: 1500 }],
    }) as never)
    expect(res.status).toBe(400)
  })
})
