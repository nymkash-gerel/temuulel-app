/**
 * Tests for GET/POST /api/blocks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockBlocks: unknown[] = []
let mockBlocksCount: number = 0
let mockStaff: { id: string } | null = null
let mockResource: { id: string } | null = null
let mockInsertedBlock: Record<string, unknown> | null = null
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
  mockBlocks = []
  mockBlocksCount = 0
  mockStaff = { id: 'staff-001' }
  mockResource = { id: 'resource-001' }
  mockInsertedBlock = {
    id: 'block-001',
    staff_id: 'staff-001',
    resource_id: null,
    start_at: '2026-02-01T09:00:00Z',
    end_at: '2026-02-01T10:00:00Z',
    reason: 'Lunch break',
    block_type: 'break',
    recurring: null,
    created_at: '2026-01-30T00:00:00Z',
    updated_at: '2026-01-30T00:00:00Z',
    staff: { id: 'staff-001', name: 'Alice' },
    bookable_resources: null,
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
    if (table === 'blocks') {
      // The query builder must be chainable (.eq/.order/.range all return self)
      // AND thenable (awaiting the query resolves to the result).
      const blocksQuery: Record<string, unknown> = {}
      blocksQuery.eq = vi.fn(() => blocksQuery)
      blocksQuery.order = vi.fn(() => blocksQuery)
      blocksQuery.range = vi.fn(() => blocksQuery)
      blocksQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockBlocks, count: mockBlocksCount, error: mockSelectError }),
      )

      return {
        select: vi.fn(() => blocksQuery),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockInsertedBlock, error: mockInsertError }),
          })),
        })),
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
    if (table === 'bookable_resources') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockResource }),
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
// GET /api/blocks
// ---------------------------------------------------------------------------
describe('GET /api/blocks', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/blocks') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/blocks') as never)
    expect(res.status).toBe(403)
  })

  it('returns blocks list', async () => {
    mockBlocks = [
      { id: 'block-1', staff_id: 'staff-001', block_type: 'break', start_at: '2026-02-01T09:00:00Z' },
    ]
    mockBlocksCount = 1
    const res = await GET(makeRequest('http://localhost/api/blocks') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no blocks', async () => {
    mockBlocks = []
    mockBlocksCount = 0
    const res = await GET(makeRequest('http://localhost/api/blocks') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports staff_id filter', async () => {
    mockBlocks = [{ id: 'block-1', staff_id: 'staff-001' }]
    mockBlocksCount = 1
    const res = await GET(makeRequest('http://localhost/api/blocks?staff_id=staff-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports resource_id filter', async () => {
    mockBlocks = [{ id: 'block-2', resource_id: 'resource-001' }]
    mockBlocksCount = 1
    const res = await GET(makeRequest('http://localhost/api/blocks?resource_id=resource-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports block_type filter', async () => {
    mockBlocks = [{ id: 'block-3', block_type: 'holiday' }]
    mockBlocksCount = 1
    const res = await GET(makeRequest('http://localhost/api/blocks?block_type=holiday') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockBlocks = [{ id: 'block-4' }]
    mockBlocksCount = 50
    const res = await GET(makeRequest('http://localhost/api/blocks?limit=10&offset=20') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/blocks') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/blocks
// ---------------------------------------------------------------------------
describe('POST /api/blocks', () => {
  const validBody = {
    staff_id: 'a0000000-0000-4000-8000-000000000001',
    start_at: '2026-02-01T09:00:00Z',
    end_at: '2026-02-01T10:00:00Z',
    block_type: 'break',
    reason: 'Lunch break',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/blocks', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/blocks', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a block with staff_id', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.block_type).toBe('break')
  })

  it('creates a block with resource_id', async () => {
    mockInsertedBlock = {
      id: 'block-002',
      staff_id: null,
      resource_id: 'resource-001',
      start_at: '2026-02-01T14:00:00Z',
      end_at: '2026-02-01T15:00:00Z',
      reason: 'Maintenance window',
      block_type: 'maintenance',
      recurring: null,
      created_at: '2026-01-30T00:00:00Z',
      updated_at: '2026-01-30T00:00:00Z',
      staff: null,
      bookable_resources: { id: 'resource-001', name: 'Room A' },
    }
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      resource_id: 'a0000000-0000-4000-8000-000000000002',
      start_at: '2026-02-01T14:00:00Z',
      end_at: '2026-02-01T15:00:00Z',
      block_type: 'maintenance',
      reason: 'Maintenance window',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.resource_id).toBe('resource-001')
  })

  it('creates a block with default block_type (manual)', async () => {
    mockInsertedBlock = { ...mockInsertedBlock, block_type: 'manual' }
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T10:00:00Z',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.block_type).toBe('manual')
  })

  it('creates a block with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      resource_id: 'a0000000-0000-4000-8000-000000000002',
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T17:00:00Z',
      reason: 'Full day holiday',
      block_type: 'holiday',
      recurring: { freq: 'yearly', month: 2, day: 1 },
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when neither staff_id nor resource_id is provided', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T10:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when start_at is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      end_at: '2026-02-01T10:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when end_at is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      start_at: '2026-02-01T09:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid block_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T10:00:00Z',
      block_type: 'invalid_type',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when end_at is before start_at', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      start_at: '2026-02-01T10:00:00Z',
      end_at: '2026-02-01T09:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/end_at must be after start_at/)
  })

  it('returns 400 when end_at equals start_at', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'a0000000-0000-4000-8000-000000000001',
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T09:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/end_at must be after start_at/)
  })

  it('returns 400 for invalid staff_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      staff_id: 'not-a-uuid',
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T10:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid resource_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      resource_id: 'not-a-uuid',
      start_at: '2026-02-01T09:00:00Z',
      end_at: '2026-02-01T10:00:00Z',
      block_type: 'manual',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if staff not found in store', async () => {
    mockStaff = null
    const res = await POST(makeRequest('http://localhost/api/blocks', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Staff/)
  })

  it('returns 404 if resource not found in store', async () => {
    mockResource = null
    const res = await POST(makeRequest('http://localhost/api/blocks', {
      resource_id: 'a0000000-0000-4000-8000-000000000002',
      start_at: '2026-02-01T14:00:00Z',
      end_at: '2026-02-01T15:00:00Z',
      block_type: 'maintenance',
    }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Resource/)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedBlock = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makeRequest('http://localhost/api/blocks', validBody) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('DB error')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
