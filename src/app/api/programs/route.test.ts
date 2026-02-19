/**
 * Tests for GET/POST /api/programs
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(async () => ({ success: true, limit: 30, remaining: 29, resetAt: Date.now() + 60000 })),
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
    id: 'prog-001',
    name: 'Web Development Bootcamp',
    description: 'A 12-week course',
    program_type: 'course',
    duration_weeks: 12,
    price: 99900,
    max_students: 30,
    is_active: true,
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
    if (table === 'programs') {
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
// GET /api/programs
// ---------------------------------------------------------------------------
describe('GET /api/programs', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/programs'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/programs'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns programs list', async () => {
    mockData = [
      { id: 'prog-1', name: 'Web Dev', program_type: 'course', is_active: true },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/programs'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no programs', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/programs'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports is_active filter (true)', async () => {
    mockData = [{ id: 'prog-1', is_active: true }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/programs?is_active=true'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports is_active filter (false)', async () => {
    mockData = [{ id: 'prog-2', is_active: false }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/programs?is_active=false'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports program_type filter', async () => {
    mockData = [{ id: 'prog-1', program_type: 'workshop' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/programs?program_type=workshop'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid program_type filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/programs?program_type=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'prog-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/programs?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'prog-1', program_type: 'course', is_active: true }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/programs?is_active=true&program_type=course'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/programs'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/programs
// ---------------------------------------------------------------------------
describe('POST /api/programs', () => {
  const validBody = {
    name: 'Web Development Bootcamp',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/programs', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/programs', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a program with minimal data', async () => {
    const res = await POST(makeRequest('http://localhost/api/programs', validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
  })

  it('creates a program with all optional fields', async () => {
    const fullBody = {
      name: 'Data Science Certificate',
      description: 'A comprehensive data science program',
      program_type: 'certification',
      duration_weeks: 24,
      price: 199900,
      max_students: 25,
      is_active: false,
    }
    const res = await POST(makeRequest('http://localhost/api/programs', fullBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/programs', {
      description: 'No name provided',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/programs', {
      name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid program_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/programs', {
      name: 'Test',
      program_type: 'invalid_type',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative duration_weeks', async () => {
    const res = await POST(makeRequest('http://localhost/api/programs', {
      name: 'Test',
      duration_weeks: -1,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative price', async () => {
    const res = await POST(makeRequest('http://localhost/api/programs', {
      name: 'Test',
      price: -100,
    }))
    expect(res.status).toBe(400)
  })

  it('accepts all valid program types', async () => {
    for (const pt of ['course', 'workshop', 'seminar', 'certification', 'tutoring']) {
      const res = await POST(makeRequest('http://localhost/api/programs', {
        name: `Test ${pt}`,
        program_type: pt,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/programs', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
