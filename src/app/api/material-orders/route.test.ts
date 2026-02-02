/**
 * Comprehensive tests for Construction vertical routes:
 *
 *   GET  /api/material-orders        (list)
 *   POST /api/material-orders        (create)
 *   GET  /api/material-orders/:id    (detail)
 *   PATCH /api/material-orders/:id   (update)
 *   DELETE /api/material-orders/:id  (delete)
 *
 *   GET  /api/inspections            (list)
 *   POST /api/inspections            (create)
 *   GET  /api/inspections/:id        (detail)
 *   PATCH /api/inspections/:id       (update)
 *   DELETE /api/inspections/:id      (delete)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
let mockUser: { id: string } | null = null
let mockStore: { id: string } | null = null

// Material-order state
let mockMaterialOrders: unknown[]
let mockMaterialOrderCount: number
let mockMaterialOrderInserted: Record<string, unknown> | null
let mockMaterialOrderInsertError: { message: string } | null
let mockMaterialOrderSelectError: { message: string } | null
let mockMaterialOrderSingle: Record<string, unknown> | null
let mockMaterialOrderSingleError: { message: string } | null
let mockMaterialOrderUpdateResult: Record<string, unknown> | null
let mockMaterialOrderUpdateError: { message: string } | null
let mockMaterialOrderDeleteError: { message: string } | null

// Inspection state
let mockInspections: unknown[]
let mockInspectionCount: number
let mockInspectionInserted: Record<string, unknown> | null
let mockInspectionInsertError: { message: string } | null
let mockInspectionSelectError: { message: string } | null
let mockInspectionSingle: Record<string, unknown> | null
let mockInspectionSingleError: { message: string } | null
let mockInspectionUpdateResult: Record<string, unknown> | null
let mockInspectionUpdateError: { message: string } | null
let mockInspectionDeleteError: { message: string } | null

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { user: mockUser } }),
      ),
    },
    from: mockFrom,
  })),
}))

// ---------------------------------------------------------------------------
// Imports (must come AFTER vi.mock)
// ---------------------------------------------------------------------------
import { GET as materialOrderListGET, POST as materialOrderPOST } from './route'
import {
  GET as materialOrderDetailGET,
  PATCH as materialOrderPATCH,
  DELETE as materialOrderDELETE,
} from './[id]/route'
import { GET as inspectionListGET, POST as inspectionPOST } from '../inspections/route'
import {
  GET as inspectionDetailGET,
  PATCH as inspectionPATCH,
  DELETE as inspectionDELETE,
} from '../inspections/[id]/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(url: string, body?: unknown): Request {
  if (body !== undefined) {
    return new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request(url, { method: 'GET' })
}

function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

const VALID_UUID = 'a0000000-0000-4000-8000-000000000001'
const STORE_ID = 'store-001'

// ---------------------------------------------------------------------------
// beforeEach – reset all mock state
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()

  mockUser = { id: 'user-001' }
  mockStore = { id: STORE_ID }

  // Material orders defaults
  mockMaterialOrders = []
  mockMaterialOrderCount = 0
  mockMaterialOrderInserted = { id: 'mo-001', supplier_name: 'Acme Concrete', status: 'ordered' }
  mockMaterialOrderInsertError = null
  mockMaterialOrderSelectError = null
  mockMaterialOrderSingle = {
    id: 'mo-001',
    store_id: STORE_ID,
    supplier_name: 'Acme Concrete',
    project_id: VALID_UUID,
    status: 'ordered',
    total_cost: 5000,
    created_at: '2026-01-15T00:00:00Z',
  }
  mockMaterialOrderSingleError = null
  mockMaterialOrderUpdateResult = {
    id: 'mo-001',
    supplier_name: 'Updated Supplier',
    status: 'shipped',
    updated_at: '2026-02-01T00:00:00Z',
  }
  mockMaterialOrderUpdateError = null
  mockMaterialOrderDeleteError = null

  // Inspection defaults
  mockInspections = []
  mockInspectionCount = 0
  mockInspectionInserted = {
    id: 'insp-001',
    inspector_name: 'John Smith',
    inspection_type: 'structural',
    scheduled_date: '2026-03-01',
  }
  mockInspectionInsertError = null
  mockInspectionSelectError = null
  mockInspectionSingle = {
    id: 'insp-001',
    store_id: STORE_ID,
    inspector_name: 'John Smith',
    inspection_type: 'structural',
    project_id: VALID_UUID,
    result: 'pending',
    scheduled_date: '2026-03-01',
  }
  mockInspectionSingleError = null
  mockInspectionUpdateResult = {
    id: 'insp-001',
    result: 'pass',
    updated_at: '2026-02-01T00:00:00Z',
  }
  mockInspectionUpdateError = null
  mockInspectionDeleteError = null

  // ---------- mockFrom implementation ----------
  mockFrom.mockImplementation((table: string) => {
    // --- stores ---
    if (table === 'stores') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockStore }),
          })),
        })),
      }
    }

    // --- material_orders ---
    if (table === 'material_orders') {
      // Chainable + thenable for list queries (GET list)
      const listQuery: Record<string, unknown> = {}
      listQuery.eq = vi.fn(() => listQuery)
      listQuery.order = vi.fn(() => listQuery)
      listQuery.range = vi.fn(() => listQuery)
      listQuery.single = vi.fn().mockResolvedValue({
        data: mockMaterialOrderSingle,
        error: mockMaterialOrderSingleError,
      })
      listQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({
          data: mockMaterialOrders,
          count: mockMaterialOrderCount,
          error: mockMaterialOrderSelectError,
        }),
      )

      // Insert chain for POST (.select().single())
      const insertQuery: Record<string, unknown> = {}
      insertQuery.select = vi.fn(() => insertQuery)
      insertQuery.single = vi.fn().mockResolvedValue({
        data: mockMaterialOrderInserted,
        error: mockMaterialOrderInsertError,
      })

      // Update chain for PATCH (.eq().eq().select().single())
      const updateQuery: Record<string, unknown> = {}
      updateQuery.eq = vi.fn(() => updateQuery)
      updateQuery.select = vi.fn(() => updateQuery)
      updateQuery.single = vi.fn().mockResolvedValue({
        data: mockMaterialOrderUpdateResult,
        error: mockMaterialOrderUpdateError,
      })

      // Delete chain
      const deleteQuery: Record<string, unknown> = {}
      deleteQuery.eq = vi.fn(() => deleteQuery)
      deleteQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ error: mockMaterialOrderDeleteError }),
      )

      return {
        select: vi.fn(() => listQuery),
        insert: vi.fn(() => insertQuery),
        update: vi.fn(() => updateQuery),
        delete: vi.fn(() => deleteQuery),
      }
    }

    // --- inspections ---
    if (table === 'inspections') {
      // Chainable + thenable for list queries (GET list)
      const listQuery: Record<string, unknown> = {}
      listQuery.eq = vi.fn(() => listQuery)
      listQuery.order = vi.fn(() => listQuery)
      listQuery.range = vi.fn(() => listQuery)
      listQuery.single = vi.fn().mockResolvedValue({
        data: mockInspectionSingle,
        error: mockInspectionSingleError,
      })
      listQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({
          data: mockInspections,
          count: mockInspectionCount,
          error: mockInspectionSelectError,
        }),
      )

      // Insert chain for POST
      const insertQuery: Record<string, unknown> = {}
      insertQuery.select = vi.fn(() => insertQuery)
      insertQuery.single = vi.fn().mockResolvedValue({
        data: mockInspectionInserted,
        error: mockInspectionInsertError,
      })

      // Update chain for PATCH
      const updateQuery: Record<string, unknown> = {}
      updateQuery.eq = vi.fn(() => updateQuery)
      updateQuery.select = vi.fn(() => updateQuery)
      updateQuery.single = vi.fn().mockResolvedValue({
        data: mockInspectionUpdateResult,
        error: mockInspectionUpdateError,
      })

      // Delete chain
      const deleteQuery: Record<string, unknown> = {}
      deleteQuery.eq = vi.fn(() => deleteQuery)
      deleteQuery.then = vi.fn((resolve: (v: unknown) => void) =>
        resolve({ error: mockInspectionDeleteError }),
      )

      return {
        select: vi.fn(() => listQuery),
        insert: vi.fn(() => insertQuery),
        update: vi.fn(() => updateQuery),
        delete: vi.fn(() => deleteQuery),
      }
    }

    // Fallback
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
// MATERIAL ORDERS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/material-orders
// ---------------------------------------------------------------------------
describe('GET /api/material-orders', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders') as never,
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders') as never,
    )
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Store not found')
  })

  it('returns list of material orders', async () => {
    mockMaterialOrders = [
      { id: 'mo-1', supplier_name: 'Acme', status: 'ordered' },
      { id: 'mo-2', supplier_name: 'BrickCo', status: 'shipped' },
    ]
    mockMaterialOrderCount = 2

    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no material orders exist', async () => {
    mockMaterialOrders = []
    mockMaterialOrderCount = 0

    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('filters by status', async () => {
    mockMaterialOrders = [{ id: 'mo-1', status: 'shipped' }]
    mockMaterialOrderCount = 1

    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders?status=shipped') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by project_id', async () => {
    mockMaterialOrders = [{ id: 'mo-1', project_id: VALID_UUID }]
    mockMaterialOrderCount = 1

    const res = await materialOrderListGET(
      makeRequest(`http://localhost/api/material-orders?project_id=${VALID_UUID}`) as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid status filter values', async () => {
    mockMaterialOrders = []
    mockMaterialOrderCount = 0

    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders?status=bogus') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockMaterialOrders = [{ id: 'mo-26' }]
    mockMaterialOrderCount = 100

    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders?limit=25&offset=50') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(100)
  })

  it('returns 500 on database error', async () => {
    mockMaterialOrderSelectError = { message: 'DB connection lost' }

    const res = await materialOrderListGET(
      makeRequest('http://localhost/api/material-orders') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('DB connection lost')
  })
})

// ---------------------------------------------------------------------------
// POST /api/material-orders
// ---------------------------------------------------------------------------
describe('POST /api/material-orders', () => {
  const validBody = {
    project_id: VALID_UUID,
    supplier_name: 'Acme Concrete',
    order_date: '2026-02-01',
    expected_delivery: '2026-02-15',
    total_cost: 12500,
    notes: 'Rush delivery for foundation pour',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', validBody) as never,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', validBody) as never,
    )
    expect(res.status).toBe(403)
  })

  it('creates material order successfully with all fields', async () => {
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', validBody) as never,
    )
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('mo-001')
  })

  it('creates material order with only required fields', async () => {
    const minimalBody = {
      project_id: VALID_UUID,
      supplier_name: 'MinimalCo',
    }
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', minimalBody) as never,
    )
    expect(res.status).toBe(201)
  })

  it('returns 400 when project_id is missing', async () => {
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', {
        supplier_name: 'No Project',
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when supplier_name is missing', async () => {
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', {
        project_id: VALID_UUID,
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when project_id is not a valid UUID', async () => {
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', {
        project_id: 'not-a-uuid',
        supplier_name: 'SomeCo',
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/material-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json!!!',
    })
    const res = await materialOrderPOST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when total_cost is negative', async () => {
    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', {
        project_id: VALID_UUID,
        supplier_name: 'BadCost',
        total_cost: -100,
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert error', async () => {
    mockMaterialOrderInsertError = { message: 'Insert failed' }
    mockMaterialOrderInserted = null

    const res = await materialOrderPOST(
      makeRequest('http://localhost/api/material-orders', validBody) as never,
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })
})

// ---------------------------------------------------------------------------
// GET /api/material-orders/:id
// ---------------------------------------------------------------------------
describe('GET /api/material-orders/:id', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await materialOrderDetailGET(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await materialOrderDetailGET(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(403)
  })

  it('returns material order detail', async () => {
    const res = await materialOrderDetailGET(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('mo-001')
    expect(json.supplier_name).toBe('Acme Concrete')
  })

  it('returns 404 when material order not found', async () => {
    mockMaterialOrderSingle = null

    const res = await materialOrderDetailGET(
      makeRequest('http://localhost/api/material-orders/nonexistent') as never,
      makeRouteContext('nonexistent'),
    )
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Material order not found')
  })

  it('returns 404 when DB returns an error', async () => {
    mockMaterialOrderSingleError = { message: 'Row not found' }

    const res = await materialOrderDetailGET(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/material-orders/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/material-orders/:id', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/mo-001', { status: 'shipped' }) as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/mo-001', { status: 'shipped' }) as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(403)
  })

  it('updates material order status successfully', async () => {
    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/mo-001', { status: 'shipped' }) as never,
      makeRouteContext('mo-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('shipped')
  })

  it('updates material order supplier_name', async () => {
    mockMaterialOrderUpdateResult = { id: 'mo-001', supplier_name: 'NewCo' }

    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/mo-001', {
        supplier_name: 'NewCo',
      }) as never,
      makeRouteContext('mo-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.supplier_name).toBe('NewCo')
  })

  it('returns 400 for invalid status value', async () => {
    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/mo-001', {
        status: 'invalid_status',
      }) as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when material order not found for update', async () => {
    mockMaterialOrderUpdateResult = null
    mockMaterialOrderUpdateError = null

    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/nonexistent', {
        status: 'delivered',
      }) as never,
      makeRouteContext('nonexistent'),
    )
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Material order not found')
  })

  it('returns 500 on update DB error', async () => {
    mockMaterialOrderUpdateError = { message: 'Update constraint violation' }

    const res = await materialOrderPATCH(
      makeRequest('http://localhost/api/material-orders/mo-001', {
        status: 'delivered',
      }) as never,
      makeRouteContext('mo-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Update constraint violation')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/material-orders/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/material-orders/:id', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await materialOrderDELETE(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await materialOrderDELETE(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    expect(res.status).toBe(403)
  })

  it('deletes material order successfully', async () => {
    const res = await materialOrderDELETE(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 on delete DB error', async () => {
    mockMaterialOrderDeleteError = { message: 'FK constraint' }

    const res = await materialOrderDELETE(
      makeRequest('http://localhost/api/material-orders/mo-001') as never,
      makeRouteContext('mo-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('FK constraint')
  })
})

// ===========================================================================
// INSPECTIONS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/inspections
// ---------------------------------------------------------------------------
describe('GET /api/inspections', () => {
  it('returns 401 if user is not authenticated', async () => {
    mockUser = null
    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections') as never,
    )
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 if user has no store', async () => {
    mockStore = null
    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections') as never,
    )
    expect(res.status).toBe(403)
  })

  it('returns list of inspections', async () => {
    mockInspections = [
      { id: 'insp-1', inspection_type: 'structural', result: 'pass' },
      { id: 'insp-2', inspection_type: 'electrical', result: 'pending' },
    ]
    mockInspectionCount = 2

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
  })

  it('returns empty list when no inspections exist', async () => {
    mockInspections = []
    mockInspectionCount = 0

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })

  it('filters by result', async () => {
    mockInspections = [{ id: 'insp-1', result: 'fail' }]
    mockInspectionCount = 1

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections?result=fail') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by inspection_type', async () => {
    mockInspections = [{ id: 'insp-1', inspection_type: 'fire' }]
    mockInspectionCount = 1

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections?inspection_type=fire') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('filters by project_id', async () => {
    mockInspections = [{ id: 'insp-1', project_id: VALID_UUID }]
    mockInspectionCount = 1

    const res = await inspectionListGET(
      makeRequest(`http://localhost/api/inspections?project_id=${VALID_UUID}`) as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('supports combined filters', async () => {
    mockInspections = [{ id: 'insp-1', result: 'pass', inspection_type: 'structural' }]
    mockInspectionCount = 1

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections?result=pass&inspection_type=structural') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
  })

  it('ignores invalid result filter values', async () => {
    mockInspections = []
    mockInspectionCount = 0

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections?result=invalid') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(0)
  })

  it('supports pagination parameters', async () => {
    mockInspections = [{ id: 'insp-51' }]
    mockInspectionCount = 200

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections?limit=10&offset=50') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.total).toBe(200)
  })

  it('returns 500 on database error', async () => {
    mockInspectionSelectError = { message: 'Timeout' }

    const res = await inspectionListGET(
      makeRequest('http://localhost/api/inspections') as never,
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Timeout')
  })
})

// ---------------------------------------------------------------------------
// POST /api/inspections
// ---------------------------------------------------------------------------
describe('POST /api/inspections', () => {
  const validBody = {
    project_id: VALID_UUID,
    inspection_type: 'structural' as const,
    inspector_name: 'John Smith',
    scheduled_date: '2026-03-15',
    notes: 'Foundation inspection before pouring',
  }

  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', validBody) as never,
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', validBody) as never,
    )
    expect(res.status).toBe(403)
  })

  it('creates inspection successfully with all fields', async () => {
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', validBody) as never,
    )
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.id).toBe('insp-001')
    expect(json.inspector_name).toBe('John Smith')
  })

  it('creates inspection with only required fields', async () => {
    const minimalBody = {
      project_id: VALID_UUID,
      inspector_name: 'Jane Doe',
      scheduled_date: '2026-04-01',
    }
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', minimalBody) as never,
    )
    expect(res.status).toBe(201)
  })

  it('returns 400 when project_id is missing', async () => {
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', {
        inspector_name: 'Test',
        scheduled_date: '2026-03-01',
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when inspector_name is missing', async () => {
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', {
        project_id: VALID_UUID,
        scheduled_date: '2026-03-01',
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when scheduled_date is missing', async () => {
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', {
        project_id: VALID_UUID,
        inspector_name: 'Test Inspector',
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when project_id is not a valid UUID', async () => {
    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', {
        project_id: 'not-uuid',
        inspector_name: 'Test',
        scheduled_date: '2026-03-01',
      }) as never,
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{not json',
    })
    const res = await inspectionPOST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on insert error', async () => {
    mockInspectionInsertError = { message: 'Insert constraint violation' }
    mockInspectionInserted = null

    const res = await inspectionPOST(
      makeRequest('http://localhost/api/inspections', validBody) as never,
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert constraint violation')
  })
})

// ---------------------------------------------------------------------------
// GET /api/inspections/:id
// ---------------------------------------------------------------------------
describe('GET /api/inspections/:id', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await inspectionDetailGET(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await inspectionDetailGET(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(403)
  })

  it('returns inspection detail', async () => {
    const res = await inspectionDetailGET(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.id).toBe('insp-001')
    expect(json.inspector_name).toBe('John Smith')
    expect(json.inspection_type).toBe('structural')
  })

  it('returns 404 when inspection not found', async () => {
    mockInspectionSingle = null

    const res = await inspectionDetailGET(
      makeRequest('http://localhost/api/inspections/nonexistent') as never,
      makeRouteContext('nonexistent'),
    )
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Inspection not found')
  })

  it('returns 404 when DB returns an error', async () => {
    mockInspectionSingleError = { message: 'Row not found' }

    const res = await inspectionDetailGET(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/inspections/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/inspections/:id', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/insp-001', { result: 'pass' }) as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/insp-001', { result: 'pass' }) as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(403)
  })

  it('updates inspection result to pass', async () => {
    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/insp-001', { result: 'pass' }) as never,
      makeRouteContext('insp-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.result).toBe('pass')
  })

  it('updates inspection with multiple fields', async () => {
    mockInspectionUpdateResult = {
      id: 'insp-001',
      result: 'fail',
      required_corrections: 'Fix wiring in unit 3B',
      notes: 'Needs follow-up',
    }

    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/insp-001', {
        result: 'fail',
        required_corrections: 'Fix wiring in unit 3B',
        notes: 'Needs follow-up',
      }) as never,
      makeRouteContext('insp-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.result).toBe('fail')
    expect(json.required_corrections).toBe('Fix wiring in unit 3B')
  })

  it('returns 400 for invalid result value', async () => {
    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/insp-001', {
        result: 'unknown_value',
      }) as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(400)
  })

  it('returns 404 when inspection not found for update', async () => {
    mockInspectionUpdateResult = null
    mockInspectionUpdateError = null

    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/nonexistent', {
        result: 'pass',
      }) as never,
      makeRouteContext('nonexistent'),
    )
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Inspection not found')
  })

  it('returns 500 on update DB error', async () => {
    mockInspectionUpdateError = { message: 'Constraint violation' }

    const res = await inspectionPATCH(
      makeRequest('http://localhost/api/inspections/insp-001', {
        result: 'partial',
      }) as never,
      makeRouteContext('insp-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Constraint violation')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/inspections/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/inspections/:id', () => {
  it('returns 401 if not authenticated', async () => {
    mockUser = null
    const res = await inspectionDELETE(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 if no store', async () => {
    mockStore = null
    const res = await inspectionDELETE(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    expect(res.status).toBe(403)
  })

  it('deletes inspection successfully', async () => {
    const res = await inspectionDELETE(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns 500 on delete DB error', async () => {
    mockInspectionDeleteError = { message: 'Cannot delete, related records exist' }

    const res = await inspectionDELETE(
      makeRequest('http://localhost/api/inspections/insp-001') as never,
      makeRouteContext('insp-001'),
    )
    const json = await res.json()
    expect(res.status).toBe(500)
    expect(json.error).toBe('Cannot delete, related records exist')
  })
})
