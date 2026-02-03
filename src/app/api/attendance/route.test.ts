/**
 * Tests for GET/POST /api/attendance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 60, remaining: 59, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockSelectError: { message: string } | null = null
let mockUpsertedItem: Record<string, unknown> | null = null
let mockUpsertError: { message: string } | null = null

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
  mockSelectError = null
  mockUpsertedItem = {
    id: 'att-001',
    session_id: 'sess-001',
    student_id: 'student-001',
    status: 'present',
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    students: { id: 'student-001', first_name: 'Jane', last_name: 'Smith' },
    course_sessions: { id: 'sess-001', title: 'Lesson 1', scheduled_at: '2026-02-01T09:00:00Z' },
  }
  mockUpsertError = null

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
    if (table === 'attendance') {
      // GET: chainable thenable query
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // POST: upsert chain
      const upsertSingle = vi.fn().mockResolvedValue({
        data: mockUpsertedItem,
        error: mockUpsertError,
      })
      const upsertSelect = vi.fn(() => ({
        single: upsertSingle,
      }))

      return {
        select: vi.fn(() => dataQuery),
        upsert: vi.fn(() => ({
          select: upsertSelect,
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
// GET /api/attendance
// ---------------------------------------------------------------------------
describe('GET /api/attendance', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/attendance'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/attendance'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns attendance list', async () => {
    mockData = [
      {
        id: 'att-1',
        session_id: 'sess-1',
        student_id: 's-1',
        status: 'present',
        students: { id: 's-1', first_name: 'Jane', last_name: 'Smith' },
        course_sessions: { id: 'sess-1', title: 'Lesson 1', scheduled_at: '2026-02-01T09:00:00Z' },
      },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/attendance'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no records', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/attendance'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports session_id filter', async () => {
    mockData = [{ id: 'att-1', session_id: 'sess-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/attendance?session_id=sess-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports student_id filter', async () => {
    mockData = [{ id: 'att-1', student_id: 's-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/attendance?student_id=s-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'att-5' }]
    mockDataCount = 200
    const res = await GET(makeRequest('http://localhost/api/attendance?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(200)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'att-1', session_id: 'sess-1', student_id: 's-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/attendance?session_id=sess-1&student_id=s-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/attendance'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/attendance
// ---------------------------------------------------------------------------
describe('POST /api/attendance', () => {
  const validBody = {
    session_id: 'a0000000-0000-4000-8000-000000000001',
    student_id: 'b0000000-0000-4000-8000-000000000002',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/attendance', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/attendance', validBody))
    expect(res.status).toBe(403)
  })

  it('records attendance with minimal data (defaults to present)', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
  })

  it('records attendance with all optional fields', async () => {
    const fullBody = {
      session_id: 'a0000000-0000-4000-8000-000000000001',
      student_id: 'b0000000-0000-4000-8000-000000000002',
      status: 'late',
      notes: 'Arrived 10 minutes late',
    }
    const res = await POST(makeRequest('http://localhost/api/attendance', fullBody))
    expect(res.status).toBe(201)
  })

  it('records attendance with status present', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      ...validBody,
      status: 'present',
    }))
    expect(res.status).toBe(201)
  })

  it('records attendance with status absent', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      ...validBody,
      status: 'absent',
    }))
    expect(res.status).toBe(201)
  })

  it('records attendance with status excused', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      ...validBody,
      status: 'excused',
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when session_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      student_id: 'b0000000-0000-4000-8000-000000000002',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when student_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      session_id: 'a0000000-0000-4000-8000-000000000001',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid session_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      session_id: 'not-a-uuid',
      student_id: 'b0000000-0000-4000-8000-000000000002',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid student_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      session_id: 'a0000000-0000-4000-8000-000000000001',
      student_id: 'not-a-uuid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {
      session_id: 'a0000000-0000-4000-8000-000000000001',
      student_id: 'b0000000-0000-4000-8000-000000000002',
      status: 'invalid_status',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/attendance', {}))
    expect(res.status).toBe(400)
  })

  it('returns 500 on database upsert error', async () => {
    mockUpsertError = { message: 'Upsert failed' }
    mockUpsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/attendance', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Upsert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
