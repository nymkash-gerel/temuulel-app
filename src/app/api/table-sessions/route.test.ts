/**
 * Comprehensive tests for Restaurant vertical API routes:
 *
 *   /api/table-sessions       (GET list + POST create)
 *   /api/table-sessions/:id   (GET detail + PATCH update)
 *   /api/kds-tickets          (GET list + POST create)
 *   /api/kds-tickets/:id      (GET detail + PATCH update)
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
          return (resolve: () => void) => resolve(resolveValue)
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
// Helpers
// ---------------------------------------------------------------------------
const FAKE_USER_ID = 'a0000000-0000-4000-8000-000000000001'
const FAKE_STORE_ID = 'b0000000-0000-4000-8000-000000000001'
const FAKE_TABLE_ID = 'c0000000-0000-4000-8000-000000000001'
const FAKE_SESSION_ID = 'd0000000-0000-4000-8000-000000000001'
const FAKE_STATION_ID = 'e0000000-0000-4000-8000-000000000001'
const FAKE_ORDER_ID = 'f0000000-0000-4000-8000-000000000001'
const FAKE_TICKET_ID = 'a1000000-0000-4000-8000-000000000001'

/** Simulate an authenticated user. */
function mockAuthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: FAKE_USER_ID } } })
}

/** Simulate no authenticated user. */
function mockUnauthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

/**
 * Configure `mockFrom` to return the appropriate chainable builder
 * depending on which table is queried.
 *
 * @param tableMocks – A record mapping table name to a factory that returns
 *   the query builder for that call.  Each factory receives the table name
 *   so you can share logic if needed.
 */
function setupFromMock(tableMocks: Record<string, () => any>) {
  mockFrom.mockImplementation((table: string) => {
    const factory = tableMocks[table]
    if (factory) return factory()
    // Default: everything resolves to empty data
    return createQueryBuilder({ data: null, error: null })
  })
}

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'))
}

function makePostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Standard mock for a store lookup that succeeds. */
function storeBuilder() {
  return createQueryBuilder({ data: { id: FAKE_STORE_ID } })
}

/** Standard mock for a store lookup that returns null (no store). */
function noStoreBuilder() {
  return createQueryBuilder({ data: null })
}

// ---------------------------------------------------------------------------
// A sample table session row
// ---------------------------------------------------------------------------
const sampleSession = {
  id: FAKE_SESSION_ID,
  table_id: FAKE_TABLE_ID,
  server_id: null,
  guest_count: 4,
  seated_at: '2026-01-30T12:00:00Z',
  closed_at: null,
  status: 'active',
  notes: null,
  created_at: '2026-01-30T12:00:00Z',
  updated_at: '2026-01-30T12:00:00Z',
  table_layouts: { id: FAKE_TABLE_ID, name: 'Table 1', section: 'Main', capacity: 6 },
}

// ---------------------------------------------------------------------------
// A sample KDS ticket row
// ---------------------------------------------------------------------------
const sampleTicket = {
  id: FAKE_TICKET_ID,
  station_id: FAKE_STATION_ID,
  order_id: FAKE_ORDER_ID,
  table_session_id: FAKE_SESSION_ID,
  items: [{ name: 'Burger', qty: 2, notes: '' }],
  priority: 0,
  status: 'new',
  started_at: null,
  completed_at: null,
  created_at: '2026-01-30T12:05:00Z',
  updated_at: '2026-01-30T12:05:00Z',
}

// ===================================================================
// Import route handlers AFTER mocks are registered
// ===================================================================
import { GET as getTableSessions, POST as postTableSession } from './route'
import {
  GET as getTableSessionById,
  PATCH as patchTableSession,
} from './[id]/route'

import {
  GET as getKdsTickets,
  POST as postKdsTicket,
} from '@/app/api/kds-tickets/route'
import {
  GET as getKdsTicketById,
  PATCH as patchKdsTicket,
} from '@/app/api/kds-tickets/[id]/route'

// ===================================================================
// TABLE SESSIONS
// ===================================================================
describe('Table Sessions API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------
  // GET /api/table-sessions
  // -----------------------------------------------------------------
  describe('GET /api/table-sessions', () => {
    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await getTableSessions(makeGetRequest('/api/table-sessions'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found for user', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: noStoreBuilder,
      })

      const res = await getTableSessions(makeGetRequest('/api/table-sessions'))
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('returns a list of table sessions', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: [sampleSession], count: 1, error: null }),
      })

      const res = await getTableSessions(makeGetRequest('/api/table-sessions'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].id).toBe(FAKE_SESSION_ID)
      expect(json.total).toBe(1)
    })

    it('returns empty list when no sessions exist', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () => createQueryBuilder({ data: [], count: 0, error: null }),
      })

      const res = await getTableSessions(makeGetRequest('/api/table-sessions'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(0)
      expect(json.total).toBe(0)
    })

    it('filters by status query parameter', async () => {
      mockAuthenticatedUser()
      const closedSession = { ...sampleSession, status: 'closed', closed_at: '2026-01-30T14:00:00Z' }
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: [closedSession], count: 1, error: null }),
      })

      const res = await getTableSessions(
        makeGetRequest('/api/table-sessions?status=closed'),
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].status).toBe('closed')
    })

    it('ignores invalid status filter values', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: [sampleSession], count: 1, error: null }),
      })

      const res = await getTableSessions(
        makeGetRequest('/api/table-sessions?status=INVALID'),
      )
      const json = await res.json()

      // Should still return data (invalid status is simply ignored)
      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(1)
    })

    it('returns 500 when database query fails', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: null, count: undefined, error: { message: 'DB failure' } }),
      })

      const res = await getTableSessions(makeGetRequest('/api/table-sessions'))
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('DB failure')
    })

    it('passes pagination params (limit/offset)', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: [sampleSession], count: 50, error: null }),
      })

      const res = await getTableSessions(
        makeGetRequest('/api/table-sessions?limit=10&offset=20'),
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.total).toBe(50)
    })
  })

  // -----------------------------------------------------------------
  // POST /api/table-sessions
  // -----------------------------------------------------------------
  describe('POST /api/table-sessions', () => {
    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { table_id: FAKE_TABLE_ID, guest_count: 2 }),
      )
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found for user', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: noStoreBuilder,
      })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { table_id: FAKE_TABLE_ID, guest_count: 2 }),
      )
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('returns 400 if table_id is missing', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { guest_count: 2 }),
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/table_id/)
    })

    it('returns 400 if guest_count is missing', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { table_id: FAKE_TABLE_ID }),
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/guest_count/)
    })

    it('returns 400 if guest_count is zero', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { table_id: FAKE_TABLE_ID, guest_count: 0 }),
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/guest_count/)
    })

    it('returns 400 if table_id is not a valid UUID', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { table_id: 'not-a-uuid', guest_count: 2 }),
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/table_id/)
    })

    it('returns 404 if table does not belong to store', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_layouts: () => createQueryBuilder({ data: null }),
      })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', { table_id: FAKE_TABLE_ID, guest_count: 4 }),
      )
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('Table not found')
    })

    it('creates a table session successfully', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_layouts: () => createQueryBuilder({ data: { id: FAKE_TABLE_ID } }),
        table_sessions: () => createQueryBuilder({ data: sampleSession, error: null }),
      })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', {
          table_id: FAKE_TABLE_ID,
          guest_count: 4,
          notes: 'Window seat',
        }),
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.data.id).toBe(FAKE_SESSION_ID)
      expect(json.data.guest_count).toBe(4)
    })

    it('creates a table session with optional server_id', async () => {
      mockAuthenticatedUser()
      const sessionWithServer = {
        ...sampleSession,
        server_id: 'ab000000-0000-4000-8000-000000000099',
      }
      setupFromMock({
        stores: storeBuilder,
        table_layouts: () => createQueryBuilder({ data: { id: FAKE_TABLE_ID } }),
        table_sessions: () => createQueryBuilder({ data: sessionWithServer, error: null }),
      })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', {
          table_id: FAKE_TABLE_ID,
          guest_count: 2,
          server_id: 'ab000000-0000-4000-8000-000000000099',
        }),
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.data.server_id).toBe('ab000000-0000-4000-8000-000000000099')
    })

    it('returns 500 when insert fails', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_layouts: () => createQueryBuilder({ data: { id: FAKE_TABLE_ID } }),
        table_sessions: () =>
          createQueryBuilder({ data: null, error: { message: 'Insert failed' } }),
      })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', {
          table_id: FAKE_TABLE_ID,
          guest_count: 4,
        }),
      )
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('Insert failed')
    })

    it('returns 400 for completely empty body', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await postTableSession(
        makePostRequest('/api/table-sessions', {}),
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBeTruthy()
    })
  })

  // -----------------------------------------------------------------
  // GET /api/table-sessions/:id
  // -----------------------------------------------------------------
  describe('GET /api/table-sessions/:id', () => {
    const routeContext = { params: Promise.resolve({ id: FAKE_SESSION_ID }) }

    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await getTableSessionById(
        makeGetRequest(`/api/table-sessions/${FAKE_SESSION_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found for user', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: noStoreBuilder })

      const res = await getTableSessionById(
        makeGetRequest(`/api/table-sessions/${FAKE_SESSION_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('returns 404 if session not found', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: null, error: { message: 'not found' } }),
      })

      const res = await getTableSessionById(
        makeGetRequest(`/api/table-sessions/${FAKE_SESSION_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('Table session not found')
    })

    it('returns a single session detail', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: sampleSession, error: null }),
      })

      const res = await getTableSessionById(
        makeGetRequest(`/api/table-sessions/${FAKE_SESSION_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.id).toBe(FAKE_SESSION_ID)
      expect(json.table_layouts).toBeDefined()
      expect(json.table_layouts.name).toBe('Table 1')
    })
  })

  // -----------------------------------------------------------------
  // PATCH /api/table-sessions/:id
  // -----------------------------------------------------------------
  describe('PATCH /api/table-sessions/:id', () => {
    const routeContext = { params: Promise.resolve({ id: FAKE_SESSION_ID }) }

    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { status: 'closed' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found for user', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: noStoreBuilder })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { status: 'closed' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('updates session status successfully', async () => {
      mockAuthenticatedUser()
      const updatedSession = { ...sampleSession, status: 'closed', closed_at: '2026-01-30T14:00:00Z' }
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: updatedSession, error: null }),
      })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { status: 'closed' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.status).toBe('closed')
    })

    it('updates session notes', async () => {
      mockAuthenticatedUser()
      const updatedSession = { ...sampleSession, notes: 'VIP guest' }
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: updatedSession, error: null }),
      })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { notes: 'VIP guest' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.notes).toBe('VIP guest')
    })

    it('updates guest_count', async () => {
      mockAuthenticatedUser()
      const updatedSession = { ...sampleSession, guest_count: 6 }
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: updatedSession, error: null }),
      })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { guest_count: 6 }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.guest_count).toBe(6)
    })

    it('returns 404 if session not found on update', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: null, error: null }),
      })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { status: 'closed' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('Table session not found')
    })

    it('returns 500 on database error during update', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        table_sessions: () =>
          createQueryBuilder({ data: null, error: { message: 'Update conflict' } }),
      })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { status: 'active' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('Update conflict')
    })

    it('returns 400 for invalid status value', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await patchTableSession(
        makePatchRequest(`/api/table-sessions/${FAKE_SESSION_ID}`, { status: 'INVALID' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/status/)
    })
  })
})

// ===================================================================
// KDS TICKETS
// ===================================================================
describe('KDS Tickets API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -----------------------------------------------------------------
  // GET /api/kds-tickets
  // -----------------------------------------------------------------
  describe('GET /api/kds-tickets', () => {
    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await getKdsTickets(makeGetRequest('/api/kds-tickets'))
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: noStoreBuilder })

      const res = await getKdsTickets(makeGetRequest('/api/kds-tickets'))
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('returns list of KDS tickets', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: [sampleTicket], count: 1, error: null }),
      })

      const res = await getKdsTickets(makeGetRequest('/api/kds-tickets'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data).toHaveLength(1)
      expect(json.data[0].id).toBe(FAKE_TICKET_ID)
      expect(json.total).toBe(1)
    })

    it('filters by status query parameter', async () => {
      mockAuthenticatedUser()
      const preparingTicket = { ...sampleTicket, status: 'preparing', started_at: '2026-01-30T12:10:00Z' }
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: [preparingTicket], count: 1, error: null }),
      })

      const res = await getKdsTickets(makeGetRequest('/api/kds-tickets?status=preparing'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.data[0].status).toBe('preparing')
    })

    it('returns 500 on database error', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: null, count: undefined, error: { message: 'DB read error' } }),
      })

      const res = await getKdsTickets(makeGetRequest('/api/kds-tickets'))
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('DB read error')
    })

    it('supports pagination', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: [sampleTicket], count: 100, error: null }),
      })

      const res = await getKdsTickets(makeGetRequest('/api/kds-tickets?limit=5&offset=10'))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.total).toBe(100)
    })
  })

  // -----------------------------------------------------------------
  // POST /api/kds-tickets
  // -----------------------------------------------------------------
  describe('POST /api/kds-tickets', () => {
    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await postKdsTicket(
        makePostRequest('/api/kds-tickets', { items: [{ name: 'Pizza', qty: 1 }] }),
      )
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: noStoreBuilder })

      const res = await postKdsTicket(
        makePostRequest('/api/kds-tickets', { items: [{ name: 'Pizza', qty: 1 }] }),
      )
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('creates a KDS ticket successfully', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () => createQueryBuilder({ data: sampleTicket, error: null }),
      })

      const res = await postKdsTicket(
        makePostRequest('/api/kds-tickets', {
          station_id: FAKE_STATION_ID,
          order_id: FAKE_ORDER_ID,
          table_session_id: FAKE_SESSION_ID,
          items: [{ name: 'Burger', qty: 2, notes: '' }],
          priority: 0,
        }),
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.data.id).toBe(FAKE_TICKET_ID)
      expect(json.data.items).toHaveLength(1)
    })

    it('creates a KDS ticket with minimal body (all fields optional)', async () => {
      mockAuthenticatedUser()
      const minimalTicket = { ...sampleTicket, station_id: null, order_id: null, table_session_id: null, items: [] }
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () => createQueryBuilder({ data: minimalTicket, error: null }),
      })

      const res = await postKdsTicket(
        makePostRequest('/api/kds-tickets', {}),
      )
      const json = await res.json()

      expect(res.status).toBe(201)
      expect(json.data).toBeDefined()
    })

    it('returns 500 on insert failure', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: null, error: { message: 'Insert KDS failed' } }),
      })

      const res = await postKdsTicket(
        makePostRequest('/api/kds-tickets', {
          items: [{ name: 'Salad', qty: 1 }],
        }),
      )
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('Insert KDS failed')
    })
  })

  // -----------------------------------------------------------------
  // GET /api/kds-tickets/:id
  // -----------------------------------------------------------------
  describe('GET /api/kds-tickets/:id', () => {
    const routeContext = { params: Promise.resolve({ id: FAKE_TICKET_ID }) }

    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await getKdsTicketById(
        makeGetRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 404 if ticket not found', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: null, error: { message: 'not found' } }),
      })

      const res = await getKdsTicketById(
        makeGetRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('KDS ticket not found')
    })

    it('returns a single KDS ticket', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: sampleTicket, error: null }),
      })

      const res = await getKdsTicketById(
        makeGetRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.id).toBe(FAKE_TICKET_ID)
      expect(json.status).toBe('new')
    })
  })

  // -----------------------------------------------------------------
  // PATCH /api/kds-tickets/:id
  // -----------------------------------------------------------------
  describe('PATCH /api/kds-tickets/:id', () => {
    const routeContext = { params: Promise.resolve({ id: FAKE_TICKET_ID }) }

    it('returns 401 if not authenticated', async () => {
      mockUnauthenticatedUser()

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'preparing' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns 403 if no store found', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: noStoreBuilder })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'preparing' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('Store not found')
    })

    it('updates ticket status to preparing', async () => {
      mockAuthenticatedUser()
      const preparingTicket = {
        ...sampleTicket,
        status: 'preparing',
        started_at: '2026-01-30T12:10:00Z',
      }
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: preparingTicket, error: null }),
      })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'preparing' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.status).toBe('preparing')
    })

    it('updates ticket status to ready', async () => {
      mockAuthenticatedUser()
      const readyTicket = {
        ...sampleTicket,
        status: 'ready',
        started_at: '2026-01-30T12:10:00Z',
        completed_at: '2026-01-30T12:25:00Z',
      }
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: readyTicket, error: null }),
      })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'ready' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.status).toBe('ready')
    })

    it('updates ticket priority', async () => {
      mockAuthenticatedUser()
      const highPriorityTicket = { ...sampleTicket, priority: 5 }
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: highPriorityTicket, error: null }),
      })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { priority: 5 }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.priority).toBe(5)
    })

    it('returns 404 if ticket not found on update', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: null, error: null }),
      })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'served' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('KDS ticket not found')
    })

    it('returns 500 on database error during update', async () => {
      mockAuthenticatedUser()
      setupFromMock({
        stores: storeBuilder,
        kds_tickets: () =>
          createQueryBuilder({ data: null, error: { message: 'Update KDS failed' } }),
      })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'cancelled' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(500)
      expect(json.error).toBe('Update KDS failed')
    })

    it('returns 400 for invalid status value', async () => {
      mockAuthenticatedUser()
      setupFromMock({ stores: storeBuilder })

      const res = await patchKdsTicket(
        makePatchRequest(`/api/kds-tickets/${FAKE_TICKET_ID}`, { status: 'BOGUS' }),
        routeContext,
      )
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toMatch(/status/)
    })
  })
})
