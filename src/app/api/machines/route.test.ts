/**
 * Tests for GET/POST /api/machines
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
    id: 'machine-001',
    name: 'Washer 1',
    machine_type: 'washer',
    status: 'available',
    capacity_kg: 10,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
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
    if (table === 'machines') {
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
// GET /api/machines
// ---------------------------------------------------------------------------
describe('GET /api/machines', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/machines'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/machines'))
    expect(res.status).toBe(403)
  })

  it('returns machines list', async () => {
    mockData = [
      { id: 'machine-1', name: 'Washer 1', machine_type: 'washer', status: 'available', capacity_kg: 10 },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/machines'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no machines', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/machines'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports machine_type filter', async () => {
    mockData = [{ id: 'machine-1', machine_type: 'dryer' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/machines?machine_type=dryer'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'machine-1', status: 'maintenance' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/machines?status=maintenance'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'machine-1', machine_type: 'washer', status: 'in_use' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/machines?machine_type=washer&status=in_use'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'machine-5' }]
    mockDataCount = 50
    const res = await GET(makeRequest('http://localhost/api/machines?limit=10&offset=20'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('ignores invalid machine_type filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/machines?machine_type=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/machines?status=broken'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/machines'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/machines
// ---------------------------------------------------------------------------
describe('POST /api/machines', () => {
  const validBody = {
    name: 'Washer 1',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/machines', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/machines', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a machine with name only', async () => {
    const res = await POST(makeRequest('http://localhost/api/machines', validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('machine-001')
  })

  it('creates a machine with all fields', async () => {
    const fullBody = {
      name: 'Heavy Duty Washer',
      machine_type: 'washer',
      capacity_kg: 15,
    }
    const res = await POST(makeRequest('http://localhost/api/machines', fullBody))
    expect(res.status).toBe(201)
  })

  it('accepts all valid machine types', async () => {
    for (const mt of ['washer', 'dryer', 'iron_press', 'steam']) {
      const res = await POST(makeRequest('http://localhost/api/machines', {
        name: `Machine ${mt}`,
        machine_type: mt,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/machines', {
      machine_type: 'washer',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/machines', {
      name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid machine_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/machines', {
      name: 'My Machine',
      machine_type: 'invalid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/machines', {
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
    const res = await POST(makeRequest('http://localhost/api/machines', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
