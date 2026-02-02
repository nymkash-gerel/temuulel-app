/**
 * Tests for GET/POST /api/packages
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
let mockLinkError: { message: string } | null = null
let mockRefetchedItem: Record<string, unknown> | null = null

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
  mockInsertError = null
  mockLinkError = null
  mockInsertedItem = {
    id: 'pkg-001',
    name: 'Deluxe Facial Package',
    description: 'A premium facial treatment package',
    price: 120000,
    original_price: 150000,
    valid_days: 90,
    is_active: true,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  }
  mockRefetchedItem = {
    ...mockInsertedItem,
    package_services: [
      { id: 'ps-001', service_id: 'svc-001', quantity: 2, services: { id: 'svc-001', name: 'Facial' } },
    ],
  }

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
    if (table === 'service_packages') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.single = vi.fn().mockResolvedValue({ data: mockRefetchedItem })
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
    if (table === 'package_services') {
      return {
        insert: vi.fn().mockResolvedValue({ error: mockLinkError }),
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
// GET /api/packages
// ---------------------------------------------------------------------------
describe('GET /api/packages', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/packages') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/packages') as never)
    expect(res.status).toBe(403)
  })

  it('returns packages list', async () => {
    mockData = [
      { id: 'pkg-1', name: 'Deluxe Facial', price: 120000, is_active: true },
      { id: 'pkg-2', name: 'Hair Treatment', price: 80000, is_active: true },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/packages') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no packages exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/packages') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports is_active=true filter', async () => {
    mockData = [{ id: 'pkg-1', is_active: true }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/packages?is_active=true') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports is_active=false filter', async () => {
    mockData = [{ id: 'pkg-2', is_active: false }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/packages?is_active=false') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns all packages when is_active is not specified', async () => {
    mockData = [
      { id: 'pkg-1', is_active: true },
      { id: 'pkg-2', is_active: false },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/packages') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'pkg-5' }]
    mockDataCount = 50
    const res = await GET(makeRequest('http://localhost/api/packages?limit=10&offset=20') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/packages') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/packages
// ---------------------------------------------------------------------------
describe('POST /api/packages', () => {
  const validBody = {
    name: 'Deluxe Facial Package',
    price: 120000,
    is_active: true,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/packages', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/packages', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a package with required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates a package with all optional fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      ...validBody,
      description: 'A premium facial treatment package',
      original_price: 150000,
      valid_days: 90,
    }) as never)
    expect(res.status).toBe(201)
  })

  it('creates a package with services', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      ...validBody,
      services: [
        { service_id: 'a0000000-0000-4000-8000-000000000001', quantity: 2 },
        { service_id: 'a0000000-0000-4000-8000-000000000002' },
      ],
    }) as never)
    expect(res.status).toBe(201)
  })

  it('creates a package without services', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', validBody) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      price: 120000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when price is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      name: 'Facial Package',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when price is zero', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      name: 'Facial Package',
      price: 0,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when price is negative', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      name: 'Facial Package',
      price: -100,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      name: '',
      price: 120000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when service_id is not a valid uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      ...validBody,
      services: [{ service_id: 'not-a-uuid' }],
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert database error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'Insert failed' }
    const res = await POST(makeRequest('http://localhost/api/packages', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 500 when linking services fails', async () => {
    mockLinkError = { message: 'Link error' }
    const res = await POST(makeRequest('http://localhost/api/packages', {
      ...validBody,
      services: [{ service_id: 'a0000000-0000-4000-8000-000000000001', quantity: 1 }],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Link error')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when valid_days is not a positive integer', async () => {
    const res = await POST(makeRequest('http://localhost/api/packages', {
      ...validBody,
      valid_days: -10,
    }) as never)
    expect(res.status).toBe(400)
  })
})
