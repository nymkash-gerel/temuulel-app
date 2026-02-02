/**
 * Tests for GET/POST /api/reservations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockUnit: { id: string } | null = null
let mockGuest: { id: string } | null = null
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
  mockUnit = { id: 'unit-001' }
  mockGuest = { id: 'guest-001' }
  mockInsertedItem = {
    id: 'res-001',
    unit_id: 'unit-001',
    guest_id: 'guest-001',
    check_in: '2026-03-01',
    check_out: '2026-03-05',
    actual_check_in: null,
    actual_check_out: null,
    adults: 2,
    children: 0,
    rate_per_night: 150,
    total_amount: 600,
    deposit_amount: 150,
    deposit_status: 'pending',
    status: 'confirmed',
    source: 'direct',
    special_requests: null,
    created_at: '2026-01-30T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
    units: { id: 'unit-001', unit_number: '101', unit_type: 'standard' },
    guests: { id: 'guest-001', first_name: 'John', last_name: 'Doe' },
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
    if (table === 'reservations') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.gte = vi.fn(() => dataQuery)
      dataQuery.lte = vi.fn(() => dataQuery)
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
    if (table === 'units') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockUnit }),
        })),
      }
    }
    if (table === 'guests') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockGuest }),
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
// GET /api/reservations
// ---------------------------------------------------------------------------
describe('GET /api/reservations', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/reservations') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/reservations') as never)
    expect(res.status).toBe(403)
  })

  it('returns reservations list', async () => {
    mockData = [
      { id: 'res-1', unit_id: 'unit-001', guest_id: 'guest-001', status: 'confirmed' },
      { id: 'res-2', unit_id: 'unit-002', guest_id: 'guest-002', status: 'checked_in' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/reservations') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no reservations', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/reservations') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'res-1', status: 'confirmed' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?status=confirmed') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports unit_id filter', async () => {
    mockData = [{ id: 'res-1', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?unit_id=unit-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports guest_id filter', async () => {
    mockData = [{ id: 'res-1', guest_id: 'guest-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?guest_id=guest-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports from_date filter', async () => {
    mockData = [{ id: 'res-1', check_in: '2026-03-01' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?from_date=2026-03-01') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports to_date filter', async () => {
    mockData = [{ id: 'res-1', check_out: '2026-03-05' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?to_date=2026-03-05') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'res-1', status: 'checked_in', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?status=checked_in&unit_id=unit-001&from_date=2026-03-01&to_date=2026-03-10') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = [{ id: 'res-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/reservations?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'res-10' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/reservations?limit=10&offset=30') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/reservations') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/reservations
// ---------------------------------------------------------------------------
describe('POST /api/reservations', () => {
  const validBody = {
    unit_id: 'a0000000-0000-4000-8000-000000000001',
    guest_id: 'a0000000-0000-4000-8000-000000000002',
    check_in: '2026-03-01',
    check_out: '2026-03-05',
    rate_per_night: 150,
    total_amount: 600,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/reservations', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/reservations', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a reservation with required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/reservations', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.status).toBe('confirmed')
  })

  it('creates a reservation with all optional fields', async () => {
    mockInsertedItem = {
      ...mockInsertedItem,
      adults: 2,
      children: 1,
      deposit_amount: 200,
      source: 'booking_com',
      special_requests: 'Late check-in',
    }
    const res = await POST(makeRequest('http://localhost/api/reservations', {
      ...validBody,
      adults: 2,
      children: 1,
      deposit_amount: 200,
      source: 'booking_com',
      special_requests: 'Late check-in',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.source).toBe('booking_com')
    expect(json.special_requests).toBe('Late check-in')
  })

  it('returns 404 if unit not found in store', async () => {
    mockUnit = null
    const res = await POST(makeRequest('http://localhost/api/reservations', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Unit/)
  })

  it('returns 404 if guest not found in store', async () => {
    mockGuest = null
    const res = await POST(makeRequest('http://localhost/api/reservations', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Guest/)
  })

  it('returns 400 when unit_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/reservations', {
      guest_id: 'a0000000-0000-4000-8000-000000000002',
      check_in: '2026-03-01',
      check_out: '2026-03-05',
      rate_per_night: 150,
      total_amount: 600,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when guest_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/reservations', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      check_in: '2026-03-01',
      check_out: '2026-03-05',
      rate_per_night: 150,
      total_amount: 600,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when check_in is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/reservations', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      guest_id: 'a0000000-0000-4000-8000-000000000002',
      check_out: '2026-03-05',
      rate_per_night: 150,
      total_amount: 600,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when rate_per_night is not positive', async () => {
    const res = await POST(makeRequest('http://localhost/api/reservations', {
      ...validBody,
      rate_per_night: -10,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid source value', async () => {
    const res = await POST(makeRequest('http://localhost/api/reservations', {
      ...validBody,
      source: 'invalid_source',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'DB insert error' }
    const res = await POST(makeRequest('http://localhost/api/reservations', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB insert error')
  })
})
