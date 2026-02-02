/**
 * Tests for GET/POST /api/staff-commissions
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
let mockStaff: { id: string; name: string } | null = null
let mockAppointment: { id: string } | null = null

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
  mockStaff = { id: 'staff-001', name: 'Jane Stylist' }
  mockAppointment = { id: 'appt-001' }
  mockInsertedItem = {
    id: 'comm-001',
    staff_id: 'staff-001',
    appointment_id: null,
    sale_type: 'service',
    sale_amount: 80000,
    commission_rate: 20,
    commission_amount: 16000,
    status: 'pending',
    paid_at: null,
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    staff: { id: 'staff-001', name: 'Jane Stylist' },
    appointments: null,
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
    if (table === 'staff_commissions') {
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
// GET /api/staff-commissions
// ---------------------------------------------------------------------------
describe('GET /api/staff-commissions', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/staff-commissions') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/staff-commissions') as never)
    expect(res.status).toBe(403)
  })

  it('returns commissions list', async () => {
    mockData = [
      { id: 'comm-1', staff_id: 'staff-001', sale_type: 'service', commission_amount: 16000, status: 'pending' },
      { id: 'comm-2', staff_id: 'staff-002', sale_type: 'product', commission_amount: 5000, status: 'approved' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/staff-commissions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no commissions exist', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/staff-commissions') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status=pending filter', async () => {
    mockData = [{ id: 'comm-1', status: 'pending' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?status=pending') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status=approved filter', async () => {
    mockData = [{ id: 'comm-2', status: 'approved' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?status=approved') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status=paid filter', async () => {
    mockData = [{ id: 'comm-3', status: 'paid' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?status=paid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status=cancelled filter', async () => {
    mockData = [{ id: 'comm-4', status: 'cancelled' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?status=cancelled') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports staff_id filter', async () => {
    mockData = [{ id: 'comm-1', staff_id: 'staff-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?staff_id=staff-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports sale_type=service filter', async () => {
    mockData = [{ id: 'comm-1', sale_type: 'service' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?sale_type=service') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports sale_type=product filter', async () => {
    mockData = [{ id: 'comm-2', sale_type: 'product' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?sale_type=product') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports sale_type=package filter', async () => {
    mockData = [{ id: 'comm-3', sale_type: 'package' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?sale_type=package') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports sale_type=membership filter', async () => {
    mockData = [{ id: 'comm-4', sale_type: 'membership' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?sale_type=membership') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid sale_type filter', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?sale_type=tip') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'comm-1', staff_id: 'staff-001', status: 'pending', sale_type: 'service' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?staff_id=staff-001&status=pending&sale_type=service') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'comm-10' }]
    mockDataCount = 200
    const res = await GET(makeRequest('http://localhost/api/staff-commissions?limit=20&offset=40') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(200)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/staff-commissions') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/staff-commissions
// ---------------------------------------------------------------------------
describe('POST /api/staff-commissions', () => {
  const validBody = {
    staff_id: 'a0000000-0000-4000-8000-000000000001',
    sale_amount: 80000,
    commission_rate: 20,
    commission_amount: 16000,
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a commission with required fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
    expect(json.status).toBe('pending')
  })

  it('creates a commission with optional appointment_id', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      appointment_id: 'a0000000-0000-4000-8000-000000000003',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('creates a commission with optional sale_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      sale_type: 'product',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('accepts all valid sale_type values', async () => {
    for (const saleType of ['service', 'product', 'package', 'membership']) {
      const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
        ...validBody,
        sale_type: saleType,
      }) as never)
      expect(res.status).toBe(201)
    }
  })

  it('returns 400 when staff_id is missing', async () => {
    const { staff_id: _, ...rest } = validBody
    void _
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', rest) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when sale_amount is missing', async () => {
    const { sale_amount: _, ...rest } = validBody
    void _
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', rest) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when commission_rate is missing', async () => {
    const { commission_rate: _, ...rest } = validBody
    void _
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', rest) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when commission_amount is missing', async () => {
    const { commission_amount, ...rest } = validBody
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', rest) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when commission_rate is negative', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      commission_rate: -5,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when commission_rate exceeds 100', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      commission_rate: 150,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when commission_amount is negative', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      commission_amount: -100,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when staff_id is not a valid uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      staff_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid sale_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      sale_type: 'tip',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if staff not found in store', async () => {
    mockStaff = null
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Staff/)
  })

  it('returns 404 if appointment not found in store', async () => {
    mockAppointment = null
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', {
      ...validBody,
      appointment_id: 'a0000000-0000-4000-8000-000000000003',
    }) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Appointment/)
  })

  it('returns 500 on database insert error', async () => {
    mockInsertedItem = null
    mockInsertError = { message: 'Insert failed' }
    const res = await POST(makeRequest('http://localhost/api/staff-commissions', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/staff-commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
