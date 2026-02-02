/**
 * Tests for POST /api/commissions/generate
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockClosedDeals: Record<string, unknown>[] = []
let mockExistingCommissions: { deal_id: string }[] = []
let mockInsertedCommissions: Record<string, unknown>[] = []
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

import { POST } from './route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/commissions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockClosedDeals = []
  mockExistingCommissions = []
  mockInsertedCommissions = []
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
          not: vi.fn(function () { return this }),
          in: vi.fn(function () { return this }),
          then: (resolve: (v: unknown) => void) => resolve({ data: mockClosedDeals, error: null }),
        })),
      }
    }
    if (table === 'agent_commissions') {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({ data: mockExistingCommissions }),
        })),
        insert: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ data: mockInsertedCommissions, error: mockInsertError }),
        })),
      }
    }
    return {}
  })
})

describe('POST /api/commissions/generate', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest({}) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest({}) as never)
    expect(res.status).toBe(403)
  })

  it('returns 0 generated when no closed deals', async () => {
    mockClosedDeals = []
    const res = await POST(makeRequest({}) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.generated).toBe(0)
    expect(json.message).toMatch(/No eligible/)
  })

  it('generates commissions for closed deals without existing records', async () => {
    mockClosedDeals = [
      { id: 'deal-1', agent_id: 'agent-1', final_price: 100000000, commission_amount: 5000000, agent_share_amount: 2500000, company_share_amount: 2500000 },
      { id: 'deal-2', agent_id: 'agent-2', final_price: 200000000, commission_amount: 10000000, agent_share_amount: 5000000, company_share_amount: 5000000 },
    ]
    mockExistingCommissions = []
    mockInsertedCommissions = [
      { id: 'comm-1', deal_id: 'deal-1', agent_id: 'agent-1', commission_amount: 5000000, agent_share: 2500000, company_share: 2500000, status: 'pending' },
      { id: 'comm-2', deal_id: 'deal-2', agent_id: 'agent-2', commission_amount: 10000000, agent_share: 5000000, company_share: 5000000, status: 'pending' },
    ]

    const res = await POST(makeRequest({}) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.generated).toBe(2)
    expect(json.commissions).toHaveLength(2)
  })

  it('skips deals that already have commissions', async () => {
    mockClosedDeals = [
      { id: 'deal-1', agent_id: 'agent-1', final_price: 100000000, commission_amount: 5000000, agent_share_amount: 2500000, company_share_amount: 2500000 },
      { id: 'deal-2', agent_id: 'agent-2', final_price: 200000000, commission_amount: 10000000, agent_share_amount: 5000000, company_share_amount: 5000000 },
    ]
    mockExistingCommissions = [{ deal_id: 'deal-1' }]
    mockInsertedCommissions = [
      { id: 'comm-2', deal_id: 'deal-2', agent_id: 'agent-2', commission_amount: 10000000, agent_share: 5000000, company_share: 5000000, status: 'pending' },
    ]

    const res = await POST(makeRequest({}) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.generated).toBe(1)
  })

  it('returns 0 when all deals already have commissions', async () => {
    mockClosedDeals = [
      { id: 'deal-1', agent_id: 'agent-1', final_price: 100000000, commission_amount: 5000000, agent_share_amount: 2500000, company_share_amount: 2500000 },
    ]
    mockExistingCommissions = [{ deal_id: 'deal-1' }]

    const res = await POST(makeRequest({}) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.generated).toBe(0)
    expect(json.message).toMatch(/already have commissions/)
  })

  it('accepts optional deal_ids filter', async () => {
    mockClosedDeals = [
      { id: 'a0000000-0000-4000-8000-000000000001', agent_id: 'agent-1', final_price: 100000000, commission_amount: 5000000, agent_share_amount: 2500000, company_share_amount: 2500000 },
    ]
    mockExistingCommissions = []
    mockInsertedCommissions = [
      { id: 'comm-1', deal_id: 'a0000000-0000-4000-8000-000000000001', status: 'pending' },
    ]

    const res = await POST(makeRequest({
      deal_ids: ['a0000000-0000-4000-8000-000000000001'],
    }) as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.generated).toBe(1)
  })

  it('returns 500 on insert error', async () => {
    mockClosedDeals = [
      { id: 'deal-1', agent_id: 'agent-1', final_price: 100000000, commission_amount: 5000000, agent_share_amount: 2500000, company_share_amount: 2500000 },
    ]
    mockExistingCommissions = []
    mockInsertError = { message: 'DB error' }

    const res = await POST(makeRequest({}) as never)
    expect(res.status).toBe(500)
  })
})
