/**
 * Tests for GET/POST /api/kds-stations
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
    id: 'kds-001',
    name: 'Main Kitchen',
    station_type: 'kitchen',
    display_categories: [],
    is_active: true,
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
    if (table === 'kds_stations') {
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
// GET /api/kds-stations
// ---------------------------------------------------------------------------
describe('GET /api/kds-stations', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/kds-stations'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/kds-stations'))
    expect(res.status).toBe(403)
  })

  it('returns KDS stations list', async () => {
    mockData = [
      { id: 'kds-1', name: 'Main Kitchen', station_type: 'kitchen', is_active: true },
      { id: 'kds-2', name: 'Bar Station', station_type: 'bar', is_active: true },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/kds-stations'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no stations exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/kds-stations'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'kds-3', name: 'Expo' }]
    mockDataCount = 25
    const res = await GET(makeRequest('http://localhost/api/kds-stations?limit=5&offset=10'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(25)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/kds-stations'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/kds-stations
// ---------------------------------------------------------------------------
describe('POST /api/kds-stations', () => {
  const validBody = {
    name: 'Main Kitchen',
    station_type: 'kitchen',
    display_categories: ['appetizers', 'entrees'],
    is_active: true,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/kds-stations', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/kds-stations', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a KDS station with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/kds-stations', { name: 'Prep Station' }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates a KDS station with all fields', async () => {
    mockInsertedItem = {
      id: 'kds-002',
      name: 'Bar Station',
      station_type: 'bar',
      display_categories: ['drinks', 'cocktails'],
      is_active: true,
      created_at: '2026-01-30T00:00:00Z',
    }
    const res = await POST(makeRequest('http://localhost/api/kds-stations', {
      name: 'Bar Station',
      station_type: 'bar',
      display_categories: ['drinks', 'cocktails'],
      is_active: true,
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.name).toBe('Bar Station')
    expect(json.station_type).toBe('bar')
    expect(json.display_categories).toEqual(['drinks', 'cocktails'])
  })

  it('creates a KDS station with each valid station_type', async () => {
    for (const stationType of ['kitchen', 'bar', 'prep', 'expo', 'packaging']) {
      mockInsertedItem = {
        id: `kds-${stationType}`,
        name: `${stationType} station`,
        station_type: stationType,
        display_categories: [],
        is_active: true,
        created_at: '2026-01-30T00:00:00Z',
      }
      const res = await POST(makeRequest('http://localhost/api/kds-stations', {
        name: `${stationType} station`,
        station_type: stationType,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/kds-stations', {
      station_type: 'kitchen',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/kds-stations', {
      name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is whitespace only', async () => {
    const res = await POST(makeRequest('http://localhost/api/kds-stations', {
      name: '   ',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid station_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/kds-stations', {
      name: 'Bad Station',
      station_type: 'invalid_type',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid display_categories type', async () => {
    const res = await POST(makeRequest('http://localhost/api/kds-stations', {
      name: 'Bad Categories',
      display_categories: 'not-an-array',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/kds-stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makeRequest('http://localhost/api/kds-stations', validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB error')
  })
})
