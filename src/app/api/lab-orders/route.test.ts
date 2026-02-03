/**
 * Tests for /api/lab-orders (GET + POST) and /api/lab-orders/[id] (GET + PATCH + DELETE)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockSelectError: { message: string } | null = null
let mockPatient: { id: string } | null = null
let mockInsertedItem: Record<string, unknown> | null = null
let mockInsertError: { message: string } | null = null
let mockDetailItem: Record<string, unknown> | null = null
let mockDetailError: { message: string } | null = null
let mockUpdatedItem: Record<string, unknown> | null = null
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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { GET, POST } from './route'
import { GET as GET_ID, PATCH, DELETE } from './[id]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(url: string, body?: unknown, method?: string) {
  if (body) {
    return createTestJsonRequest(url, body, method || 'POST')
  }
  return createTestRequest(url, { method: method || 'GET' })
}

function makePatchRequest(body: unknown) {
  return createTestJsonRequest('http://localhost/api/lab-orders/lo-001', body, 'PATCH')
}

function makeDeleteRequest() {
  return createTestRequest('http://localhost/api/lab-orders/lo-001', { method: 'DELETE' })
}

const idParams = Promise.resolve({ id: 'lo-001' })

// ---------------------------------------------------------------------------
// Default mock data
// ---------------------------------------------------------------------------
const defaultLabOrder = {
  id: 'lo-001',
  patient_id: 'patient-001',
  encounter_id: null,
  ordered_by: null,
  order_type: 'lab',
  test_name: 'Complete Blood Count',
  test_code: 'CBC',
  urgency: 'routine',
  specimen_type: 'blood',
  collection_time: null,
  status: 'ordered',
  notes: null,
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
  patients: { id: 'patient-001', first_name: 'John', last_name: 'Doe' },
  staff: null,
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  mockUser = { id: 'user-001' }
  mockStore = { id: 'store-001' }
  mockData = []
  mockDataCount = 0
  mockSelectError = null
  mockPatient = { id: 'patient-001' }
  mockInsertedItem = { ...defaultLabOrder }
  mockInsertError = null
  mockDetailItem = { ...defaultLabOrder }
  mockDetailError = null
  mockUpdatedItem = { ...defaultLabOrder, updated_at: '2026-02-01T12:00:00Z' }
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
    if (table === 'lab_orders') {
      // Chainable query for GET list
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.order = vi.fn(() => dataQuery)
      dataQuery.range = vi.fn(() => dataQuery)
      dataQuery.single = vi.fn().mockResolvedValue({
        data: mockDetailItem,
        error: mockDetailError,
      })
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
        update: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockUpdatedItem, error: mockUpdateError }),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          then: vi.fn((resolve: (v: unknown) => void) =>
            resolve({ error: mockDeleteError }),
          ),
        })),
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
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    }
  })
})

// ===========================================================================
// GET /api/lab-orders
// ===========================================================================
describe('GET /api/lab-orders', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/lab-orders'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/lab-orders'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns list of lab orders', async () => {
    mockData = [
      { id: 'lo-1', test_name: 'CBC', status: 'ordered', urgency: 'routine' },
      { id: 'lo-2', test_name: 'MRI Brain', status: 'completed', urgency: 'urgent' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/lab-orders'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no lab orders', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/lab-orders'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('filters by status', async () => {
    mockData = [{ id: 'lo-1', test_name: 'CBC', status: 'completed' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/lab-orders?status=completed'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by urgency', async () => {
    mockData = [{ id: 'lo-1', test_name: 'Troponin', urgency: 'stat' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/lab-orders?urgency=stat'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by patient_id', async () => {
    mockData = [{ id: 'lo-1', patient_id: 'patient-001', test_name: 'CBC' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/lab-orders?patient_id=patient-001'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by order_type', async () => {
    mockData = [{ id: 'lo-1', order_type: 'imaging', test_name: 'MRI Brain' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/lab-orders?order_type=imaging'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/lab-orders?status=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('ignores invalid urgency filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/lab-orders?urgency=critical'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('ignores invalid order_type filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/lab-orders?order_type=invalid'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'lo-1', status: 'ordered', urgency: 'urgent', patient_id: 'p-1', order_type: 'lab' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/lab-orders?status=ordered&urgency=urgent&patient_id=p-1&order_type=lab'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'lo-10' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/lab-orders?limit=25&offset=50'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/lab-orders'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ===========================================================================
// POST /api/lab-orders
// ===========================================================================
describe('POST /api/lab-orders', () => {
  const validBody = {
    patient_id: 'a0000000-0000-4000-8000-000000000001',
    test_name: 'Complete Blood Count',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/lab-orders', validBody))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/lab-orders', validBody))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('creates a lab order with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('lo-001')
    expect(json.test_name).toBe('Complete Blood Count')
  })

  it('creates a lab order with all optional fields', async () => {
    const fullBody = {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      encounter_id: 'b0000000-0000-4000-8000-000000000001',
      ordered_by: 'c0000000-0000-4000-8000-000000000001',
      order_type: 'imaging',
      test_name: 'MRI Brain',
      test_code: 'MRI-BR',
      urgency: 'urgent',
      specimen_type: 'N/A',
      collection_time: '2026-02-01T10:00:00Z',
      notes: 'Patient complains of headaches',
    }
    const res = await POST(makeRequest('http://localhost/api/lab-orders', fullBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when patient_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', {
      test_name: 'CBC',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when test_name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when test_name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      test_name: '',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid patient_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', {
      patient_id: 'not-a-uuid',
      test_name: 'CBC',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid order_type value', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      test_name: 'CBC',
      order_type: 'invalid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid urgency value', async () => {
    const res = await POST(makeRequest('http://localhost/api/lab-orders', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      test_name: 'CBC',
      urgency: 'critical',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/lab-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('accepts all valid order_type values', async () => {
    for (const ot of ['lab', 'imaging', 'other']) {
      const res = await POST(makeRequest('http://localhost/api/lab-orders', {
        patient_id: 'a0000000-0000-4000-8000-000000000001',
        test_name: 'Test',
        order_type: ot,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('accepts all valid urgency values', async () => {
    for (const u of ['routine', 'urgent', 'stat']) {
      const res = await POST(makeRequest('http://localhost/api/lab-orders', {
        patient_id: 'a0000000-0000-4000-8000-000000000001',
        test_name: 'Test',
        urgency: u,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 404 if patient not found in store', async () => {
    mockPatient = null
    const res = await POST(makeRequest('http://localhost/api/lab-orders', validBody))
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Patient not found')
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/lab-orders', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})

// ===========================================================================
// GET /api/lab-orders/[id]
// ===========================================================================
describe('GET /api/lab-orders/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await GET_ID(
      makeRequest('http://localhost/api/lab-orders/lo-001'),
      { params: idParams },
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await GET_ID(
      makeRequest('http://localhost/api/lab-orders/lo-001'),
      { params: idParams },
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns 404 if lab order not found', async () => {
    mockDetailItem = null
    mockDetailError = { message: 'Not found' }
    const res = await GET_ID(
      makeRequest('http://localhost/api/lab-orders/lo-999'),
      { params: idParams },
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Lab order not found')
  })

  it('returns 404 when data is null without error', async () => {
    mockDetailItem = null
    mockDetailError = null
    const res = await GET_ID(
      makeRequest('http://localhost/api/lab-orders/lo-001'),
      { params: idParams },
    )
    expect(res.status).toBe(404)
  })

  it('returns lab order detail', async () => {
    const res = await GET_ID(
      makeRequest('http://localhost/api/lab-orders/lo-001'),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('lo-001')
    expect(json.test_name).toBe('Complete Blood Count')
    expect(json.patients.first_name).toBe('John')
  })
})

// ===========================================================================
// PATCH /api/lab-orders/[id]
// ===========================================================================
describe('PATCH /api/lab-orders/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await PATCH(
      makePatchRequest({ status: 'collected' }),
      { params: idParams },
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await PATCH(
      makePatchRequest({ status: 'collected' }),
      { params: idParams },
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('updates lab order status to collected', async () => {
    mockUpdatedItem = { ...defaultLabOrder, status: 'collected', updated_at: '2026-02-01T12:00:00Z' }
    const res = await PATCH(
      makePatchRequest({ status: 'collected' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('collected')
  })

  it('updates lab order status to processing', async () => {
    // Current status must be 'collected' for transition to 'processing'
    mockDetailItem = { ...defaultLabOrder, status: 'collected' }
    mockUpdatedItem = { ...defaultLabOrder, status: 'processing', updated_at: '2026-02-01T12:00:00Z' }
    const res = await PATCH(
      makePatchRequest({ status: 'processing' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('processing')
  })

  it('updates lab order status to completed', async () => {
    // Current status must be 'processing' for transition to 'completed'
    mockDetailItem = { ...defaultLabOrder, status: 'processing' }
    mockUpdatedItem = { ...defaultLabOrder, status: 'completed', updated_at: '2026-02-01T12:00:00Z' }
    const res = await PATCH(
      makePatchRequest({ status: 'completed' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('completed')
  })

  it('updates lab order status to cancelled', async () => {
    mockUpdatedItem = { ...defaultLabOrder, status: 'cancelled', updated_at: '2026-02-01T12:00:00Z' }
    const res = await PATCH(
      makePatchRequest({ status: 'cancelled' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('cancelled')
  })

  it('updates specimen_type', async () => {
    mockUpdatedItem = { ...defaultLabOrder, specimen_type: 'urine' }
    const res = await PATCH(
      makePatchRequest({ specimen_type: 'urine' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.specimen_type).toBe('urine')
  })

  it('updates notes', async () => {
    mockUpdatedItem = { ...defaultLabOrder, notes: 'Fasting required' }
    const res = await PATCH(
      makePatchRequest({ notes: 'Fasting required' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.notes).toBe('Fasting required')
  })

  it('updates collection_time', async () => {
    mockUpdatedItem = { ...defaultLabOrder, collection_time: '2026-02-01T08:30:00Z' }
    const res = await PATCH(
      makePatchRequest({ collection_time: '2026-02-01T08:30:00Z' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.collection_time).toBe('2026-02-01T08:30:00Z')
  })

  it('returns 400 for invalid status value', async () => {
    const res = await PATCH(
      makePatchRequest({ status: 'invalid_status' }),
      { params: idParams },
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/lab-orders/lo-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await PATCH(req, { params: idParams })
    expect(res.status).toBe(400)
  })

  it('returns 404 if lab order not found after update', async () => {
    mockUpdatedItem = null
    mockUpdateError = null
    const res = await PATCH(
      makePatchRequest({ status: 'collected' }),
      { params: idParams },
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Lab order not found')
  })

  it('returns 500 on database update error', async () => {
    mockUpdateError = { message: 'Update failed' }
    const res = await PATCH(
      makePatchRequest({ status: 'collected' }),
      { params: idParams },
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Update failed')
  })
})

// ===========================================================================
// DELETE /api/lab-orders/[id]
// ===========================================================================
describe('DELETE /api/lab-orders/[id]', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await DELETE(makeDeleteRequest(), { params: idParams })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await DELETE(makeDeleteRequest(), { params: idParams })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('deletes a lab order successfully', async () => {
    const res = await DELETE(makeDeleteRequest(), { params: idParams })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 on database delete error', async () => {
    mockDeleteError = { message: 'Delete failed' }
    const res = await DELETE(makeDeleteRequest(), { params: idParams })
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Delete failed')
  })
})
