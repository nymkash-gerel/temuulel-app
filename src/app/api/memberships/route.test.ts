/**
 * Tests for GET/POST /api/memberships
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
  mockSelectError = null
  mockInsertError = null
  mockInsertedItem = {
    id: 'mem-001',
    name: 'Gold Membership',
    description: 'Premium monthly membership',
    price: 50000,
    billing_period: 'monthly',
    benefits: { discount: 10, free_services: 2 },
    is_active: true,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
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
    if (table === 'memberships') {
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
// GET /api/memberships
// ---------------------------------------------------------------------------
describe('GET /api/memberships', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/memberships') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/memberships') as never)
    expect(res.status).toBe(403)
  })

  it('returns memberships list', async () => {
    mockData = [
      { id: 'mem-1', name: 'Gold', price: 50000, billing_period: 'monthly', is_active: true },
      { id: 'mem-2', name: 'Silver', price: 30000, billing_period: 'monthly', is_active: true },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/memberships') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no memberships exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/memberships') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports is_active=true filter', async () => {
    mockData = [{ id: 'mem-1', is_active: true }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?is_active=true') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports is_active=false filter', async () => {
    mockData = [{ id: 'mem-2', is_active: false }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?is_active=false') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports billing_period=monthly filter', async () => {
    mockData = [{ id: 'mem-1', billing_period: 'monthly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?billing_period=monthly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports billing_period=yearly filter', async () => {
    mockData = [{ id: 'mem-3', billing_period: 'yearly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?billing_period=yearly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports billing_period=quarterly filter', async () => {
    mockData = [{ id: 'mem-4', billing_period: 'quarterly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?billing_period=quarterly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports billing_period=weekly filter', async () => {
    mockData = [{ id: 'mem-5', billing_period: 'weekly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?billing_period=weekly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid billing_period filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/memberships?billing_period=biweekly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports combined is_active and billing_period filters', async () => {
    mockData = [{ id: 'mem-1', is_active: true, billing_period: 'monthly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/memberships?is_active=true&billing_period=monthly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'mem-10' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/memberships?limit=25&offset=50') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/memberships') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/memberships
// ---------------------------------------------------------------------------
describe('POST /api/memberships', () => {
  const validBody = {
    name: 'Gold Membership',
    price: 50000,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/memberships', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/memberships', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a membership with required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.name).toBe('Gold Membership')
  })

  it('creates a membership with all optional fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      ...validBody,
      description: 'Premium monthly membership with perks',
      billing_period: 'monthly',
      benefits: { discount: 10, free_services: 2 },
      is_active: false,
    }) as never)
    expect(res.status).toBe(201)
  })

  it('creates a membership with default billing_period', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.billing_period).toBe('monthly')
  })

  it('creates a membership with yearly billing', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      ...validBody,
      billing_period: 'yearly',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      price: 50000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when price is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      name: 'Gold Membership',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when price is zero', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      name: 'Gold Membership',
      price: 0,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when price is negative', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      name: 'Gold Membership',
      price: -1000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      name: '',
      price: 50000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid billing_period', async () => {
    const res = await POST(makeRequest('http://localhost/api/memberships', {
      ...validBody,
      billing_period: 'biweekly',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'Insert failed' }
    const res = await POST(makeRequest('http://localhost/api/memberships', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/memberships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('accepts all valid billing periods', async () => {
    for (const period of ['weekly', 'monthly', 'quarterly', 'yearly']) {
      const res = await POST(makeRequest('http://localhost/api/memberships', {
        ...validBody,
        billing_period: period,
      }) as never)
      expect(res.status).toBe(201)
    }
  })
})
