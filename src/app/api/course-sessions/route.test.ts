/**
 * Tests for GET/POST /api/course-sessions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockSelectError: { message: string } | null = null
let mockProgram: { id: string } | null = null
let mockInsertedItem: Record<string, unknown> | null = null
let mockInsertError: { message: string } | null = null

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
  mockProgram = { id: 'prog-001' }
  mockInsertedItem = {
    id: 'sess-001',
    program_id: 'prog-001',
    instructor_id: null,
    title: 'Lesson 1: Introduction',
    scheduled_at: '2026-02-10T09:00:00Z',
    duration_minutes: 60,
    location: 'Room 101',
    status: 'scheduled',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    programs: { id: 'prog-001', name: 'Web Dev' },
    staff: null,
  }
  mockInsertError = null

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
    if (table === 'course_sessions') {
      // GET: chainable thenable query
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // POST: insert chain
      const insertSingle = vi.fn().mockResolvedValue({
        data: mockInsertedItem,
        error: mockInsertError,
      })
      const insertSelect = vi.fn(() => ({
        single: insertSingle,
      }))

      return {
        select: vi.fn(() => dataQuery),
        insert: vi.fn(() => ({
          select: insertSelect,
        })),
      }
    }
    if (table === 'programs') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockProgram }),
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
// GET /api/course-sessions
// ---------------------------------------------------------------------------
describe('GET /api/course-sessions', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/course-sessions'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/course-sessions'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns course sessions list', async () => {
    mockData = [
      {
        id: 'sess-1',
        program_id: 'prog-1',
        title: 'Lesson 1',
        status: 'scheduled',
        programs: { id: 'prog-1', name: 'Web Dev' },
        staff: null,
      },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/course-sessions'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no sessions', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/course-sessions'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports program_id filter', async () => {
    mockData = [{ id: 'sess-1', program_id: 'prog-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/course-sessions?program_id=prog-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports instructor_id filter', async () => {
    mockData = [{ id: 'sess-1', instructor_id: 'inst-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/course-sessions?instructor_id=inst-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'sess-1', status: 'completed' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/course-sessions?status=completed'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/course-sessions?status=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'sess-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/course-sessions?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'sess-1', program_id: 'prog-1', status: 'scheduled', instructor_id: 'inst-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/course-sessions?program_id=prog-1&status=scheduled&instructor_id=inst-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/course-sessions'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/course-sessions
// ---------------------------------------------------------------------------
describe('POST /api/course-sessions', () => {
  const validBody = {
    program_id: 'a0000000-0000-4000-8000-000000000001',
    title: 'Lesson 1: Introduction',
    scheduled_at: '2026-02-10T09:00:00Z',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/course-sessions', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/course-sessions', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a session with minimal data', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
  })

  it('creates a session with all optional fields', async () => {
    const fullBody = {
      program_id: 'a0000000-0000-4000-8000-000000000001',
      instructor_id: 'b0000000-0000-4000-8000-000000000002',
      title: 'Lesson 1: Introduction',
      scheduled_at: '2026-02-10T09:00:00Z',
      duration_minutes: 90,
      location: 'Room 101',
    }
    const res = await POST(makeRequest('http://localhost/api/course-sessions', fullBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when program_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {
      title: 'Lesson 1',
      scheduled_at: '2026-02-10T09:00:00Z',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when title is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {
      program_id: 'a0000000-0000-4000-8000-000000000001',
      scheduled_at: '2026-02-10T09:00:00Z',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when scheduled_at is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {
      program_id: 'a0000000-0000-4000-8000-000000000001',
      title: 'Lesson 1',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when title is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {
      program_id: 'a0000000-0000-4000-8000-000000000001',
      title: '',
      scheduled_at: '2026-02-10T09:00:00Z',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid program_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {
      program_id: 'not-a-uuid',
      title: 'Lesson 1',
      scheduled_at: '2026-02-10T09:00:00Z',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid instructor_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {
      program_id: 'a0000000-0000-4000-8000-000000000001',
      instructor_id: 'not-a-uuid',
      title: 'Lesson 1',
      scheduled_at: '2026-02-10T09:00:00Z',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when program not found in store', async () => {
    mockProgram = null
    const res = await POST(makeRequest('http://localhost/api/course-sessions', validBody))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Program not found/)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/course-sessions', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/course-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/course-sessions', {}))
    expect(res.status).toBe(400)
  })
})
