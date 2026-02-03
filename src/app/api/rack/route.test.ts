/**
 * Tests for GET/POST /api/rack
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

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

function makeRequest(url: string, body?: unknown) {
  if (body) {
    return createTestJsonRequest(url, body)
  }
  return createTestRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockData = []
  mockDataCount = 0
  mockInsertedItem = {
    id: 'rack-001',
    rack_number: 'R-001',
    order_id: null,
    status: 'available',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    laundry_orders: null,
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
    if (table === 'rack_locations') {
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
// GET /api/rack
// ---------------------------------------------------------------------------
describe('GET /api/rack', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/rack'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/rack'))
    expect(res.status).toBe(403)
  })

  it('returns rack locations list', async () => {
    mockData = [
      { id: 'rack-1', rack_number: 'R-001', status: 'available', order_id: null },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/rack'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no rack locations', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/rack'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'rack-1', status: 'occupied' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/rack?status=occupied'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports order_id filter', async () => {
    mockData = [{ id: 'rack-1', order_id: 'order-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/rack?order_id=order-001'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'rack-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/rack?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/rack?status=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/rack'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/rack
// ---------------------------------------------------------------------------
describe('POST /api/rack', () => {
  const validBody = {
    rack_number: 'R-001',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/rack', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/rack', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a rack location with rack_number only', async () => {
    const res = await POST(makeRequest('http://localhost/api/rack', validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('rack-001')
    expect(json.status).toBe('available')
  })

  it('creates a rack location with order_id', async () => {
    const res = await POST(makeRequest('http://localhost/api/rack', {
      rack_number: 'R-002',
      order_id: 'a0000000-0000-4000-8000-000000000001',
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when rack_number is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/rack', {}))
    expect(res.status).toBe(400)
  })

  it('returns 400 when rack_number is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/rack', {
      rack_number: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid order_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/rack', {
      rack_number: 'R-003',
      order_id: 'not-a-uuid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/rack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/rack', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
