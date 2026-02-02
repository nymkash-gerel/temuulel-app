/**
 * Tests for GET/POST /api/client-preferences
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockUpsertedItem: Record<string, unknown> | null = null
let mockUpsertError: { message: string } | null = null
let mockSelectError: { message: string } | null = null
let mockCustomer: { id: string } | null = null
let mockStaff: { id: string } | null = null

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
  mockUpsertError = null
  mockCustomer = { id: 'cust-001' }
  mockStaff = { id: 'staff-001' }
  mockUpsertedItem = {
    id: 'pref-001',
    customer_id: 'cust-001',
    skin_type: 'oily',
    hair_type: 'curly',
    allergies: ['latex'],
    preferred_staff_id: 'staff-001',
    color_history: [{ date: '2026-01-15', color: 'auburn' }],
    notes: 'Prefers organic products',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    customers: { id: 'cust-001', name: 'Alice' },
    staff: { id: 'staff-001', name: 'Jane Stylist' },
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
    if (table === 'client_preferences') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      return {
        select: vi.fn(() => dataQuery),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockUpsertedItem, error: mockUpsertError }),
          })),
        })),
      }
    }
    if (table === 'customers') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockCustomer }),
        })),
      }
    }
    if (table === 'staff') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockStaff }),
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
// GET /api/client-preferences
// ---------------------------------------------------------------------------
describe('GET /api/client-preferences', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/client-preferences') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/client-preferences') as never)
    expect(res.status).toBe(403)
  })

  it('returns client preferences list', async () => {
    mockData = [
      { id: 'pref-1', customer_id: 'cust-001', skin_type: 'oily', hair_type: 'curly' },
      { id: 'pref-2', customer_id: 'cust-002', skin_type: 'dry', hair_type: 'straight' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/client-preferences') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no preferences exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/client-preferences') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports customer_id filter', async () => {
    mockData = [{ id: 'pref-1', customer_id: 'cust-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?customer_id=cust-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports skin_type=oily filter', async () => {
    mockData = [{ id: 'pref-1', skin_type: 'oily' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?skin_type=oily') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports skin_type=dry filter', async () => {
    mockData = [{ id: 'pref-2', skin_type: 'dry' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?skin_type=dry') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports skin_type=combination filter', async () => {
    mockData = [{ id: 'pref-3', skin_type: 'combination' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?skin_type=combination') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports skin_type=normal filter', async () => {
    mockData = [{ id: 'pref-4', skin_type: 'normal' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?skin_type=normal') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports skin_type=sensitive filter', async () => {
    mockData = [{ id: 'pref-5', skin_type: 'sensitive' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?skin_type=sensitive') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid skin_type filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/client-preferences?skin_type=unknown') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports hair_type=straight filter', async () => {
    mockData = [{ id: 'pref-1', hair_type: 'straight' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?hair_type=straight') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports hair_type=curly filter', async () => {
    mockData = [{ id: 'pref-2', hair_type: 'curly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?hair_type=curly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports hair_type=wavy filter', async () => {
    mockData = [{ id: 'pref-3', hair_type: 'wavy' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?hair_type=wavy') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid hair_type filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/client-preferences?hair_type=bald') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'pref-1', customer_id: 'cust-001', skin_type: 'oily', hair_type: 'curly' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/client-preferences?customer_id=cust-001&skin_type=oily&hair_type=curly') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'pref-10' }]
    mockDataCount = 80
    const res = await GET(makeRequest('http://localhost/api/client-preferences?limit=10&offset=30') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(80)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/client-preferences') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/client-preferences
// ---------------------------------------------------------------------------
describe('POST /api/client-preferences', () => {
  const validBody = {
    customer_id: 'a0000000-0000-4000-8000-000000000001',
    skin_type: 'oily',
    hair_type: 'curly',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/client-preferences', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/client-preferences', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates client preferences with required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      customer_id: 'a0000000-0000-4000-8000-000000000001',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates client preferences with all optional fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      ...validBody,
      allergies: ['latex', 'fragrance'],
      preferred_staff_id: 'a0000000-0000-4000-8000-000000000002',
      color_history: [{ date: '2026-01-15', color: 'auburn' }],
      notes: 'Prefers organic products',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('upserts preferences for existing customer', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.customer_id).toBe('cust-001')
  })

  it('returns 400 when customer_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      skin_type: 'oily',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when customer_id is not a valid uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      customer_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid skin_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      skin_type: 'unknown',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid hair_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      hair_type: 'bald',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('accepts all valid skin_type values', async () => {
    for (const skinType of ['normal', 'dry', 'oily', 'combination', 'sensitive']) {
      const res = await POST(makeRequest('http://localhost/api/client-preferences', {
        customer_id: 'a0000000-0000-4000-8000-000000000001',
        skin_type: skinType,
      }) as never)
      expect(res.status).toBe(201)
    }
  })

  it('accepts all valid hair_type values', async () => {
    for (const hairType of ['straight', 'wavy', 'curly', 'coily', 'fine', 'thick']) {
      const res = await POST(makeRequest('http://localhost/api/client-preferences', {
        customer_id: 'a0000000-0000-4000-8000-000000000001',
        hair_type: hairType,
      }) as never)
      expect(res.status).toBe(201)
    }
  })

  it('returns 404 if customer not found in store', async () => {
    mockCustomer = null
    const res = await POST(makeRequest('http://localhost/api/client-preferences', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Customer/)
  })

  it('returns 404 if preferred staff not found in store', async () => {
    mockStaff = null
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      ...validBody,
      preferred_staff_id: 'a0000000-0000-4000-8000-000000000002',
    }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Staff/)
  })

  it('does not check staff when preferred_staff_id is not provided', async () => {
    mockStaff = null
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      skin_type: 'dry',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 500 on database upsert error', async () => {
    mockUpsertedItem = null
    mockUpsertError = { message: 'Upsert failed' }
    const res = await POST(makeRequest('http://localhost/api/client-preferences', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Upsert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/client-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when preferred_staff_id is not a valid uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/client-preferences', {
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      preferred_staff_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })
})
