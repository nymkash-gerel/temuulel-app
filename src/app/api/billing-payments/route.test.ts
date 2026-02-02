/**
 * Tests for GET/POST /api/billing-payments
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockPayments: unknown[] = []
let mockPaymentsCount: number = 0
let mockSelectError: { message: string } | null = null
let mockInvoice: { id: string } | null = null
let mockCreatedPayment: Record<string, unknown> | null = null
let mockCreateError: string | null = null

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/billing', () => ({
  recordPayment: vi.fn(async () => ({
    payment: mockCreatedPayment,
    error: mockCreateError,
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
  mockPayments = []
  mockPaymentsCount = 0
  mockSelectError = null
  mockInvoice = { id: 'inv-001' }
  mockCreatedPayment = {
    id: 'pay-001',
    invoice_id: 'inv-001',
    payment_number: 'PAY-1706745600000',
    amount: 25000,
    method: 'cash',
    status: 'completed',
    gateway_ref: null,
    paid_at: '2026-02-01T00:00:00Z',
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  }
  mockCreateError = null

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
    if (table === 'billing_payments') {
      const paymentsQuery: Record<string, unknown> = {}
      paymentsQuery.eq = vi.fn(() => paymentsQuery)
      paymentsQuery.order = vi.fn(() => paymentsQuery)
      paymentsQuery.range = vi.fn(() => paymentsQuery)
      paymentsQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockPayments, count: mockPaymentsCount, error: mockSelectError }),
      )

      return {
        select: vi.fn(() => paymentsQuery),
      }
    }
    if (table === 'invoices') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function () { return this }),
          single: vi.fn().mockResolvedValue({ data: mockInvoice }),
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
// GET /api/billing-payments
// ---------------------------------------------------------------------------
describe('GET /api/billing-payments', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/billing-payments') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/billing-payments') as never)
    expect(res.status).toBe(403)
  })

  it('returns payments list', async () => {
    mockPayments = [
      { id: 'pay-1', payment_number: 'PAY-001', amount: 25000, method: 'cash', status: 'completed' },
    ]
    mockPaymentsCount = 1
    const res = await GET(makeRequest('http://localhost/api/billing-payments') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no payments', async () => {
    mockPayments = []
    mockPaymentsCount = 0
    const res = await GET(makeRequest('http://localhost/api/billing-payments') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports invoice_id filter', async () => {
    mockPayments = [{ id: 'pay-1', invoice_id: 'inv-001' }]
    mockPaymentsCount = 1
    const res = await GET(makeRequest('http://localhost/api/billing-payments?invoice_id=inv-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports status filter', async () => {
    mockPayments = [{ id: 'pay-2', status: 'completed' }]
    mockPaymentsCount = 1
    const res = await GET(makeRequest('http://localhost/api/billing-payments?status=completed') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports method filter', async () => {
    mockPayments = [{ id: 'pay-3', method: 'qpay' }]
    mockPaymentsCount = 1
    const res = await GET(makeRequest('http://localhost/api/billing-payments?method=qpay') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockPayments = [{ id: 'pay-4' }]
    mockPaymentsCount = 100
    const res = await GET(makeRequest('http://localhost/api/billing-payments?limit=25&offset=50') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('ignores invalid status filter values', async () => {
    mockPayments = []
    mockPaymentsCount = 0
    const res = await GET(makeRequest('http://localhost/api/billing-payments?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('ignores invalid method filter values', async () => {
    mockPayments = []
    mockPaymentsCount = 0
    const res = await GET(makeRequest('http://localhost/api/billing-payments?method=bitcoin') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/billing-payments') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/billing-payments
// ---------------------------------------------------------------------------
describe('POST /api/billing-payments', () => {
  const validBody = {
    invoice_id: 'a0000000-0000-4000-8000-000000000001',
    amount: 25000,
    method: 'cash',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/billing-payments', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/billing-payments', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates a payment with invoice_id', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates a payment without invoice_id', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      amount: 10000,
      method: 'bank',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('creates a payment with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      invoice_id: 'a0000000-0000-4000-8000-000000000001',
      amount: 50000,
      method: 'qpay',
      gateway_ref: 'QPAY-12345',
      notes: 'Payment via QPay',
    }) as never)
    expect(res.status).toBe(201)
  })

  it('returns 400 when amount is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      method: 'cash',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when method is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      amount: 25000,
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid method', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      amount: 25000,
      method: 'bitcoin',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount is zero', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      amount: 0,
      method: 'cash',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when amount is negative', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      amount: -100,
      method: 'cash',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid invoice_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/billing-payments', {
      invoice_id: 'not-a-uuid',
      amount: 25000,
      method: 'cash',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 if invoice not found in store', async () => {
    mockInvoice = null
    const res = await POST(makeRequest('http://localhost/api/billing-payments', validBody) as never)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Invoice not found/)
  })

  it('returns 500 when recordPayment fails', async () => {
    mockCreatedPayment = null
    mockCreateError = 'Database insert failed'
    const res = await POST(makeRequest('http://localhost/api/billing-payments', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Database insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/billing-payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('accepts all valid payment methods', async () => {
    for (const m of ['cash', 'bank', 'qpay', 'card', 'online', 'credit']) {
      const res = await POST(makeRequest('http://localhost/api/billing-payments', {
        amount: 1000,
        method: m,
      }) as never)
      expect(res.status).toBe(201)
    }
  })
})
