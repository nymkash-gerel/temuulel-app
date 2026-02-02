/**
 * Tests for GET/POST /api/promotions
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
    id: 'promo-001',
    name: 'Summer Sale',
    description: '20% off all items',
    promo_type: 'order_discount',
    discount_type: 'percent',
    discount_value: 20,
    conditions: {},
    min_order_amount: null,
    max_discount_amount: null,
    applicable_products: null,
    applicable_categories: null,
    start_date: null,
    end_date: null,
    is_active: true,
    max_usage: null,
    created_at: '2026-01-30T00:00:00Z',
  }
  mockInsertError = null
  mockSelectError = null

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
    if (table === 'promotions') {
      // The promotions GET route builds the query with variable chaining
      // (.eq for is_active, .eq for promo_type), so we need a fully chainable query.
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      return {
        select: vi.fn(() => dataQuery),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockInsertedItem, error: mockInsertError }),
          })),
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
// GET /api/promotions
// ---------------------------------------------------------------------------
describe('GET /api/promotions', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/promotions') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/promotions') as never)
    expect(res.status).toBe(403)
  })

  it('returns promotions list', async () => {
    mockData = [
      { id: 'promo-1', name: 'Summer Sale', promo_type: 'order_discount', is_active: true },
      { id: 'promo-2', name: 'BOGO Burgers', promo_type: 'bogo', is_active: true },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/promotions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no promotions exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/promotions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports is_active filter', async () => {
    mockData = [{ id: 'promo-1', name: 'Active Promo', is_active: true }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/promotions?is_active=true') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports promo_type filter', async () => {
    mockData = [{ id: 'promo-2', name: 'BOGO Deal', promo_type: 'bogo' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/promotions?promo_type=bogo') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined is_active and promo_type filters', async () => {
    mockData = [{ id: 'promo-3', promo_type: 'combo', is_active: true }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/promotions?is_active=true&promo_type=combo') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid promo_type filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/promotions?promo_type=invalid_type') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'promo-4' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/promotions?limit=10&offset=30') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/promotions') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/promotions
// ---------------------------------------------------------------------------
describe('POST /api/promotions', () => {
  const validBody = {
    name: 'Summer Sale',
    promo_type: 'order_discount',
    discount_type: 'percent',
    discount_value: 20,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/promotions', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/promotions', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a promotion with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Flash Deal',
      promo_type: 'item_discount',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates a promotion with all fields', async () => {
    mockInsertedItem = {
      id: 'promo-002',
      name: 'Holiday Combo',
      description: 'Combo meal special',
      promo_type: 'combo',
      discount_type: 'fixed',
      discount_value: 5,
      conditions: { min_items: 3 },
      min_order_amount: 15,
      max_discount_amount: 10,
      applicable_products: ['a0000000-0000-4000-8000-000000000001'],
      applicable_categories: ['burgers'],
      start_date: '2026-02-01',
      end_date: '2026-02-28',
      is_active: true,
      max_usage: 100,
      created_at: '2026-01-30T00:00:00Z',
    }
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Holiday Combo',
      description: 'Combo meal special',
      promo_type: 'combo',
      discount_type: 'fixed',
      discount_value: 5,
      conditions: { min_items: 3 },
      min_order_amount: 15,
      max_discount_amount: 10,
      applicable_products: ['a0000000-0000-4000-8000-000000000001'],
      applicable_categories: ['burgers'],
      start_date: '2026-02-01',
      end_date: '2026-02-28',
      is_active: true,
      max_usage: 100,
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.name).toBe('Holiday Combo')
    expect(json.promo_type).toBe('combo')
    expect(json.max_usage).toBe(100)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      promo_type: 'order_discount',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: '',
      promo_type: 'order_discount',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when promo_type is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Missing Type',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid promo_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Bad Type',
      promo_type: 'invalid_type',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid discount_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Bad Discount',
      promo_type: 'order_discount',
      discount_type: 'bogus',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative discount_value', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Negative Discount',
      promo_type: 'order_discount',
      discount_value: -5,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid applicable_products UUIDs', async () => {
    const res = await POST(makeRequest('http://localhost/api/promotions', {
      name: 'Bad UUIDs',
      promo_type: 'item_discount',
      applicable_products: ['not-a-uuid'],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makeRequest('http://localhost/api/promotions', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB error')
  })
})
