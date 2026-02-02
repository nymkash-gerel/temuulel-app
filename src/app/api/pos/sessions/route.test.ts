/**
 * Tests for GET/POST /api/pos/sessions
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
let mockStaff: { id: string } | null = null

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
  mockStaff = { id: 'staff-001' }
  mockInsertedItem = {
    id: 'sess-001',
    opened_by: 'staff-001',
    closed_by: null,
    register_name: 'Register 1',
    opening_cash: 50000,
    closing_cash: null,
    total_sales: 0,
    total_transactions: 0,
    status: 'open',
    opened_at: '2026-02-01T09:00:00Z',
    closed_at: null,
    created_at: '2026-02-01T09:00:00Z',
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
    if (table === 'pos_sessions') {
      // Chainable + thenable for GET
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // Insert chain for POST
      const insertQuery: Record<string, unknown> = {}
      insertQuery.select = vi.fn(() => insertQuery)
      insertQuery.single = vi.fn().mockResolvedValue({
        data: mockInsertedItem,
        error: mockInsertError,
      })

      return {
        select: vi.fn(() => dataQuery),
        insert: vi.fn(() => insertQuery),
      }
    }
    if (table === 'staff') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockStaff }),
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
// GET /api/pos/sessions
// ---------------------------------------------------------------------------
describe('GET /api/pos/sessions', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    expect(res.status).toBe(403)
  })

  it('returns POS sessions list', async () => {
    mockData = [
      { id: 'sess-1', register_name: 'Register 1', status: 'open', total_sales: 250000 },
      { id: 'sess-2', register_name: 'Register 2', status: 'closed', total_sales: 180000 },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no sessions', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'sess-5' }]
    mockDataCount = 50
    const res = await GET(makeRequest('http://localhost/api/pos/sessions?limit=10&offset=20') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('returns sessions ordered by created_at descending', async () => {
    mockData = [
      { id: 'sess-2', created_at: '2026-02-01T12:00:00Z' },
      { id: 'sess-1', created_at: '2026-02-01T09:00:00Z' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data[0].id).toBe('sess-2')
  })

  it('returns sessions with all expected fields', async () => {
    mockData = [{
      id: 'sess-1',
      opened_by: 'staff-001',
      closed_by: null,
      register_name: 'Register 1',
      opening_cash: 50000,
      closing_cash: null,
      total_sales: 0,
      total_transactions: 0,
      status: 'open',
      opened_at: '2026-02-01T09:00:00Z',
      closed_at: null,
      created_at: '2026-02-01T09:00:00Z',
    }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data[0]).toHaveProperty('opened_by')
    expect(json.data[0]).toHaveProperty('register_name')
    expect(json.data[0]).toHaveProperty('opening_cash')
    expect(json.data[0]).toHaveProperty('status')
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/pos/sessions') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/pos/sessions
// ---------------------------------------------------------------------------
describe('POST /api/pos/sessions', () => {
  const validBody = {
    register_name: 'Register 1',
    opening_cash: 50000,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('returns 403 if user has no staff record', async () => {
    mockStaff = null
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.error).toMatch(/Staff record not found/)
  })

  it('opens a POS session with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.status).toBe('open')
    expect(json.register_name).toBe('Register 1')
    expect(json.opening_cash).toBe(50000)
  })

  it('opens a POS session without optional fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', {}) as never)
    expect(res.status).toBe(201)
  })

  it('opens a session with only register_name', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', {
      register_name: 'Front Counter',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('opens a session with only opening_cash', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', {
      opening_cash: 100000,
    }) as never)
    expect(res.status).toBe(201)
  })

  it('opens a session with zero opening_cash', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', {
      opening_cash: 0,
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 for negative opening_cash', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', {
      opening_cash: -5000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/pos/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when register_name exceeds max length', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', {
      register_name: 'A'.repeat(101),
    }) as never)
    expect(res.status).toBe(400)
  })

  it('session is created with opened_by from staff record', async () => {
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.opened_by).toBe('staff-001')
  })

  it('returns 500 when database insert fails', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/pos/sessions', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
