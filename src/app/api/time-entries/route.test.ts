/**
 * Comprehensive tests for Legal vertical API routes:
 *   - /api/time-entries        (GET list + POST create)
 *   - /api/time-entries/:id    (GET detail + PATCH update)
 *   - /api/retainers           (GET list + POST create)
 *   - /api/retainers/:id       (GET detail + PATCH update)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}))

// ---------------------------------------------------------------------------
// Proxy-based chainable query builder
// ---------------------------------------------------------------------------

function createQueryBuilder(resolveValue: { data: any; error?: any; count?: number }) {
  const builder: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'then') {
          return (resolve: (arg: any) => void) => resolve(resolveValue)
        }
        if (prop === 'single') {
          return () => Promise.resolve(resolveValue)
        }
        return vi.fn(() => builder)
      },
    },
  )
  return builder
}

// ---------------------------------------------------------------------------
// Route imports (MUST come after vi.mock)
// ---------------------------------------------------------------------------

import { GET as getTimeEntries, POST as postTimeEntry } from './route'
import { GET as getTimeEntryById, PATCH as patchTimeEntry } from './[id]/route'
import { GET as getRetainers, POST as postRetainer } from '../retainers/route'
import { GET as getRetainerById, PATCH as patchRetainer } from '../retainers/[id]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER_ID = 'a0000000-0000-4000-8000-000000000001'
const MOCK_STORE_ID = 'b0000000-0000-4000-8000-000000000002'
const MOCK_CASE_ID = 'c0000000-0000-4000-8000-000000000003'
const MOCK_STAFF_ID = 'd0000000-0000-4000-8000-000000000004'
const MOCK_CLIENT_ID = 'e0000000-0000-4000-8000-000000000005'
const MOCK_TIME_ENTRY_ID = 'f0000000-0000-4000-8000-000000000006'
const MOCK_RETAINER_ID = 'a1000000-0000-4000-8000-000000000007'

function authenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: MOCK_USER_ID } } })
}

function unauthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

function configureFrom(handlers: Record<string, any>) {
  mockFrom.mockImplementation((table: string) => {
    if (handlers[table]) {
      return handlers[table]
    }
    return createQueryBuilder({ data: null, error: { message: 'Unknown table' } })
  })
}

function makeRequest(url: string, options?: any): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const sampleTimeEntry = {
  id: MOCK_TIME_ENTRY_ID,
  case_id: MOCK_CASE_ID,
  staff_id: MOCK_STAFF_ID,
  description: 'Reviewed contract documents',
  hours: 2.5,
  billable_rate: 250,
  is_billable: true,
  entry_date: '2026-01-15',
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  legal_cases: { id: MOCK_CASE_ID, case_number: 'CASE-001', title: 'Smith v. Jones' },
  staff: { id: MOCK_STAFF_ID, name: 'Jane Doe' },
}

const sampleRetainer = {
  id: MOCK_RETAINER_ID,
  case_id: MOCK_CASE_ID,
  client_id: MOCK_CLIENT_ID,
  initial_amount: 5000,
  current_balance: 3500,
  status: 'active',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-10T08:00:00Z',
  legal_cases: { id: MOCK_CASE_ID, case_number: 'CASE-001', title: 'Smith v. Jones' },
  customers: { id: MOCK_CLIENT_ID, name: 'John Smith' },
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// TIME ENTRIES
// ===========================================================================

// ---- GET /api/time-entries ------------------------------------------------

describe('GET /api/time-entries', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await getTimeEntries(makeRequest('http://localhost/api/time-entries'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: null }),
    })

    const res = await getTimeEntries(makeRequest('http://localhost/api/time-entries'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns list of time entries', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: [sampleTimeEntry], count: 1 }),
    })

    const res = await getTimeEntries(makeRequest('http://localhost/api/time-entries'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe(MOCK_TIME_ENTRY_ID)
    expect(json.total).toBe(1)
  })

  it('filters by case_id', async () => {
    authenticatedUser()
    const builder = createQueryBuilder({ data: [sampleTimeEntry], count: 1 })
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: builder,
    })

    const res = await getTimeEntries(
      makeRequest(`http://localhost/api/time-entries?case_id=${MOCK_CASE_ID}`),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by staff_id', async () => {
    authenticatedUser()
    const builder = createQueryBuilder({ data: [sampleTimeEntry], count: 1 })
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: builder,
    })

    const res = await getTimeEntries(
      makeRequest(`http://localhost/api/time-entries?staff_id=${MOCK_STAFF_ID}`),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by is_billable=true', async () => {
    authenticatedUser()
    const builder = createQueryBuilder({ data: [sampleTimeEntry], count: 1 })
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: builder,
    })

    const res = await getTimeEntries(
      makeRequest('http://localhost/api/time-entries?is_billable=true'),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by is_billable=false', async () => {
    authenticatedUser()
    const nonBillableEntry = { ...sampleTimeEntry, is_billable: false }
    const builder = createQueryBuilder({ data: [nonBillableEntry], count: 1 })
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: builder,
    })

    const res = await getTimeEntries(
      makeRequest('http://localhost/api/time-entries?is_billable=false'),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].is_billable).toBe(false)
  })

  it('filters by date_from and date_to', async () => {
    authenticatedUser()
    const builder = createQueryBuilder({ data: [sampleTimeEntry], count: 1 })
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: builder,
    })

    const res = await getTimeEntries(
      makeRequest('http://localhost/api/time-entries?date_from=2026-01-01&date_to=2026-01-31'),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: null, error: { message: 'DB connection failed' } }),
    })

    const res = await getTimeEntries(makeRequest('http://localhost/api/time-entries'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('DB connection failed')
  })
})

// ---- POST /api/time-entries -----------------------------------------------

describe('POST /api/time-entries', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: null }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({ case_id: MOCK_CASE_ID, description: 'Work', hours: 1 }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns 400 for invalid body (missing required fields)', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if case_id is not a valid UUID', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({ case_id: 'not-a-uuid', description: 'Work', hours: 1 }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if hours is negative', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({ case_id: MOCK_CASE_ID, description: 'Work', hours: -1 }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('creates time entry successfully', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: sampleTimeEntry }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          case_id: MOCK_CASE_ID,
          staff_id: MOCK_STAFF_ID,
          description: 'Reviewed contract documents',
          hours: 2.5,
          billable_rate: 250,
          is_billable: true,
          entry_date: '2026-01-15',
        }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe(MOCK_TIME_ENTRY_ID)
    expect(json.description).toBe('Reviewed contract documents')
    expect(json.hours).toBe(2.5)
  })

  it('creates time entry with minimal fields (only required)', async () => {
    authenticatedUser()
    const minimalEntry = { ...sampleTimeEntry, staff_id: null, billable_rate: null }
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: minimalEntry }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          case_id: MOCK_CASE_ID,
          description: 'Quick phone call',
          hours: 0.25,
        }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe(MOCK_TIME_ENTRY_ID)
  })

  it('returns 500 on DB error during insert', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: null, error: { message: 'Insert failed' } }),
    })

    const res = await postTimeEntry(
      makeRequest('http://localhost/api/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          case_id: MOCK_CASE_ID,
          description: 'Meeting with client',
          hours: 1,
        }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})

// ---- GET /api/time-entries/:id --------------------------------------------

describe('GET /api/time-entries/:id', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await getTimeEntryById(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: null }),
    })

    const res = await getTimeEntryById(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns time entry detail', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: sampleTimeEntry }),
    })

    const res = await getTimeEntryById(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe(MOCK_TIME_ENTRY_ID)
    expect(json.legal_cases.case_number).toBe('CASE-001')
    expect(json.staff.name).toBe('Jane Doe')
  })

  it('returns 404 if time entry not found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: null, error: { message: 'Not found', code: 'PGRST116' } }),
    })

    const res = await getTimeEntryById(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Time entry not found')
  })
})

// ---- PATCH /api/time-entries/:id ------------------------------------------

describe('PATCH /api/time-entries/:id', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await patchTimeEntry(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ hours: 3 }),
      }),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: null }),
    })

    const res = await patchTimeEntry(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ hours: 3 }),
      }),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('updates time entry successfully', async () => {
    authenticatedUser()
    const updatedEntry = { ...sampleTimeEntry, hours: 3.5, description: 'Updated description' }
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: updatedEntry }),
    })

    const res = await patchTimeEntry(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ hours: 3.5, description: 'Updated description' }),
      }),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.hours).toBe(3.5)
    expect(json.description).toBe('Updated description')
  })

  it('returns 404 when updating non-existent time entry', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: null }),
    })

    const res = await patchTimeEntry(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ hours: 3.5 }),
      }),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Time entry not found')
  })

  it('returns 500 on DB error during update', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      time_entries: createQueryBuilder({ data: null, error: { message: 'Update conflict' } }),
    })

    const res = await patchTimeEntry(
      makeRequest(`http://localhost/api/time-entries/${MOCK_TIME_ENTRY_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ hours: 3.5 }),
      }),
      makeRouteContext(MOCK_TIME_ENTRY_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Update conflict')
  })
})

// ===========================================================================
// RETAINERS
// ===========================================================================

// ---- GET /api/retainers ---------------------------------------------------

describe('GET /api/retainers', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await getRetainers(makeRequest('http://localhost/api/retainers'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: null }),
    })

    const res = await getRetainers(makeRequest('http://localhost/api/retainers'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns list of retainers', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: [sampleRetainer], count: 1 }),
    })

    const res = await getRetainers(makeRequest('http://localhost/api/retainers'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe(MOCK_RETAINER_ID)
    expect(json.total).toBe(1)
  })

  it('filters by case_id', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: [sampleRetainer], count: 1 }),
    })

    const res = await getRetainers(
      makeRequest(`http://localhost/api/retainers?case_id=${MOCK_CASE_ID}`),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by client_id', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: [sampleRetainer], count: 1 }),
    })

    const res = await getRetainers(
      makeRequest(`http://localhost/api/retainers?client_id=${MOCK_CLIENT_ID}`),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by status', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: [sampleRetainer], count: 1 }),
    })

    const res = await getRetainers(
      makeRequest('http://localhost/api/retainers?status=active'),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('returns 500 on database error', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: null, error: { message: 'Connection timeout' } }),
    })

    const res = await getRetainers(makeRequest('http://localhost/api/retainers'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Connection timeout')
  })
})

// ---- POST /api/retainers --------------------------------------------------

describe('POST /api/retainers', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid body (missing required fields)', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
    })

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if case_id is not a valid UUID', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
    })

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({ case_id: 'bad-uuid', initial_amount: 5000 }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('returns 400 if initial_amount is negative', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
    })

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({ case_id: MOCK_CASE_ID, initial_amount: -100 }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('creates retainer successfully', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: sampleRetainer }),
    })

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({
          case_id: MOCK_CASE_ID,
          client_id: MOCK_CLIENT_ID,
          initial_amount: 5000,
          current_balance: 3500,
          status: 'active',
        }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe(MOCK_RETAINER_ID)
    expect(json.initial_amount).toBe(5000)
    expect(json.current_balance).toBe(3500)
    expect(json.status).toBe('active')
  })

  it('creates retainer with minimal fields', async () => {
    authenticatedUser()
    const minimalRetainer = { ...sampleRetainer, client_id: null, status: 'active' }
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: minimalRetainer }),
    })

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({
          case_id: MOCK_CASE_ID,
          initial_amount: 10000,
        }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe(MOCK_RETAINER_ID)
  })

  it('returns 500 on DB error during insert', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: null, error: { message: 'Duplicate key' } }),
    })

    const res = await postRetainer(
      makeRequest('http://localhost/api/retainers', {
        method: 'POST',
        body: JSON.stringify({
          case_id: MOCK_CASE_ID,
          initial_amount: 5000,
        }),
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Duplicate key')
  })
})

// ---- GET /api/retainers/:id -----------------------------------------------

describe('GET /api/retainers/:id', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await getRetainerById(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if no store found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: null }),
    })

    const res = await getRetainerById(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns retainer detail', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: sampleRetainer }),
    })

    const res = await getRetainerById(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe(MOCK_RETAINER_ID)
    expect(json.legal_cases.case_number).toBe('CASE-001')
    expect(json.customers.name).toBe('John Smith')
    expect(json.initial_amount).toBe(5000)
  })

  it('returns 404 if retainer not found', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: null, error: { message: 'Not found', code: 'PGRST116' } }),
    })

    const res = await getRetainerById(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Retainer not found')
  })
})

// ---- PATCH /api/retainers/:id ---------------------------------------------

describe('PATCH /api/retainers/:id', () => {
  it('returns 401 if not authenticated', async () => {
    unauthenticatedUser()

    const res = await patchRetainer(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_balance: 2000 }),
      }),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('updates retainer successfully', async () => {
    authenticatedUser()
    const updatedRetainer = { ...sampleRetainer, current_balance: 2000, status: 'active' }
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: updatedRetainer }),
    })

    const res = await patchRetainer(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_balance: 2000 }),
      }),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.current_balance).toBe(2000)
  })

  it('updates retainer status to depleted', async () => {
    authenticatedUser()
    const depletedRetainer = { ...sampleRetainer, current_balance: 0, status: 'depleted' }
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: depletedRetainer }),
    })

    const res = await patchRetainer(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_balance: 0, status: 'depleted' }),
      }),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('depleted')
    expect(json.current_balance).toBe(0)
  })

  it('returns 404 when updating non-existent retainer', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: null }),
    })

    const res = await patchRetainer(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_balance: 1000 }),
      }),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Retainer not found')
  })

  it('returns 500 on DB error during update', async () => {
    authenticatedUser()
    configureFrom({
      stores: createQueryBuilder({ data: { id: MOCK_STORE_ID } }),
      retainers: createQueryBuilder({ data: null, error: { message: 'Constraint violation' } }),
    })

    const res = await patchRetainer(
      makeRequest(`http://localhost/api/retainers/${MOCK_RETAINER_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ current_balance: 1000 }),
      }),
      makeRouteContext(MOCK_RETAINER_ID),
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Constraint violation')
  })
})
