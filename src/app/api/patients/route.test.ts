/**
 * Tests for GET/POST /api/patients
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestRequest, createTestJsonRequest } from '@/lib/test-utils'

// Mock state
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null
let mockData: unknown[] = []
let mockDataCount: number = 0
let mockInsertedItem: Record<string, unknown> | null = null
let mockInsertError: { message: string } | null = null
let mockSelectError: { message: string } | null = null

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
  mockInsertedItem = {
    id: 'patient-001',
    first_name: 'John',
    last_name: 'Doe',
    date_of_birth: '1990-01-15',
    gender: 'male',
    blood_type: 'O+',
    phone: '99001122',
    email: 'john@example.com',
    allergies: [],
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  }
  mockInsertError = null
  mockSelectError = null

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
    if (table === 'patients') {
      const dataQuery: Record<string, unknown> = {}
      dataQuery.eq = vi.fn(() => dataQuery)
      dataQuery.or = vi.fn(() => dataQuery)
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
// GET /api/patients
// ---------------------------------------------------------------------------
describe('GET /api/patients', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await GET(makeRequest('http://localhost/api/patients'))
    expect(res.status).toBe(401)
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await GET(makeRequest('http://localhost/api/patients'))
    expect(res.status).toBe(403)
  })

  it('returns patients list', async () => {
    mockData = [
      { id: 'patient-1', first_name: 'John', last_name: 'Doe', gender: 'male' },
    ]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/patients'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.total).toBe(1)
  })

  it('returns empty list when no patients', async () => {
    mockData = []
    mockDataCount = 0
    const res = await GET(makeRequest('http://localhost/api/patients'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('supports search filter on name', async () => {
    mockData = [{ id: 'patient-1', first_name: 'John', last_name: 'Doe' }]
    mockDataCount = 1
    const res = await GET(makeRequest('http://localhost/api/patients?search=John'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports pagination parameters', async () => {
    mockData = [{ id: 'patient-5' }]
    mockDataCount = 100
    const res = await GET(makeRequest('http://localhost/api/patients?limit=10&offset=20'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns results without search filter', async () => {
    mockData = [
      { id: 'patient-1', first_name: 'John', last_name: 'Doe' },
      { id: 'patient-2', first_name: 'Jane', last_name: 'Smith' },
    ]
    mockDataCount = 2
    const res = await GET(makeRequest('http://localhost/api/patients'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns 500 on database error', async () => {
    mockSelectError = { message: 'DB error' }
    const res = await GET(makeRequest('http://localhost/api/patients'))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/patients
// ---------------------------------------------------------------------------
describe('POST /api/patients', () => {
  const validBody = {
    first_name: 'John',
    last_name: 'Doe',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await POST(makeRequest('http://localhost/api/patients', validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await POST(makeRequest('http://localhost/api/patients', validBody))
    expect(res.status).toBe(403)
  })

  it('creates a patient with required fields only', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', validBody))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('patient-001')
  })

  it('creates a patient with all optional fields', async () => {
    const fullBody = {
      first_name: 'Jane',
      last_name: 'Smith',
      customer_id: 'a0000000-0000-4000-8000-000000000001',
      date_of_birth: '1985-06-20',
      gender: 'female',
      blood_type: 'A+',
      phone: '99112233',
      email: 'jane@example.com',
      emergency_contact: { name: 'Bob Smith', phone: '99445566' },
      allergies: ['penicillin', 'aspirin'],
      insurance_info: { provider: 'InsureCo', policy: 'POL-123' },
    }
    const res = await POST(makeRequest('http://localhost/api/patients', fullBody))
    expect(res.status).toBe(201)
  })

  it('returns 400 when first_name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      last_name: 'Doe',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when last_name is missing', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      first_name: 'John',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when first_name is empty string', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      first_name: '',
      last_name: 'Doe',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid gender value', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      first_name: 'John',
      last_name: 'Doe',
      gender: 'unknown',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid blood_type value', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      first_name: 'John',
      last_name: 'Doe',
      blood_type: 'X+',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      first_name: 'John',
      last_name: 'Doe',
      email: 'not-an-email',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid customer_id uuid', async () => {
    const res = await POST(makeRequest('http://localhost/api/patients', {
      first_name: 'John',
      last_name: 'Doe',
      customer_id: 'not-a-uuid',
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = createTestRequest('http://localhost/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('accepts all valid blood types', async () => {
    for (const bt of ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']) {
      const res = await POST(makeRequest('http://localhost/api/patients', {
        first_name: 'Test',
        last_name: 'Patient',
        blood_type: bt,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('accepts all valid gender values', async () => {
    for (const g of ['male', 'female', 'other']) {
      const res = await POST(makeRequest('http://localhost/api/patients', {
        first_name: 'Test',
        last_name: 'Patient',
        gender: g,
      }))
      expect(res.status).toBe(201)
    }
  })

  it('returns 500 on database insert error', async () => {
    mockInsertError = { message: 'Insert failed' }
    mockInsertedItem = null
    const res = await POST(makeRequest('http://localhost/api/patients', validBody))
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})
