/**
 * Tests for GET/POST /api/suppliers
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
    id: 'sup-001',
    name: 'Acme Supplies',
    contact_name: 'John Doe',
    email: 'john@acme.com',
    phone: '+97699112233',
    address: '123 Main St',
    payment_terms: 'net_30',
    is_active: true,
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
    if (table === 'suppliers') {
      // Build a chainable + thenable query for GET
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.ilike = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // Build an insert chain for POST
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
// GET /api/suppliers
// ---------------------------------------------------------------------------
describe('GET /api/suppliers', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/suppliers'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/suppliers'))
    expect(res.status).toBe(403)
  })

  it('returns suppliers list', async () => {
    mockData = [
      { id: 'sup-1', name: 'Acme Supplies', is_active: true },
      { id: 'sup-2', name: 'Global Parts', is_active: true },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/suppliers'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no suppliers', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/suppliers'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports search filter on name', async () => {
    mockData = [{ id: 'sup-1', name: 'Acme Supplies' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/suppliers?search=Acme'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'sup-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/suppliers?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns results without search param', async () => {
    mockData = [{ id: 'sup-1', name: 'Alpha' }, { id: 'sup-2', name: 'Beta' }]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/suppliers'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/suppliers'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/suppliers
// ---------------------------------------------------------------------------
describe('POST /api/suppliers', () => {
  const validBody = {
    name: 'Acme Supplies',
    contact_name: 'John Doe',
    email: 'john@acme.com',
    phone: '+97699112233',
    address: '123 Main St',
    payment_terms: 'net_30',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/suppliers', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/suppliers', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a supplier with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.name).toBe('Acme Supplies')
  })

  it('creates a supplier with only required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', {
      name: 'Minimal Supplier',
    }))
    expect(res.status).toBe(201)
  })

  it('creates a supplier with email and phone', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', {
      name: 'Test Supplier',
      email: 'test@supplier.com',
      phone: '12345',
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', {
      contact_name: 'John',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', {
      name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', {
      name: 'Test',
      email: 'not-an-email',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid payment_terms', async () => {
    const res = await POST(makeRequest('http://localhost/api/suppliers', {
      name: 'Test',
      payment_terms: 'net_999',
    }))
    expect(res.status).toBe(400)
  })

  it('accepts all valid payment_terms values', async () => {
    for (const pt of ['cod', 'net_15', 'net_30', 'net_60', 'prepaid']) {
      const res = await POST(makeRequest('http://localhost/api/suppliers', {
        name: `Supplier ${pt}`,
        payment_terms: pt,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 when database insert fails', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/suppliers', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
