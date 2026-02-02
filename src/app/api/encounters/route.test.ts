/**
 * Tests for GET/POST /api/encounters
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

// Additional state for POST flow
let mockPatient: { id: string } | null = null
let mockStaff: { id: string } | null = null

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
  mockInsertedItem = {
    id: 'encounter-001',
    patient_id: 'patient-001',
    provider_id: null,
    encounter_type: 'consultation',
    status: 'scheduled',
    chief_complaint: 'Headache',
    diagnosis: null,
    treatment_plan: null,
    notes: null,
    encounter_date: '2026-02-01T00:00:00Z',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    patients: { id: 'patient-001', first_name: 'John', last_name: 'Doe' },
    staff: null,
  }
  mockInsertError = null
  mockSelectError = null
  mockPatient = { id: 'patient-001' }
  mockStaff = { id: 'staff-001' }

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
    if (table === 'encounters') {
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
    if (table === 'patients') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(function (this: any) { return this }),
          single: vi.fn().mockResolvedValue({ data: mockPatient }),
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
// GET /api/encounters
// ---------------------------------------------------------------------------
describe('GET /api/encounters', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/encounters') as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/encounters') as never)
    expect(res.status).toBe(403)
  })

  it('returns encounters list', async () => {
    mockData = [
      { id: 'enc-1', patient_id: 'p-1', status: 'scheduled', encounter_type: 'consultation' },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/encounters') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no encounters', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/encounters') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports status filter', async () => {
    mockData = [{ id: 'enc-1', status: 'in_progress' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/encounters?status=in_progress') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports patient_id filter', async () => {
    mockData = [{ id: 'enc-1', patient_id: 'patient-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/encounters?patient_id=patient-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports provider_id filter', async () => {
    mockData = [{ id: 'enc-1', provider_id: 'staff-001' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/encounters?provider_id=staff-001') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined filters', async () => {
    mockData = [{ id: 'enc-1', status: 'completed', patient_id: 'p-1', provider_id: 's-1' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/encounters?status=completed&patient_id=p-1&provider_id=s-1') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'enc-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/encounters?limit=25&offset=50') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('ignores invalid status filter values', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/encounters?status=invalid') as never)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/encounters') as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/encounters
// ---------------------------------------------------------------------------
describe('POST /api/encounters', () => {
  const validBody = {
    patient_id: 'a0000000-0000-4000-8000-000000000001',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/encounters', validBody) as never)
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/encounters', validBody) as never)
    expect(res.status).toBe(403)
  })

  it('creates an encounter with patient_id only', async () => {
    const res = await POST(makeRequest('http://localhost/api/encounters', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('encounter-001')
  })

  it('creates an encounter with all optional fields', async () => {
    const fullBody = {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      provider_id: 'b0000000-0000-4000-8000-000000000001',
      encounter_type: 'follow_up',
      chief_complaint: 'Follow-up for migraine',
      encounter_date: '2026-02-15T10:00:00Z',
    }
    const res = await POST(makeRequest('http://localhost/api/encounters', fullBody) as never)
    expect(res.status).toBe(201)
  })

  it('accepts all valid encounter types', async () => {
    for (const t of ['consultation', 'follow_up', 'emergency', 'procedure', 'lab_visit']) {
      const res = await POST(makeRequest('http://localhost/api/encounters', {
        patient_id: 'a0000000-0000-4000-8000-000000000001',
        encounter_type: t,
      }) as never)
      expect(res.status).toBe(201)
    }
  })

  it('returns 400 when patient_id is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/encounters', {}) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid patient_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/encounters', {
      patient_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid encounter_type', async () => {
    const res = await POST(makeRequest('http://localhost/api/encounters', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      encounter_type: 'invalid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid provider_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/encounters', {
      patient_id: 'a0000000-0000-4000-8000-000000000001',
      provider_id: 'not-a-uuid',
    }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/encounters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 when patient not found in store', async () => {
    mockPatient = null
    const res = await POST(makeRequest('http://localhost/api/encounters', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Patient not found in this store')
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/encounters', validBody) as never)
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
