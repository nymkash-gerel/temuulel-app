/**
 * Tests for GET/POST /api/invoices
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockInvoices: unknown[] = []
let mockInvoicesCount: number = 0
let mockSelectError: { message: string } | null = null
let mockCreatedInvoice: Record<string, unknown> | null = null
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
  createInvoice: vi.fn(async () => ({
    invoice: mockCreatedInvoice,
    error: mockCreateError,
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
  mockInvoices = []
  mockInvoicesCount = 0
  mockSelectError = null
  mockCreatedInvoice = {
    id: 'inv-001',
    invoice_number: 'INV-20260201-ABC12',
    party_type: 'customer',
    party_id: null,
    source_type: 'manual',
    source_id: null,
    status: 'draft',
    subtotal: 50000,
    tax_amount: 5000,
    discount_amount: 0,
    total_amount: 55000,
    amount_paid: 0,
    amount_due: 55000,
    currency: 'MNT',
    due_date: null,
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
    if (table === 'invoices') {
      const invoicesQuery: Record<string, unknown> = {}
      invoicesQuery.eq = vi.fn(() => invoicesQuery)
      invoicesQuery.order = vi.fn(() => invoicesQuery)
      invoicesQuery.range = vi.fn(() => invoicesQuery)
      invoicesQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockInvoices, count: mockInvoicesCount, error: mockSelectError }),
      )

      return {
        select: vi.fn(() => invoicesQuery),
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
// GET /api/invoices
// ---------------------------------------------------------------------------
describe('GET /api/invoices', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/invoices'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/invoices'))
    expect(res.status).toBe(403)
  })

  it('returns invoices list', async () => {
    mockInvoices = [
      { id: 'inv-1', invoice_number: 'INV-001', status: 'draft', total_amount: 50000 },
    ]
    mockInvoicesCount = 1
    const res = await GET(makeRequest('http://localhost/api/invoices'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no invoices', async () => {
    mockInvoices = []
    mockInvoicesCount = 0
    const res = await GET(makeRequest('http://localhost/api/invoices'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockInvoices = [{ id: 'inv-1', status: 'paid' }]
    mockInvoicesCount = 1
    const res = await GET(makeRequest('http://localhost/api/invoices?status=paid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports party_type filter', async () => {
    mockInvoices = [{ id: 'inv-2', party_type: 'customer' }]
    mockInvoicesCount = 1
    const res = await GET(makeRequest('http://localhost/api/invoices?party_type=customer'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports party_id filter', async () => {
    mockInvoices = [{ id: 'inv-3', party_id: 'cust-001' }]
    mockInvoicesCount = 1
    const res = await GET(makeRequest('http://localhost/api/invoices?party_id=cust-001'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockInvoices = [{ id: 'inv-4' }]
    mockInvoicesCount = 50
    const res = await GET(makeRequest('http://localhost/api/invoices?limit=10&offset=20'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(50)
  })

  it('ignores invalid status filter values', async () => {
    mockInvoices = []
    mockInvoicesCount = 0
    const res = await GET(makeRequest('http://localhost/api/invoices?status=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/invoices'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/invoices
// ---------------------------------------------------------------------------
describe('POST /api/invoices', () => {
  const validBody = {
    party_type: 'customer',
    items: [
      { description: 'Product A', quantity: 2, unit_price: 25000 },
    ],
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/invoices', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/invoices', validBody))
    expect(res.status).toBe(403)
  })

  it('creates an invoice with minimal fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBeDefined()
  })

  it('creates an invoice with all fields', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'customer',
      party_id: 'a0000000-0000-4000-8000-000000000001',
      source_type: 'order',
      source_id: 'a0000000-0000-4000-8000-000000000002',
      items: [
        { description: 'Item 1', quantity: 1, unit_price: 10000, tax_rate: 10, discount: 500 },
        { description: 'Item 2', quantity: 3, unit_price: 5000, item_type: 'service' },
      ],
      due_date: '2026-03-01',
      notes: 'Test invoice',
      tax_rate: 10,
      discount_amount: 1000,
    }))
    expect(res.status).toBe(201)
  })

  it('returns 400 when party_type is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      items: [{ description: 'Item', quantity: 1, unit_price: 1000 }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'customer',
      items: [],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when items are missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'customer',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid party_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'invalid',
      items: [{ description: 'Item', quantity: 1, unit_price: 1000 }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for item missing description', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'customer',
      items: [{ quantity: 1, unit_price: 1000 }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for item missing unit_price', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'customer',
      items: [{ description: 'Item', quantity: 1 }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid due_date format', async () => {
    const res = await POST(makeRequest('http://localhost/api/invoices', {
      party_type: 'customer',
      items: [{ description: 'Item', quantity: 1, unit_price: 1000 }],
      due_date: '01/03/2026',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when createInvoice fails', async () => {
    mockCreatedInvoice = null
    mockCreateError = 'Database insert failed'
    const res = await POST(makeRequest('http://localhost/api/invoices', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Database insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('accepts all valid party_type values', async () => {
    for (const ptype of ['customer', 'supplier', 'staff', 'driver']) {
      const res = await POST(makeRequest('http://localhost/api/invoices', {
        party_type: ptype,
        items: [{ description: 'Item', quantity: 1, unit_price: 1000 }],
      }))
      expect(res.status).toBe(201)
    }
  })

  it('accepts all valid source_type values', async () => {
    for (const stype of ['order', 'appointment', 'reservation', 'manual', 'subscription']) {
      const res = await POST(makeRequest('http://localhost/api/invoices', {
        party_type: 'customer',
        source_type: stype,
        items: [{ description: 'Item', quantity: 1, unit_price: 1000 }],
      }))
      expect(res.status).toBe(201)
    }
  })
})
