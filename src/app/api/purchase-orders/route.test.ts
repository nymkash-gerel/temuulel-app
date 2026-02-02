/**
 * Tests for GET/POST /api/purchase-orders
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
let mockSupplier: { id: string } | null = null
let mockItemsInsertError: { message: string } | null = null
let mockFetchError: { message: string } | null = null

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

const fullPo = {
  id: 'po-001',
  supplier_id: 'a0000000-0000-4000-8000-000000000001',
  po_number: 'PO-2026-001',
  status: 'draft',
  total_amount: 15000,
  expected_date: '2026-03-01',
  received_date: null,
  notes: 'Urgent order',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
  suppliers: { id: 'a0000000-0000-4000-8000-000000000001', name: 'Acme' },
  purchase_order_items: [
    { id: 'poi-1', product_id: 'prod-1', variant_id: null, quantity_ordered: 10, quantity_received: 0, unit_cost: 1500 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockData = []
  mockDataCount = 0
  mockInsertedItem = { id: 'po-001' }
  mockInsertError = null
  mockSelectError = null
  mockSupplier = { id: 'a0000000-0000-4000-8000-000000000001' }
  mockItemsInsertError = null
  mockFetchError = null

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
    if (table === 'purchase_orders') {
      // Chainable + thenable for GET (supports .eq().order().range() then await)
      // Also supports .eq().single() for the fetch-after-insert in POST
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.single = vi.fn().mockResolvedValue({
        data: fullPo,
        error: mockFetchError,
      })
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // Insert chain for POST (.select().single())
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
    if (table === 'suppliers') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockSupplier }),
        })),
      }
    }
    if (table === 'purchase_order_items') {
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
// GET /api/purchase-orders
// ---------------------------------------------------------------------------
describe('GET /api/purchase-orders', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/purchase-orders') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/purchase-orders') as never)
    expect(res.status).toBe(403)
  })

  it('returns purchase orders list', async () => {
    mockData = [
      { id: 'po-1', po_number: 'PO-001', status: 'draft', total_amount: 15000 },
      { id: 'po-2', po_number: 'PO-002', status: 'sent', total_amount: 30000 },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/purchase-orders') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no purchase orders', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/purchase-orders') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'po-1', status: 'draft' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/purchase-orders?status=draft') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports supplier_id filter', async () => {
    mockData = [{ id: 'po-1', supplier_id: 'sup-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/purchase-orders?supplier_id=sup-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined status and supplier_id filters', async () => {
    mockData = [{ id: 'po-1', status: 'confirmed', supplier_id: 'sup-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/purchase-orders?status=confirmed&supplier_id=sup-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/purchase-orders?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'po-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/purchase-orders?limit=25&offset=50') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/purchase-orders') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/purchase-orders
// ---------------------------------------------------------------------------
describe('POST /api/purchase-orders', () => {
  const validBody = {
    supplier_id: 'a0000000-0000-4000-8000-000000000001',
    po_number: 'PO-2026-001',
    expected_date: '2026-03-01',
    notes: 'Urgent order',
    items: [
      { product_id: 'a0000000-0000-4000-8000-000000000010', quantity_ordered: 10, unit_cost: 1500 },
    ],
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a purchase order with valid data', async () => {
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.po_number).toBe('PO-2026-001')
  })

  it('creates a purchase order with multiple items', async () => {
    const body = {
      ...validBody,
      items: [
        { product_id: 'a0000000-0000-4000-8000-000000000010', quantity_ordered: 10, unit_cost: 1500 },
        { product_id: 'a0000000-0000-4000-8000-000000000020', variant_id: 'a0000000-0000-4000-8000-000000000099', quantity_ordered: 5, unit_cost: 3000 },
      ],
    }
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', body) as never)
    expect(res.status).toBe(201)
  })

  it('creates a purchase order without optional fields', async () => {
    const body = {
      supplier_id: 'a0000000-0000-4000-8000-000000000001',
      po_number: 'PO-MIN',
      items: [
        { product_id: 'a0000000-0000-4000-8000-000000000010', quantity_ordered: 1, unit_cost: 500 },
      ],
    }
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', body) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when supplier_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', {
      po_number: 'PO-001',
      items: [{ product_id: 'a0000000-0000-4000-8000-000000000010', quantity_ordered: 1, unit_cost: 100 }],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when po_number is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', {
      supplier_id: 'a0000000-0000-4000-8000-000000000001',
      items: [{ product_id: 'a0000000-0000-4000-8000-000000000010', quantity_ordered: 1, unit_cost: 100 }],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', {
      supplier_id: 'a0000000-0000-4000-8000-000000000001',
      po_number: 'PO-001',
      items: [],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when items is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', {
      supplier_id: 'a0000000-0000-4000-8000-000000000001',
      po_number: 'PO-001',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid supplier_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', {
      supplier_id: 'not-a-uuid',
      po_number: 'PO-001',
      items: [{ product_id: 'a0000000-0000-4000-8000-000000000010', quantity_ordered: 1, unit_cost: 100 }],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if supplier not found in store', async () => {
    mockSupplier = null
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toMatch(/Supplier not found/)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 when purchase order insert fails', async () => {
    mockInsertError = { message: 'PO insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('PO insert failed')
  })

  it('returns 500 when items insert fails', async () => {
    mockItemsInsertError = { message: 'Items insert failed' }
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Items insert failed')
  })

  it('returns 500 when fetch after insert fails', async () => {
    mockFetchError = { message: 'Fetch error' }
    const res = await POST(makeRequest('http://localhost/api/purchase-orders', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Fetch error')
  })
})
