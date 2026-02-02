/**
 * Tests for GET/POST /api/housekeeping
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
    id: 'task-001',
    unit_id: 'unit-001',
    assigned_to: 'staff-001',
    task_type: 'cleaning',
    priority: 'normal',
    status: 'pending',
    scheduled_at: '2026-02-01T10:00:00Z',
    completed_at: null,
    notes: null,
    created_at: '2026-01-30T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
    units: { id: 'unit-001', unit_number: '101' },
    staff: { id: 'staff-001', name: 'Alice' },
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
    if (table === 'housekeeping_tasks') {
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
// GET /api/housekeeping
// ---------------------------------------------------------------------------
describe('GET /api/housekeeping', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/housekeeping') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/housekeeping') as never)
    expect(res.status).toBe(403)
  })

  it('returns housekeeping tasks list', async () => {
    mockData = [
      { id: 'task-1', unit_id: 'unit-001', task_type: 'cleaning', status: 'pending' },
      { id: 'task-2', unit_id: 'unit-002', task_type: 'deep_cleaning', status: 'in_progress' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/housekeeping') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no tasks', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/housekeeping') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'task-1', status: 'pending' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/housekeeping?status=pending') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports in_progress status filter', async () => {
    mockData = [{ id: 'task-1', status: 'in_progress' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/housekeeping?status=in_progress') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports unit_id filter', async () => {
    mockData = [{ id: 'task-1', unit_id: 'unit-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/housekeeping?unit_id=unit-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports assigned_to filter', async () => {
    mockData = [{ id: 'task-1', assigned_to: 'staff-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/housekeeping?assigned_to=staff-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'task-1', status: 'completed', unit_id: 'unit-001', assigned_to: 'staff-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/housekeeping?status=completed&unit_id=unit-001&assigned_to=staff-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = [{ id: 'task-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/housekeeping?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'task-20' }]
    mockDataCount = 75
    const res = await GET(makeRequest('http://localhost/api/housekeeping?limit=5&offset=15') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(75)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/housekeeping') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/housekeeping
// ---------------------------------------------------------------------------
describe('POST /api/housekeeping', () => {
  const validBody = {
    unit_id: 'a0000000-0000-4000-8000-000000000001',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/housekeeping', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/housekeeping', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a housekeeping task with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/housekeeping', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.unit_id).toBe('unit-001')
  })

  it('creates a housekeeping task with all optional fields', async () => {
    mockInsertedItem = {
      ...mockInsertedItem,
      task_type: 'deep_cleaning',
      priority: 'high',
      assigned_to: 'staff-001',
      scheduled_at: '2026-02-02T08:00:00Z',
      notes: 'Extra attention to bathroom',
    }
    const res = await POST(makeRequest('http://localhost/api/housekeeping', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      assigned_to: 'a0000000-0000-4000-8000-000000000002',
      task_type: 'deep_cleaning',
      priority: 'high',
      scheduled_at: '2026-02-02T08:00:00Z',
      notes: 'Extra attention to bathroom',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.task_type).toBe('deep_cleaning')
    expect(json.priority).toBe('high')
    expect(json.notes).toBe('Extra attention to bathroom')
  })

  it('returns 400 when unit_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/housekeeping', {}) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when unit_id is not a valid uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/housekeeping', {
      unit_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid task_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/housekeeping', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      task_type: 'invalid_type',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid priority', async () => {
    const res = await POST(makeRequest('http://localhost/api/housekeeping', {
      unit_id: 'a0000000-0000-4000-8000-000000000001',
      priority: 'invalid_priority',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/housekeeping', {
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
    const res = await POST(makeRequest('http://localhost/api/housekeeping', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB insert error')
  })
})
