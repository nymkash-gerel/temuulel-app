/**
 * Tests for GET/PATCH/DELETE /api/deals/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockDeal: Record<string, unknown> | null = null
let mockUpdatedDeal: Record<string, unknown> | null = null
let mockUpdateError: { message: string } | null = null
let mockDeleteError: { message: string } | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

import { GET, PATCH, DELETE } from './route'

function makeGetRequest(): Request {
  return new Request('http://localhost/api/deals/deal-001', { method: 'GET' })
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/deals/deal-001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(): Request {
  return new Request('http://localhost/api/deals/deal-001', { method: 'DELETE' })
}

const params = Promise.resolve({ id: 'deal-001' })

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockDeal = {
    id: 'deal-001',
    deal_number: 'DEAL-001',
    status: 'lead',
    deal_type: 'sale',
    store_id: 'store-001',
    asking_price: 100000000,
    offer_price: null,
    final_price: null,
    commission_rate: 5,
    agent_share_rate: 50,
    agent_id: 'agent-001',
    viewing_date: null,
    offer_date: null,
    contract_date: null,
    notes: null,
    metadata: {},
  }
  mockUpdatedDeal = { ...mockDeal, updated_at: '2026-01-30T12:00:00Z' }
  mockUpdateError = null
  mockDeleteError = null

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
          single: vi.fn().mockResolvedValue({ data: mockDeal, error: mockDeal ? null : { message: 'Not found' } }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedDeal, error: mockUpdateError }),
            })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: mockDeleteError }),
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

describe('GET /api/deals/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await GET(makeGetRequest() as never, { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await GET(makeGetRequest() as never, { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 if deal not found', async () => {
    mockDeal = null
    const res = await GET(makeGetRequest() as never, { params })
    expect(res.status).toBe(404)
  })

  it('returns deal with related data', async () => {
    const res = await GET(makeGetRequest() as never, { params })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.deal_number).toBe('DEAL-001')
  })
})

describe('PATCH /api/deals/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await PATCH(makePatchRequest({ status: 'viewing' }) as never, { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 if deal not found', async () => {
    mockDeal = null
    const res = await PATCH(makePatchRequest({ status: 'viewing' }) as never, { params })
    expect(res.status).toBe(404)
  })

  // Status transition tests
  it('allows lead → viewing', async () => {
    mockDeal = { ...mockDeal!, status: 'lead' }
    mockUpdatedDeal = { ...mockDeal, status: 'viewing' }
    const res = await PATCH(makePatchRequest({ status: 'viewing' }) as never, { params })
    expect(res.status).toBe(200)
  })

  it('allows lead → lost', async () => {
    mockDeal = { ...mockDeal!, status: 'lead' }
    mockUpdatedDeal = { ...mockDeal, status: 'lost' }
    const res = await PATCH(makePatchRequest({ status: 'lost' }) as never, { params })
    expect(res.status).toBe(200)
  })

  it('allows viewing → offer', async () => {
    mockDeal = { ...mockDeal!, status: 'viewing' }
    mockUpdatedDeal = { ...mockDeal, status: 'offer' }
    const res = await PATCH(makePatchRequest({ status: 'offer' }) as never, { params })
    expect(res.status).toBe(200)
  })

  it('allows offer → contract', async () => {
    mockDeal = { ...mockDeal!, status: 'offer' }
    mockUpdatedDeal = { ...mockDeal, status: 'contract' }
    const res = await PATCH(makePatchRequest({ status: 'contract' }) as never, { params })
    expect(res.status).toBe(200)
  })

  it('allows contract → closed with auto-commission calculation', async () => {
    mockDeal = { ...mockDeal!, status: 'contract', asking_price: 100000000, commission_rate: 5, agent_share_rate: 50 }
    mockUpdatedDeal = {
      ...mockDeal,
      status: 'closed',
      final_price: 100000000,
      commission_amount: 5000000,
      agent_share_amount: 2500000,
      company_share_amount: 2500000,
    }
    const res = await PATCH(makePatchRequest({ status: 'closed', final_price: 100000000 }) as never, { params })
    expect(res.status).toBe(200)
  })

  it('allows contract → withdrawn', async () => {
    mockDeal = { ...mockDeal!, status: 'contract' }
    mockUpdatedDeal = { ...mockDeal, status: 'withdrawn' }
    const res = await PATCH(makePatchRequest({ status: 'withdrawn' }) as never, { params })
    expect(res.status).toBe(200)
  })

  // Invalid transitions
  it('rejects lead → contract (skipping steps)', async () => {
    mockDeal = { ...mockDeal!, status: 'lead' }
    const res = await PATCH(makePatchRequest({ status: 'contract' }) as never, { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Cannot transition/)
  })

  it('rejects lead → closed (skipping steps)', async () => {
    mockDeal = { ...mockDeal!, status: 'lead' }
    const res = await PATCH(makePatchRequest({ status: 'closed' }) as never, { params })
    expect(res.status).toBe(400)
  })

  it('rejects viewing → closed', async () => {
    mockDeal = { ...mockDeal!, status: 'viewing' }
    const res = await PATCH(makePatchRequest({ status: 'closed' }) as never, { params })
    expect(res.status).toBe(400)
  })

  it('rejects closed → anything (terminal state)', async () => {
    mockDeal = { ...mockDeal!, status: 'closed' }
    const res = await PATCH(makePatchRequest({ status: 'lead' }) as never, { params })
    expect(res.status).toBe(400)
  })

  it('rejects lost → anything (terminal state)', async () => {
    mockDeal = { ...mockDeal!, status: 'lost' }
    const res = await PATCH(makePatchRequest({ status: 'viewing' }) as never, { params })
    expect(res.status).toBe(400)
  })

  it('rejects withdrawn → anything (terminal state)', async () => {
    mockDeal = { ...mockDeal!, status: 'withdrawn' }
    const res = await PATCH(makePatchRequest({ status: 'closed' }) as never, { params })
    expect(res.status).toBe(400)
  })

  // Field updates
  it('updates notes without changing status', async () => {
    mockUpdatedDeal = { ...mockDeal!, notes: 'Updated note' }
    const res = await PATCH(makePatchRequest({ notes: 'Updated note' }) as never, { params })
    expect(res.status).toBe(200)
  })

  it('returns 400 for empty update', async () => {
    const res = await PATCH(makePatchRequest({}) as never, { params })
    expect(res.status).toBe(400)
  })

  it('returns 500 on database error', async () => {
    mockUpdateError = { message: 'DB error' }
    const res = await PATCH(makePatchRequest({ notes: 'test' }) as never, { params })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/deals/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(401)
  })

  it('returns 404 if deal not found', async () => {
    mockDeal = null
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(404)
  })

  it('deletes a deal in lead status', async () => {
    mockDeal = { ...mockDeal!, status: 'lead' }
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(200)
  })

  it('deletes a deal in lost status', async () => {
    mockDeal = { ...mockDeal!, status: 'lost' }
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(200)
  })

  it('rejects delete of a deal in viewing status', async () => {
    mockDeal = { ...mockDeal!, status: 'viewing' }
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Only lead or lost/)
  })

  it('rejects delete of a deal in closed status', async () => {
    mockDeal = { ...mockDeal!, status: 'closed' }
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(400)
  })

  it('rejects delete of a deal in contract status', async () => {
    mockDeal = { ...mockDeal!, status: 'contract' }
    const res = await DELETE(makeDeleteRequest() as never, { params })
    expect(res.status).toBe(400)
  })
})
