/**
 * Tests for GET/POST /api/maintenance
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
    id: 'maint-001',
    unit_id: 'unit-001',
    reported_by: 'user-001',
    assigned_to: 'staff-001',
    category: 'plumbing',
    description: 'Leaking faucet in bathroom',
    priority: 'high',
    status: 'reported',
    estimated_cost: 150,
    actual_cost: null,
    created_at: '2026-01-30T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
    units: { id: 'unit-001', unit_number: '101' },
    staff: { id: 'staff-001', name: 'Bob' },
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
    if (table === 'maintenance_requests') {
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
// GET /api/maintenance
// ---------------------------------------------------------------------------
describe('GET /api/maintenance', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/maintenance') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/maintenance') as never)
    expect(res.status).toBe(403)
  })

  it('returns maintenance requests list', async () => {
    mockData = [
      { id: 'maint-1', category: 'plumbing', status: 'reported', priority: 'high' },
      { id: 'maint-2', category: 'electrical', status: 'in_progress', priority: 'urgent' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/maintenance') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no maintenance requests', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/maintenance') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'maint-1', status: 'reported' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?status=reported') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports in_progress status filter', async () => {
    mockData = [{ id: 'maint-1', status: 'in_progress' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?status=in_progress') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports priority filter', async () => {
    mockData = [{ id: 'maint-1', priority: 'urgent' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?priority=urgent') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports unit_id filter', async () => {
    mockData = [{ id: 'maint-1', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?unit_id=unit-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined status and priority filters', async () => {
    mockData = [{ id: 'maint-1', status: 'assigned', priority: 'high' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?status=assigned&priority=high') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined status, priority and unit_id filters', async () => {
    mockData = [{ id: 'maint-1', status: 'completed', priority: 'low', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?status=completed&priority=low&unit_id=unit-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = [{ id: 'maint-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid priority filter values', async () => {
    mockData = [{ id: 'maint-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/maintenance?priority=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'maint-30' }]
    mockDataCount = 120
    const res = await GET(makeRequest('http://localhost/api/maintenance?limit=10&offset=30') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(120)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/maintenance') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/maintenance
// ---------------------------------------------------------------------------
describe('POST /api/maintenance', () => {
  const validBody = {
    description: 'Leaking faucet in bathroom',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/maintenance', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/maintenance', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a maintenance request with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/maintenance', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.description).toBe('Leaking faucet in bathroom')
    expect(json.reported_by).toBe('user-001')
  })

  it('creates a maintenance request with all optional fields', async () => {
    mockInsertedItem = {
      ...mockInsertedItem,
      unit_id: 'unit-001',
      assigned_to: 'staff-001',
      category: 'electrical',
      priority: 'urgent',
      estimated_cost: 500,
    }
    const res = await POST(makeRequest('http://localhost/api/maintenance', {
      description: 'Power outlet sparking',
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      assigned_to: 'a0000000-0000-4000-8000-000000000002',
      category: 'electrical',
      priority: 'urgent',
      estimated_cost: 500,
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.category).toBe('electrical')
    expect(json.priority).toBe('urgent')
    expect(json.estimated_cost).toBe(500)
  })

  it('returns 400 when description is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/maintenance', {}) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/maintenance', {
      description: '',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid category', async () => {
    const res = await POST(makeRequest('http://localhost/api/maintenance', {
      description: 'Some issue',
      category: 'invalid_category',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid priority', async () => {
    const res = await POST(makeRequest('http://localhost/api/maintenance', {
      description: 'Some issue',
      priority: 'invalid_priority',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative estimated_cost', async () => {
    const res = await POST(makeRequest('http://localhost/api/maintenance', {
      description: 'Some issue',
      estimated_cost: -50,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/maintenance', {
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
    const res = await POST(makeRequest('http://localhost/api/maintenance', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB insert error')
  })
})
