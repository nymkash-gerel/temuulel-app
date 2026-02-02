/**
 * Tests for GET/POST /api/units
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
    id: 'unit-001',
    unit_number: '101',
    unit_type: 'standard',
    floor: '1',
    max_occupancy: 2,
    base_rate: 100,
    amenities: ['wifi'],
    images: [],
    status: 'available',
    created_at: '2026-01-30T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
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
    if (table === 'units') {
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
// GET /api/units
// ---------------------------------------------------------------------------
describe('GET /api/units', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/units') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/units') as never)
    expect(res.status).toBe(403)
  })

  it('returns units list', async () => {
    mockData = [
      { id: 'unit-1', unit_number: '101', unit_type: 'standard', base_rate: 100, status: 'available' },
      { id: 'unit-2', unit_number: '102', unit_type: 'deluxe', base_rate: 200, status: 'occupied' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/units') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no units', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/units') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'unit-1', unit_number: '101', status: 'available' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/units?status=available') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports unit_type filter', async () => {
    mockData = [{ id: 'unit-1', unit_number: '201', unit_type: 'suite' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/units?unit_type=suite') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined status and unit_type filters', async () => {
    mockData = [{ id: 'unit-1', unit_number: '301', unit_type: 'penthouse', status: 'occupied' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/units?status=occupied&unit_type=penthouse') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = [{ id: 'unit-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/units?status=invalid_status') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid unit_type filter values', async () => {
    mockData = [{ id: 'unit-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/units?unit_type=invalid_type') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'unit-10' }]
    mockDataCount = 50
    const res = await GET(makeRequest('http://localhost/api/units?limit=10&offset=20') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/units') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/units
// ---------------------------------------------------------------------------
describe('POST /api/units', () => {
  const validBody = {
    unit_number: '101',
    base_rate: 100,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/units', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/units', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a unit with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/units', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.unit_number).toBe('101')
  })

  it('creates a unit with all optional fields', async () => {
    mockInsertedItem = {
      ...mockInsertedItem,
      unit_type: 'suite',
      floor: '5',
      max_occupancy: 4,
      amenities: ['wifi', 'minibar'],
      images: ['img1.jpg'],
      status: 'maintenance',
    }
    const res = await POST(makeRequest('http://localhost/api/units', {
      unit_number: '501',
      unit_type: 'suite',
      floor: '5',
      max_occupancy: 4,
      base_rate: 350,
      amenities: ['wifi', 'minibar'],
      images: ['img1.jpg'],
      status: 'maintenance',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.unit_type).toBe('suite')
    expect(json.floor).toBe('5')
  })

  it('returns 400 when unit_number is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/units', {
      base_rate: 100,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when base_rate is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/units', {
      unit_number: '101',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when base_rate is not positive', async () => {
    const res = await POST(makeRequest('http://localhost/api/units', {
      unit_number: '101',
      base_rate: -5,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid unit_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/units', {
      unit_number: '101',
      base_rate: 100,
      unit_type: 'invalid_type',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status', async () => {
    const res = await POST(makeRequest('http://localhost/api/units', {
      unit_number: '101',
      base_rate: 100,
      status: 'invalid_status',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/units', {
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
    const res = await POST(makeRequest('http://localhost/api/units', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB insert error')
  })
})
