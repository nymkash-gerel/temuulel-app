/**
 * Tests for GET/POST /api/processing
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

// Additional state for POST flow
let mockExistingOrder: Record<string, unknown> | null = null
let mockFetchError: { message: string } | null = null
let mockUpdatedOrder: Record<string, unknown> | null = null
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
  mockInsertedItem = null
  mockInsertError = null
  mockSelectError = null
  mockExistingOrder = { id: 'order-001', status: 'processing' }
  mockFetchError = null
  mockUpdatedOrder = {
    id: 'order-001',
    order_number: 'LO-001',
    status: 'washing',
    total_items: 3,
    total_amount: 5000,
    rush_order: false,
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    laundry_items: [],
    customers: null,
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
    if (table === 'laundry_orders') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.in = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // For the order fetch in POST (select -> eq -> eq -> single)
      const fetchQuery: Record<string, unknown> = {}
      fetchQuery.eq = vi.fn(() => fetchQuery)
      fetchQuery.single = vi.fn().mockResolvedValue({ data: mockExistingOrder, error: mockFetchError })

      // For update chain (update -> eq -> eq -> select -> single)
      const updateSelectQuery: Record<string, unknown> = {}
      updateSelectQuery.single = vi.fn().mockResolvedValue({ data: mockUpdatedOrder, error: mockUpdateError })

      return {
        select: vi.fn((fields?: string) => {
          // Distinguish between GET listing query and POST fetch query
          if (fields && fields.includes('order_number') && fields.includes('laundry_items')) {
            return dataQuery
          }
          // POST: fetch existing order (id, status)
          return fetchQuery
        }),
        update: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          select: vi.fn(() => updateSelectQuery),
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
// GET /api/processing
// ---------------------------------------------------------------------------
describe('GET /api/processing', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/processing') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/processing') as never)
    expect(res.status).toBe(403)
  })

  it('returns processing orders list', async () => {
    mockData = [
      { id: 'lo-1', order_number: 'LO-001', status: 'washing', total_items: 3 },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/processing') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no orders in processing', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/processing') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter with valid processing status', async () => {
    mockData = [{ id: 'lo-1', status: 'drying' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/processing?status=drying') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('defaults to all processing statuses when no status filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/processing') as never)
    expect(res.status).toBe(200)
  })

  it('defaults to all processing statuses for invalid status value', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/processing?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'lo-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/processing?limit=25&offset=50') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/processing') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/processing
// ---------------------------------------------------------------------------
describe('POST /api/processing', () => {
  const validBody = {
    order_id: 'a0000000-0000-4000-8000-000000000001',
    status: 'washing',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/processing', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/processing', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('updates order status successfully', async () => {
    const res = await POST(makeRequest('http://localhost/api/processing', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('order-001')
  })

  it('accepts all valid processing statuses', async () => {
    for (const s of ['processing', 'washing', 'drying', 'ironing', 'ready']) {
      const res = await POST(makeRequest('http://localhost/api/processing', {
        order_id: 'a0000000-0000-4000-8000-000000000001',
        status: s,
      }) as never)
      expect(res.status).toBe(200)
    }
  })

  it('returns 400 when order_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/processing', {
      status: 'washing',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when status is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/processing', {
      order_id: 'a0000000-0000-4000-8000-000000000001',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await POST(makeRequest('http://localhost/api/processing', {
      order_id: 'a0000000-0000-4000-8000-000000000001',
      status: 'cancelled',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid order_id format', async () => {
    const res = await POST(makeRequest('http://localhost/api/processing', {
      order_id: 'not-a-uuid',
      status: 'washing',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/processing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 when order not found in store', async () => {
    mockExistingOrder = null
    const res = await POST(makeRequest('http://localhost/api/processing', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Order not found')
  })

  it('returns 500 when update fails', async () => {
    mockUpdateError = { message: 'Update failed' }
    const res = await POST(makeRequest('http://localhost/api/processing', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Update failed')
  })
})
