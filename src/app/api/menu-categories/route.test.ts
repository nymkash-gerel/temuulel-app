/**
 * Tests for GET/POST /api/menu-categories
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
    id: 'cat-001',
    name: 'Appetizers',
    description: 'Starters and small bites',
    image_url: null,
    sort_order: 0,
    is_active: true,
    available_from: null,
    available_until: null,
    created_at: '2026-01-30T00:00:00Z',
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
    if (table === 'menu_categories') {
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
// GET /api/menu-categories
// ---------------------------------------------------------------------------
describe('GET /api/menu-categories', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/menu-categories'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/menu-categories'))
    expect(res.status).toBe(403)
  })

  it('returns menu categories list', async () => {
    mockData = [
      { id: 'cat-1', name: 'Appetizers', sort_order: 0, is_active: true },
      { id: 'cat-2', name: 'Main Course', sort_order: 1, is_active: true },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/menu-categories'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no categories exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/menu-categories'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'cat-3', name: 'Desserts' }]
    mockDataCount = 50
    const res = await GET(makeRequest('http://localhost/api/menu-categories?limit=10&offset=20'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/menu-categories'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/menu-categories
// ---------------------------------------------------------------------------
describe('POST /api/menu-categories', () => {
  const validBody = {
    name: 'Appetizers',
    description: 'Starters and small bites',
    sort_order: 0,
    is_active: true,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/menu-categories', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/menu-categories', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a menu category with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', { name: 'Drinks' }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates a menu category with all fields', async () => {
    mockInsertedItem = {
      id: 'cat-002',
      name: 'Lunch Specials',
      description: 'Available at lunch only',
      image_url: null,
      sort_order: 5,
      is_active: true,
      available_from: '11:00',
      available_until: '14:00',
      created_at: '2026-01-30T00:00:00Z',
    }
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      name: 'Lunch Specials',
      description: 'Available at lunch only',
      sort_order: 5,
      is_active: true,
      available_from: '11:00',
      available_until: '14:00',
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.name).toBe('Lunch Specials')
    expect(json.available_from).toBe('11:00')
    expect(json.available_until).toBe('14:00')
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      description: 'No name provided',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is whitespace only', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      name: '   ',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid available_from format', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      name: 'Brunch',
      available_from: 'not-a-time',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid available_until format', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      name: 'Brunch',
      available_until: 'bad-time',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid sort_order type', async () => {
    const res = await POST(makeRequest('http://localhost/api/menu-categories', {
      name: 'Snacks',
      sort_order: 'not-a-number',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/menu-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makeRequest('http://localhost/api/menu-categories', validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB error')
  })
})
