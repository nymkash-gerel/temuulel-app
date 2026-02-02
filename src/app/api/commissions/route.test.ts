/**
 * Tests for GET/POST /api/commissions (staff commissions)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockCommissions: unknown[] = []
let mockCommissionsCount: number = 0
let mockStaff: { id: string; name: string } | null = null
let mockAppointment: { id: string } | null = null
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

function makeGetRequest(url = 'http://localhost/api/commissions'): Request {
  return new Request(url, { method: 'GET' })
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/commissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockCommissions = []
  mockCommissionsCount = 0
  mockStaff = { id: 'staff-001', name: 'Staff A' }
  mockAppointment = { id: 'appt-001' }
  mockInsertedCommission = {
    id: 'comm-001',
    staff_id: 'staff-001',
    sale_type: 'service',
    sale_amount: 50000,
    commission_rate: 15,
    commission_amount: 7500,
    status: 'pending',
    created_at: '2026-01-30T00:00:00Z',
    staff: { id: 'staff-001', name: 'Staff A' },
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
    if (table === 'staff_commissions') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          order: vi.fn(function (this: any) { return this }),
          range: vi.fn().mockResolvedValue({ data: mockCommissions, count: mockCommissionsCount, error: null }),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockInsertedCommission, error: mockInsertError }),
          })),
        })),
      }
    }
    if (table === 'staff') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockStaff }),
        })),
      }
    }
    if (table === 'appointments') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockAppointment }),
        })),
      }
    }
    return {}
  })
})

describe('GET /api/commissions', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await GET(makeGetRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await GET(makeGetRequest() as never)
    expect(res.status).toBe(403)
  })

  it('returns commissions list', async () => {
    mockCommissions = [{ id: 'comm-1', status: 'pending', commission_amount: 7500 }]
    mockCommissionsCount = 1
    const res = await GET(makeGetRequest() as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no commissions', async () => {
    const res = await GET(makeGetRequest() as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })
})

describe('POST /api/commissions', () => {
  const validBody = {
    staff_id: 'a0000000-0000-4000-8000-000000000001',
    sale_amount: 50000,
    commission_rate: 15,
    commission_amount: 7500,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makePostRequest(validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makePostRequest(validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a commission', async () => {
    const res = await POST(makePostRequest(validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('comm-001')
    expect(json.status).toBe('pending')
  })

  it('creates with optional appointment_id', async () => {
    const res = await POST(makePostRequest({
      ...validBody,
      appointment_id: 'a0000000-0000-4000-8000-000000000003',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('creates with optional sale_type', async () => {
    const res = await POST(makePostRequest({
      ...validBody,
      sale_type: 'product',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing staff_id', async () => {
    const { staff_id: _, ...rest } = validBody
    void _
    const res = await POST(makePostRequest(rest) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing sale_amount', async () => {
    const { sale_amount: _, ...rest } = validBody
    void _
    const res = await POST(makePostRequest(rest) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative commission_rate', async () => {
    const res = await POST(makePostRequest({ ...validBody, commission_rate: -5 }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if staff not found', async () => {
    mockStaff = null
    const res = await POST(makePostRequest(validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Staff/)
  })

  it('returns 404 if appointment not found', async () => {
    mockAppointment = null
    const res = await POST(makePostRequest({
      ...validBody,
      appointment_id: 'a0000000-0000-4000-8000-000000000003',
    }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Appointment/)
  })

  it('returns 500 on database error', async () => {
    mockInsertedCommission = null
    mockInsertError = { message: 'DB error' }
    const res = await POST(makePostRequest(validBody) as never)
    expect(res.status).toBe(500)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
