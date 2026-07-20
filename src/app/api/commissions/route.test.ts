/**
 * Tests for GET/POST /api/commissions (real-estate agent commissions)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockCommissions: unknown[] = []
let mockCommissionsCount: number = 0
let mockDeal: { id: string } | null = null
let mockAgent: { id: string } | null = null
let mockInsertedCommission: Record<string, unknown> | null = null
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

function makeGetRequest(url = 'http://localhost/api/commissions') {
  return createTestRequest(url)
}

function makePostRequest(body: unknown) {
  return createTestJsonRequest('http://localhost/api/commissions', body)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockCommissions = []
  mockCommissionsCount = 0
  mockDeal = { id: 'deal-001' }
  mockAgent = { id: 'staff-001' }
  mockInsertedCommission = {
    id: 'comm-001',
    deal_id: 'deal-001',
    agent_id: 'staff-001',
    commission_amount: 1000000,
    agent_share: 500000,
    company_share: 500000,
    status: 'pending',
    created_at: '2026-01-30T00:00:00Z',
    deals: { id: 'deal-001', deal_number: 'D-001', final_price: 20000000, deal_type: 'sale', status: 'closed', products: null },
    staff: { id: 'staff-001', name: 'Agent A', phone: '99001122' },
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
    if (table === 'agent_commissions') {
      // Chainable + thenable builder so the route can apply .eq() filters AFTER .range()
      const listBuilder: any = {}
      listBuilder.eq = vi.fn(() => listBuilder)
      listBuilder.order = vi.fn(() => listBuilder)
      listBuilder.range = vi.fn(() => listBuilder)
      listBuilder.then = (resolve: any) =>
        resolve({ data: mockCommissions, count: mockCommissionsCount, error: null })
      return {
        select: vi.fn(() => listBuilder),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockInsertedCommission, error: mockInsertError }),
          })),
        })),
      }
    }
    if (table === 'deals') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockDeal }),
        })),
      }
    }
    if (table === 'staff') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockAgent }),
        })),
      }
    }
    return {}
  })
})

describe('GET /api/commissions', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('returns agent commissions list', async () => {
    mockCommissions = [{ id: 'comm-1', status: 'pending', commission_amount: 1000000, agent_share: 500000 }]
    mockCommissionsCount = 1
    const res = await GET(makeGetRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no commissions', async () => {
    const res = await GET(makeGetRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('filters by status and agent_id without error', async () => {
    const res = await GET(makeGetRequest('http://localhost/api/commissions?status=paid&agent_id=staff-001'))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/commissions', () => {
  const validBody = {
    deal_id: 'a0000000-0000-4000-8000-000000000001',
    agent_id: 'a0000000-0000-4000-8000-000000000002',
    commission_amount: 1000000,
    agent_share: 500000,
    company_share: 500000,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('creates an agent commission', async () => {
    const res = await POST(makePostRequest(validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('comm-001')
    expect(json.status).toBe('pending')
  })

  it('returns 400 for missing deal_id', async () => {
    const { deal_id: _, ...rest } = validBody
    void _
    const res = await POST(makePostRequest(rest))
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing agent_id', async () => {
    const { agent_id: _, ...rest } = validBody
    void _
    const res = await POST(makePostRequest(rest))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative agent_share', async () => {
    const res = await POST(makePostRequest({ ...validBody, agent_share: -5 }))
    expect(res.status).toBe(400)
  })

  it('returns 404 if deal not found (cross-tenant guard)', async () => {
    mockDeal = null
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Deal/)
  })

  it('returns 404 if agent not found (cross-tenant guard)', async () => {
    mockAgent = null
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Agent/)
  })

  it('returns 500 on database error', async () => {
    mockInsertedCommission = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(500)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = createTestRequest('http://localhost/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
