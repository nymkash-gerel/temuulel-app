/**
 * Tests for GET/POST /api/deals
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 20, remaining: 19, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockDeals: unknown[] = []
let mockDealsCount: number = 0
let mockProperty: { id: string } | null = null
let mockAgent: { id: string } | null = null
let mockInsertedDeal: Record<string, unknown> | null = null
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
import { rateLimit } from '@/lib/rate-limit'

function chainable(finalValue: unknown): Record<string, unknown> {
  const self: Record<string, unknown> = {}
  const fn = () => self
  self.select = fn
  self.eq = fn
  self.order = fn
  self.range = vi.fn().mockResolvedValue(finalValue)
  self.single = vi.fn().mockResolvedValue(finalValue)
  self.not = fn
  self.in = fn
  return self
}

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
  mockDeals = []
  mockDealsCount = 0
  mockProperty = { id: 'prop-001' }
  mockAgent = { id: 'agent-001' }
  mockInsertedDeal = {
    id: 'deal-001',
    deal_number: 'DEAL-12345',
    status: 'lead',
    deal_type: 'sale',
    asking_price: 100000000,
    commission_rate: 5,
    agent_share_rate: 50,
    notes: null,
    created_at: '2026-01-30T00:00:00Z',
    products: null,
    customers: null,
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
    if (table === 'deals') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          order: vi.fn(function () { return this }),
          range: vi.fn().mockResolvedValue({ data: mockDeals, count: mockDealsCount, error: null }),
          single: vi.fn().mockResolvedValue({ data: mockInsertedDeal, error: mockInsertError }),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockInsertedDeal, error: mockInsertError }),
          })),
        })),
      }
    }
    if (table === 'products') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockProperty }),
        })),
      }
    }
    if (table === 'staff') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockAgent }),
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

describe('GET /api/deals', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/deals') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/deals') as never)
    expect(res.status).toBe(403)
  })

  it('returns deals list', async () => {
    mockDeals = [{ id: 'deal-1', deal_number: 'DEAL-001', status: 'lead' }]
    mockDealsCount = 1
    const res = await GET(makeRequest('http://localhost/api/deals') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no deals', async () => {
    mockDeals = []
    mockDealsCount = 0
    const res = await GET(makeRequest('http://localhost/api/deals') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })
})

describe('POST /api/deals', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/deals', { deal_type: 'sale' }) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/deals', { deal_type: 'sale' }) as never)
    expect(res.status).toBe(403)
  })

  it('creates a deal with minimal data', async () => {
    const res = await POST(makeRequest('http://localhost/api/deals', {
      deal_type: 'sale',
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.deal_number).toBeDefined()
    expect(json.status).toBe('lead')
  })

  it('creates a deal with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/deals', {
      property_id: 'a0000000-0000-4000-8000-000000000001',
      customer_id: 'a0000000-0000-4000-8000-000000000002',
      agent_id: 'a0000000-0000-4000-8000-000000000003',
      deal_type: 'rent',
      asking_price: 500000,
      commission_rate: 3,
      agent_share_rate: 60,
      notes: 'Test deal',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid deal_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/deals', {
      deal_type: 'invalid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative asking_price', async () => {
    const res = await POST(makeRequest('http://localhost/api/deals', {
      deal_type: 'sale',
      asking_price: -100,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for commission_rate over 100', async () => {
    const res = await POST(makeRequest('http://localhost/api/deals', {
      deal_type: 'sale',
      commission_rate: 150,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if property not found', async () => {
    mockProperty = null
    const res = await POST(makeRequest('http://localhost/api/deals', {
      property_id: 'a0000000-0000-4000-8000-000000000099',
      deal_type: 'sale',
    }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Property/)
  })

  it('returns 404 if agent not found', async () => {
    mockAgent = null
    const res = await POST(makeRequest('http://localhost/api/deals', {
      agent_id: 'a0000000-0000-4000-8000-000000000099',
      deal_type: 'sale',
    }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Agent/)
  })

  it('returns 500 on database error', async () => {
    mockInsertedDeal = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makeRequest('http://localhost/api/deals', {
      deal_type: 'sale',
    }) as never)
    expect(res.status).toBe(500)
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({
      success: false, limit: 20, remaining: 0, resetAt: Date.now() + 60000,
    })
    const res = await POST(makeRequest('http://localhost/api/deals', { deal_type: 'sale' }) as never)
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
