/**
 * Tests for GET/POST /api/enrollments
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
let mockStudent: { id: string } | null = null
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
  mockSelectError = null
  mockStudent = { id: 'student-001' }
  mockProgram = { id: 'prog-001' }
  mockInsertedItem = {
    id: 'enroll-001',
    student_id: 'student-001',
    program_id: 'prog-001',
    status: 'active',
    enrolled_at: '2026-02-01T00:00:00Z',
    completed_at: null,
    grade: null,
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    students: { id: 'student-001', first_name: 'Jane', last_name: 'Smith' },
    programs: { id: 'prog-001', name: 'Web Dev' },
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
    if (table === 'enrollments') {
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
    if (table === 'students') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockStudent }),
        })),
      }
    }
    if (table === 'programs') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
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
// GET /api/enrollments
// ---------------------------------------------------------------------------
describe('GET /api/enrollments', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/enrollments') as never)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/enrollments') as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns enrollments list', async () => {
    mockData = [
      {
        id: 'enroll-1',
        student_id: 's-1',
        program_id: 'p-1',
        status: 'active',
        students: { id: 's-1', first_name: 'Jane', last_name: 'Smith' },
        programs: { id: 'p-1', name: 'Math' },
      },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/enrollments') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no enrollments', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/enrollments') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'enroll-1', status: 'active' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/enrollments?status=active') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports student_id filter', async () => {
    mockData = [{ id: 'enroll-1', student_id: 's-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/enrollments?student_id=s-1') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports program_id filter', async () => {
    mockData = [{ id: 'enroll-1', program_id: 'p-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/enrollments?program_id=p-1') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/enrollments?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'enroll-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/enrollments?limit=25&offset=50') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'enroll-1', status: 'completed', student_id: 's-1', program_id: 'p-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/enrollments?status=completed&student_id=s-1&program_id=p-1') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/enrollments') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/enrollments
// ---------------------------------------------------------------------------
describe('POST /api/enrollments', () => {
  const validBody = {
    student_id: 'a0000000-0000-4000-8000-000000000001',
    program_id: 'b0000000-0000-4000-8000-000000000002',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/enrollments', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/enrollments', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates an enrollment with valid data', async () => {
    const res = await POST(makeRequest('http://localhost/api/enrollments', validBody) as never)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
  })

  it('returns 400 when student_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/enrollments', {
      program_id: 'b0000000-0000-4000-8000-000000000002',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when program_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/enrollments', {
      student_id: 'a0000000-0000-4000-8000-000000000001',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid student_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/enrollments', {
      student_id: 'not-a-uuid',
      program_id: 'b0000000-0000-4000-8000-000000000002',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid program_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/enrollments', {
      student_id: 'a0000000-0000-4000-8000-000000000001',
      program_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 when student not found in store', async () => {
    mockStudent = null
    const res = await POST(makeRequest('http://localhost/api/enrollments', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Student not found/)
  })

  it('returns 404 when program not found in store', async () => {
    mockProgram = null
    const res = await POST(makeRequest('http://localhost/api/enrollments', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Program not found/)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/enrollments', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/enrollments', {}) as never)
    expect(res.status).toBe(400)
  })
})
