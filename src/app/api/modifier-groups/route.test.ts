/**
 * Tests for GET/POST /api/modifier-groups
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
let mockModifierInsertError: { message: string } | null = null
let mockRefetchedItem: Record<string, unknown> | null = null
let mockRefetchError: { message: string } | null = null

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
    id: 'mg-001',
    name: 'Size',
    selection_type: 'single',
    min_selections: 0,
    max_selections: 1,
    is_required: false,
    sort_order: 0,
    created_at: '2026-01-30T00:00:00Z',
  }
  mockInsertError = null
  mockSelectError = null
  mockModifierInsertError = null
  mockRefetchedItem = {
    id: 'mg-001',
    name: 'Size',
    selection_type: 'single',
    min_selections: 0,
    max_selections: 1,
    is_required: false,
    sort_order: 0,
    created_at: '2026-01-30T00:00:00Z',
    modifiers: [],
  }
  mockRefetchError = null

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
    if (table === 'modifier_groups') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      return {
        select: vi.fn((selectStr?: string) => {
          // Re-fetch after insert uses .eq().single()
          if (selectStr && selectStr.includes('modifiers(')) {
            // This may be the initial GET query OR the re-fetch after POST.
            // For GET, we return the chainable dataQuery.
            // For re-fetch (POST), we need .eq().single() pattern.
            // We distinguish by checking if insert was called before this select.
            // Simplify: always return the chainable query that also supports .eq().single().
            const refetchQuery: Record<string, unknown> = {}
            refetchQuery.eq = vi.fn(() => refetchQuery)
            refetchQuery.order = vi.fn(() => refetchQuery)
            refetchQuery.range = vi.fn(() => refetchQuery)
            refetchQuery.single = vi.fn().mockResolvedValue({ data: mockRefetchedItem, error: mockRefetchError })
            refetchQuery.then = vi.fn((resolve: (v: unknown) => void) =>
              resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
            )
            return refetchQuery
          }
          return dataQuery
        }),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockInsertedItem, error: mockInsertError }),
          })),
        })),
      }
    }
    if (table === 'modifiers') {
      return {
        insert: vi.fn().mockResolvedValue({ error: mockModifierInsertError }),
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
// GET /api/modifier-groups
// ---------------------------------------------------------------------------
describe('GET /api/modifier-groups', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/modifier-groups'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/modifier-groups'))
    expect(res.status).toBe(403)
  })

  it('returns modifier groups list with nested modifiers', async () => {
    mockData = [
      {
        id: 'mg-1', name: 'Size', selection_type: 'single',
        modifiers: [{ id: 'mod-1', name: 'Small', price_adjustment: 0 }],
      },
      {
        id: 'mg-2', name: 'Toppings', selection_type: 'multiple',
        modifiers: [{ id: 'mod-2', name: 'Cheese', price_adjustment: 1.5 }],
      },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/modifier-groups'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no modifier groups exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/modifier-groups'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'mg-3', name: 'Extras' }]
    mockDataCount = 40
    const res = await GET(makeRequest('http://localhost/api/modifier-groups?limit=5&offset=10'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(40)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/modifier-groups'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/modifier-groups
// ---------------------------------------------------------------------------
describe('POST /api/modifier-groups', () => {
  const validBody = {
    name: 'Size',
    selection_type: 'single',
    min_selections: 0,
    max_selections: 1,
    is_required: false,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a modifier group with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', { name: 'Extras' }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.name).toBe('Size')
  })

  it('creates a modifier group with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: 'Toppings',
      selection_type: 'multiple',
      min_selections: 1,
      max_selections: 5,
      is_required: true,
      sort_order: 2,
    }))
    expect(res.status).toBe(201)
  })

  it('creates a modifier group with inline modifiers', async () => {
    mockRefetchedItem = {
      id: 'mg-001',
      name: 'Size',
      selection_type: 'single',
      min_selections: 0,
      max_selections: 1,
      is_required: false,
      sort_order: 0,
      created_at: '2026-01-30T00:00:00Z',
      modifiers: [
        { id: 'mod-1', name: 'Small', price_adjustment: 0, is_default: true, is_available: true, sort_order: 0 },
        { id: 'mod-2', name: 'Large', price_adjustment: 2, is_default: false, is_available: true, sort_order: 1 },
      ],
    }
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: 'Size',
      modifiers: [
        { name: 'Small', price_adjustment: 0, is_default: true, is_available: true, sort_order: 0 },
        { name: 'Large', price_adjustment: 2, is_default: false, is_available: true, sort_order: 1 },
      ],
    }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.modifiers).toHaveLength(2)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      selection_type: 'single',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid selection_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: 'Extras',
      selection_type: 'invalid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative min_selections', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: 'Extras',
      min_selections: -1,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for max_selections less than 1', async () => {
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: 'Extras',
      max_selections: 0,
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/modifier-groups', {
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
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', validBody))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB error')
  })

  it('returns 500 when inline modifier insert fails', async () => {
    mockModifierInsertError = { message: 'Modifier insert failed' }
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', {
      name: 'Size',
      modifiers: [
        { name: 'Small', price_adjustment: 0 },
      ],
    }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Modifier insert failed')
  })

  it('returns 500 when re-fetch after insert fails', async () => {
    mockRefetchedItem = null
    mockRefetchError = { message: 'Re-fetch failed' }
    const res = await POST(makeRequest('http://localhost/api/modifier-groups', { name: 'Extras' }))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Re-fetch failed')
  })
})
