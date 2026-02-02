/**
 * Tests for GET/POST /api/damage-reports
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
    id: 'dmg-001',
    reservation_id: 'res-001',
    unit_id: 'unit-001',
    guest_id: 'guest-001',
    description: 'Broken window in bedroom',
    damage_type: 'major',
    estimated_cost: 500,
    charged_amount: null,
    photos: ['photo1.jpg'],
    status: 'reported',
    created_at: '2026-01-30T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
    units: { id: 'unit-001', unit_number: '101' },
    guests: { id: 'guest-001', first_name: 'John', last_name: 'Doe' },
    reservations: { id: 'res-001', check_in: '2026-02-01', check_out: '2026-02-05' },
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
    if (table === 'damage_reports') {
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
// GET /api/damage-reports
// ---------------------------------------------------------------------------
describe('GET /api/damage-reports', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/damage-reports') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/damage-reports') as never)
    expect(res.status).toBe(403)
  })

  it('returns damage reports list', async () => {
    mockData = [
      { id: 'dmg-1', unit_id: 'unit-001', damage_type: 'major', status: 'reported' },
      { id: 'dmg-2', unit_id: 'unit-002', damage_type: 'minor', status: 'assessed' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/damage-reports') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no damage reports', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/damage-reports') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter with reported', async () => {
    mockData = [{ id: 'dmg-1', status: 'reported' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?status=reported') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status filter with assessed', async () => {
    mockData = [{ id: 'dmg-1', status: 'assessed' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?status=assessed') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status filter with charged', async () => {
    mockData = [{ id: 'dmg-1', status: 'charged' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?status=charged') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status filter with resolved', async () => {
    mockData = [{ id: 'dmg-1', status: 'resolved' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?status=resolved') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports unit_id filter', async () => {
    mockData = [{ id: 'dmg-1', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?unit_id=unit-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined status and unit_id filters', async () => {
    mockData = [{ id: 'dmg-1', status: 'waived', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?status=waived&unit_id=unit-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = [{ id: 'dmg-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/damage-reports?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'dmg-20' }]
    mockDataCount = 60
    const res = await GET(makeRequest('http://localhost/api/damage-reports?limit=10&offset=20') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(60)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/damage-reports') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/damage-reports
// ---------------------------------------------------------------------------
describe('POST /api/damage-reports', () => {
  const validBody = {
    unit_id: 'a0000000-0000-4000-8000-000000000001',
    description: 'Broken window in bedroom',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/damage-reports', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/damage-reports', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a damage report with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.description).toBe('Broken window in bedroom')
    expect(json.status).toBe('reported')
  })

  it('creates a damage report with all optional fields', async () => {
    mockInsertedItem = {
      ...mockInsertedItem,
      reservation_id: 'res-001',
      guest_id: 'guest-001',
      damage_type: 'moderate',
      estimated_cost: 250,
      photos: ['photo1.jpg', 'photo2.jpg'],
    }
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      description: 'Stained carpet',
      reservation_id: 'a0000000-0000-4000-8000-000000000002',
      guest_id: 'a0000000-0000-4000-8000-000000000003',
      damage_type: 'moderate',
      estimated_cost: 250,
      photos: ['photo1.jpg', 'photo2.jpg'],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.damage_type).toBe('moderate')
    expect(json.estimated_cost).toBe(250)
    expect(json.photos).toHaveLength(2)
  })

  it('returns 400 when unit_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      description: 'Some damage',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      description: '',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid damage_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      description: 'Some damage',
      damage_type: 'invalid_type',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative estimated_cost', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      description: 'Some damage',
      estimated_cost: -100,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid unit_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/damage-reports', {
      unit_id: 'not-a-uuid',
      description: 'Some damage',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/damage-reports', {
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
    const res = await POST(makeRequest('http://localhost/api/damage-reports', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB insert error')
  })
})
