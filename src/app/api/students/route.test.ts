/**
 * Tests for GET/POST /api/students
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
  mockInsertedItem = {
    id: 'student-001',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    phone: null,
    date_of_birth: '2010-05-15',
    guardian_name: 'John Smith',
    guardian_phone: '99001122',
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
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
    if (table === 'students') {
      // GET: chainable thenable query
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.or = vi.fn(() => dataQuery)
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
// GET /api/students
// ---------------------------------------------------------------------------
describe('GET /api/students', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/students'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/students'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns students list', async () => {
    mockData = [
      { id: 'student-1', first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/students'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no students', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/students'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports search filter via ilike on first_name and last_name', async () => {
    mockData = [{ id: 'student-1', first_name: 'Jane', last_name: 'Smith' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/students?search=jane'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'student-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/students?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('supports search with pagination', async () => {
    mockData = [{ id: 'student-3', first_name: 'Jane', last_name: 'Doe' }]
    mockDataCount = 10
    const res = await GET(makeRequest('http://localhost/api/students?search=jane&limit=5&offset=0'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(10)
  })

  it('returns all students when search is empty', async () => {
    mockData = [
      { id: 'student-1', first_name: 'Jane', last_name: 'Smith' },
      { id: 'student-2', first_name: 'Bob', last_name: 'Jones' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/students'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/students'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/students
// ---------------------------------------------------------------------------
describe('POST /api/students', () => {
  const validBody = {
    first_name: 'Jane',
    last_name: 'Smith',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/students', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/students', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a student with minimal data', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
  })

  it('creates a student with all optional fields', async () => {
    const fullBody = {
      first_name: 'Jane',
      last_name: 'Smith',
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      email: 'jane@example.com',
      phone: '99001122',
      date_of_birth: '2010-05-15',
      guardian_name: 'John Smith',
      guardian_phone: '99003344',
      notes: 'Transfer student from another school',
    }
    const res = await POST(makeRequest('http://localhost/api/students', fullBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when first_name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {
      last_name: 'Smith',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when last_name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {
      first_name: 'Jane',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when first_name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {
      first_name: '',
      last_name: 'Smith',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when last_name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {
      first_name: 'Jane',
      last_name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'not-an-email',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid customer_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {
      first_name: 'Jane',
      last_name: 'Smith',
      customer_id: 'not-a-uuid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/students', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/students', {}))
    expect(res.status).toBe(400)
  })
})
