/**
 * Tests for GET/PATCH /api/commissions/[id] (staff commissions)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true, limit: 30, remaining: 29, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockCommission: Record<string, unknown> | null = null
let mockUpdatedCommission: Record<string, unknown> | null = null
let mockUpdateError: { message: string } | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

import { GET, PATCH } from './route'

function makeGetRequest() {
  return createTestRequest('http://localhost/api/commissions/comm-001')
}

function makePatchRequest(body: unknown) {
  return createTestJsonRequest('http://localhost/api/commissions/comm-001', body, 'PATCH')
}

const params = Promise.resolve({ id: 'comm-001' })

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockCommission = {
    id: 'comm-001',
    staff_id: 'staff-001',
    sale_type: 'service',
    sale_amount: 50000,
    commission_rate: 15,
    commission_amount: 7500,
    status: 'pending',
    staff: { id: 'staff-001', name: 'Staff A' },
  }
  mockUpdatedCommission = { ...mockCommission, status: 'approved', updated_at: '2026-01-30T00:00:00Z' }
  mockUpdateError = null

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
    if (table === 'staff_commissions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockCommission, error: null }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedCommission, error: mockUpdateError }),
          })),
        })),
      }
    }
    return {}
  })
})

describe('GET /api/commissions/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(403)
  })

  it('returns 404 if commission not found', async () => {
    mockCommission = null
    const res = await GET(makeGetRequest(), { params })
    expect(res.status).toBe(404)
  })

  it('returns commission detail', async () => {
    const res = await GET(makeGetRequest(), { params })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('comm-001')
    expect(json.staff).toEqual({ id: 'staff-001', name: 'Staff A' })
  })
})

describe('PATCH /api/commissions/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await PATCH(makePatchRequest({ status: 'approved' }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await PATCH(makePatchRequest({ status: 'approved' }), { params })
    expect(res.status).toBe(403)
  })

  it('updates status to approved', async () => {
    mockUpdatedCommission = { ...mockCommission, status: 'approved' }
    const res = await PATCH(makePatchRequest({ status: 'approved' }), { params })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('approved')
  })

  it('updates status to paid', async () => {
    mockUpdatedCommission = { ...mockCommission, status: 'paid', paid_at: '2026-01-30T00:00:00Z' }
    const res = await PATCH(makePatchRequest({ status: 'paid' }), { params })
    expect(res.status).toBe(200)
  })

  it('updates status to cancelled', async () => {
    mockUpdatedCommission = { ...mockCommission, status: 'cancelled' }
    const res = await PATCH(makePatchRequest({ status: 'cancelled' }), { params })
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid status value', async () => {
    const res = await PATCH(makePatchRequest({ status: 'invalid' }), { params })
    expect(res.status).toBe(400)
  })

  it('accepts optional paid_at', async () => {
    mockUpdatedCommission = { ...mockCommission, status: 'paid', paid_at: '2026-01-30T12:00:00Z' }
    const res = await PATCH(makePatchRequest({ status: 'paid', paid_at: '2026-01-30T12:00:00Z' }), { params })
    expect(res.status).toBe(200)
  })

  it('returns 500 on database error', async () => {
    mockUpdateError = { message: 'DB error' }
    mockUpdatedCommission = null
    const res = await PATCH(makePatchRequest({ status: 'approved' }), { params })
    expect(res.status).toBe(500)
  })
})
