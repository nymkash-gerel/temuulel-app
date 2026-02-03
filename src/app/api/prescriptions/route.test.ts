/**
 * Tests for GET/POST /api/prescriptions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockSelectError: { message: string } | null = null
let mockPatient: { id: string } | null = null
let mockInsertedPrescription: Record<string, unknown> | null = null
let mockInsertError: { message: string } | null = null
let mockItemsInsertError: { message: string } | null = null
let mockFullPrescription: Record<string, unknown> | null = null
let mockFetchError: { message: string } | null = null
let prescriptionsFromCallCount = 0

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
  mockData = []
  mockDataCount = 0
  mockSelectError = null
  mockPatient = { id: 'patient-001' }
  mockInsertedPrescription = { id: 'rx-001' }
  mockInsertError = null
  mockItemsInsertError = null
  mockFullPrescription = {
    id: 'rx-001',
    encounter_id: null,
    patient_id: 'patient-001',
    prescribed_by: null,
    status: 'active',
    notes: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    patients: { id: 'patient-001', first_name: 'John', last_name: 'Doe' },
    staff: null,
    prescription_items: [
      { id: 'item-001', medication_name: 'Amoxicillin', dosage: '500mg', frequency: '3x daily', duration: '7 days', instructions: 'Take with food' },
    ],
  }
  mockFetchError = null
  prescriptionsFromCallCount = 0

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
    if (table === 'prescriptions') {
      // For GET: chainable thenable query
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data: mockData, count: mockDataCount, error: mockSelectError }),
      )

      // For POST insert
      const insertSelectSingle = vi.fn().mockResolvedValue({
        data: mockInsertedPrescription,
        error: mockInsertError,
      })
      const insertSelect = vi.fn(() => ({
        single: insertSelectSingle,
      }))
      const insertChain = {
        select: insertSelect,
      }

      // For POST final fetch - needs eq and single
      const fetchSelectQuery: Record<string, unknown> = {}
      fetchSelectQuery.eq = vi.fn(() => fetchSelectQuery)
      fetchSelectQuery.single = vi.fn().mockResolvedValue({
        data: mockFullPrescription,
        error: mockFetchError,
      })

      // Track from('prescriptions') calls across the entire mock
      prescriptionsFromCallCount++

      // First from('prescriptions') call: used by GET (select chain) or POST insert
      // Second from('prescriptions') call: used by POST re-fetch (select -> eq -> single)
      if (prescriptionsFromCallCount > 1) {
        return {
          select: vi.fn(() => fetchSelectQuery),
        }
      }

      return {
        select: vi.fn(() => dataQuery),
        insert: vi.fn(() => insertChain),
      }
    }
    if (table === 'patients') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockPatient }),
        })),
      }
    }
    if (table === 'prescription_items') {
      return {
        insert: vi.fn().mockResolvedValue({ error: mockItemsInsertError }),
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
// GET /api/prescriptions
// ---------------------------------------------------------------------------
describe('GET /api/prescriptions', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/prescriptions'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/prescriptions'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns prescriptions list', async () => {
    mockData = [
      { id: 'rx-1', patient_id: 'p-1', status: 'active', patients: { id: 'p-1', first_name: 'John', last_name: 'Doe' } },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/prescriptions'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no prescriptions', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/prescriptions'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'rx-1', status: 'active' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/prescriptions?status=active'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports patient_id filter', async () => {
    mockData = [{ id: 'rx-1', patient_id: 'p-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/prescriptions?patient_id=p-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'rx-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/prescriptions?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/prescriptions?status=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'rx-1', status: 'completed', patient_id: 'p-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/prescriptions?status=completed&patient_id=p-1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/prescriptions'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/prescriptions
// ---------------------------------------------------------------------------
describe('POST /api/prescriptions', () => {
  const validBody = {
    patient_id: 'a0000000-0000-4000-8000-000000000001',
    items: [
      {
        medication_name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3x daily',
      },
    ],
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/prescriptions', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/prescriptions', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a prescription with valid data', async () => {
    const res = await POST(makeRequest('http://localhost/api/prescriptions', validBody))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBeDefined()
  })

  it('creates a prescription with all optional fields', async () => {
    const fullBody = {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      encounter_id: 'b0000000-0000-4000-8000-000000000001',
      prescribed_by: 'c0000000-0000-4000-8000-000000000001',
      notes: 'Take after meals',
      items: [
        {
          medication_name: 'Amoxicillin',
          dosage: '500mg',
          frequency: '3x daily',
          duration: '7 days',
          instructions: 'Take with food',
        },
      ],
    }
    const res = await POST(makeRequest('http://localhost/api/prescriptions', fullBody))
    expect(res.status).toBe(201)
  })

  it('creates a prescription with multiple items', async () => {
    const body = {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      items: [
        { medication_name: 'Med A', dosage: '100mg', frequency: 'daily' },
        { medication_name: 'Med B', dosage: '200mg', frequency: '2x daily' },
      ],
    }
    const res = await POST(makeRequest('http://localhost/api/prescriptions', body))
    expect(res.status).toBe(201)
  })

  it('returns 400 when patient_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/prescriptions', {
      items: [{ medication_name: 'Test', dosage: '10mg', frequency: 'daily' }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when items array is empty', async () => {
    const res = await POST(makeRequest('http://localhost/api/prescriptions', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      items: [],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when items is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/prescriptions', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when medication_name is missing in item', async () => {
    const res = await POST(makeRequest('http://localhost/api/prescriptions', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      items: [{ dosage: '10mg', frequency: 'daily' }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid patient_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/prescriptions', {
      patient_id: 'not-a-uuid',
      items: [{ medication_name: 'Test', dosage: '10mg', frequency: 'daily' }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when patient not found in store', async () => {
    mockPatient = null
    const res = await POST(makeRequest('http://localhost/api/prescriptions', validBody))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/Patient not found/)
  })

  it('returns 500 when prescription insert fails', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedPrescription = null
    const res = await POST(makeRequest('http://localhost/api/prescriptions', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 500 when items insert fails', async () => {
    mockItemsInsertError = { message: 'Items insert failed' }
    const res = await POST(makeRequest('http://localhost/api/prescriptions', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Items insert failed')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
