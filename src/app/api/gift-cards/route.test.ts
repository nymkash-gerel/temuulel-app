/**
 * Comprehensive tests for Stay, Beauty, and Retail vertical routes:
 *   - /api/gift-cards          (GET list + POST create)
 *   - /api/gift-cards/[id]     (GET detail + PATCH update)
 *   - /api/loyalty-transactions (GET list + POST create)
 *   - /api/loyalty-transactions/[id] (GET detail + PATCH update)
 *   - /api/stock-transfers     (GET list + POST create)
 *   - /api/stock-transfers/[id] (GET detail + PATCH update)
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
    }
  )
  return builder
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'a0000000-0000-4000-8000-000000000001'
const TEST_STORE_ID = 'b0000000-0000-4000-8000-000000000001'
const TEST_GIFT_CARD_ID = 'c0000000-0000-4000-8000-000000000001'
const TEST_CUSTOMER_ID = 'd0000000-0000-4000-8000-000000000001'
const TEST_TRANSACTION_ID = 'e0000000-0000-4000-8000-000000000001'
const TEST_TRANSFER_ID = 'f0000000-0000-4000-8000-000000000001'
const TEST_PRODUCT_ID = 'a1000000-0000-4000-8000-000000000001'
const TEST_LOCATION_A = 'b1000000-0000-4000-8000-000000000001'
const TEST_LOCATION_B = 'b2000000-0000-4000-8000-000000000002'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
}

function unauthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } })
}

function storeExists() {
  // The first call to mockFrom('stores') should return the store
  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return createQueryBuilder({ data: { id: TEST_STORE_ID } })
    }
    // Default fallback for other tables
    return createQueryBuilder({ data: null, error: null })
  })
}

function storeNotFound() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return createQueryBuilder({ data: null })
    }
    return createQueryBuilder({ data: null, error: null })
  })
}

/**
 * Set up mockFrom to return storeExists for 'stores' and a custom builder
 * for the given table.
 */
function setupMockFrom(
  targetTable: string,
  resolveValue: { data: any; error?: any; count?: number }
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return createQueryBuilder({ data: { id: TEST_STORE_ID } })
    }
    if (table === targetTable) {
      return createQueryBuilder(resolveValue)
    }
    return createQueryBuilder({ data: null, error: null })
  })
}

/**
 * Set up mockFrom to support multiple non-store tables with different values.
 */
function setupMockFromMulti(
  tableMap: Record<string, { data: any; error?: any; count?: number }>
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'stores') {
      return createQueryBuilder({ data: { id: TEST_STORE_ID } })
    }
    if (tableMap[table]) {
      return createQueryBuilder(tableMap[table])
    }
    return createQueryBuilder({ data: null, error: null })
  })
}

function makeGetRequest(path: string, params?: Record<string, string>): NextRequest {
  const url = new URL(`http://localhost${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url)
}

function makePostRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePatchRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Imports — must come after vi.mock calls
// ---------------------------------------------------------------------------

import { GET as giftCardsGET, POST as giftCardsPOST } from './route'
import { GET as giftCardDetailGET, PATCH as giftCardDetailPATCH } from './[id]/route'
import { GET as loyaltyGET, POST as loyaltyPOST } from '../loyalty-transactions/route'
import {
  GET as loyaltyDetailGET,
  PATCH as loyaltyDetailPATCH,
} from '../loyalty-transactions/[id]/route'
import { GET as stockTransfersGET, POST as stockTransfersPOST } from '../stock-transfers/route'
import {
  GET as stockTransferDetailGET,
  PATCH as stockTransferDetailPATCH,
} from '../stock-transfers/[id]/route'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// Gift Cards — /api/gift-cards (GET + POST)
// ===========================================================================

describe('GET /api/gift-cards', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await giftCardsGET(makeGetRequest('/api/gift-cards'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when store is not found for the user', async () => {
    authenticatedUser()
    storeNotFound()

    const res = await giftCardsGET(makeGetRequest('/api/gift-cards'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns a list of gift cards with total count', async () => {
    authenticatedUser()
    const giftCards = [
      {
        id: TEST_GIFT_CARD_ID,
        store_id: TEST_STORE_ID,
        code: 'GIFT-100',
        initial_balance: 100000,
        current_balance: 75000,
        customer_id: null,
        status: 'active',
        expires_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        customers: null,
      },
    ]

    setupMockFrom('gift_cards', { data: giftCards, count: 1 })

    const res = await giftCardsGET(makeGetRequest('/api/gift-cards'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual(giftCards)
    expect(json.total).toBe(1)
  })

  it('passes status filter when status is a valid value', async () => {
    authenticatedUser()
    setupMockFrom('gift_cards', { data: [], count: 0 })

    const res = await giftCardsGET(makeGetRequest('/api/gift-cards', { status: 'expired' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(json.total).toBe(0)
    // Verify from was called with gift_cards table
    expect(mockFrom).toHaveBeenCalledWith('gift_cards')
  })

  it('returns 500 when database query fails', async () => {
    authenticatedUser()
    setupMockFrom('gift_cards', { data: null, error: { message: 'DB connection lost' }, count: 0 })

    const res = await giftCardsGET(makeGetRequest('/api/gift-cards'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('DB connection lost')
  })
})

describe('POST /api/gift-cards', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', {
        code: 'GIFT-200',
        initial_balance: 50000,
        current_balance: 50000,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when store is not found for the user', async () => {
    authenticatedUser()
    storeNotFound()

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', {
        code: 'GIFT-200',
        initial_balance: 50000,
        current_balance: 50000,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns 400 when required fields are missing', async () => {
    authenticatedUser()
    storeExists()

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', { initial_balance: 50000 })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
    // Should complain about missing code and current_balance
    expect(json.error).toMatch(/code/)
  })

  it('returns 400 when initial_balance is negative', async () => {
    authenticatedUser()
    storeExists()

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', {
        code: 'GIFT-NEG',
        initial_balance: -100,
        current_balance: 0,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('creates a gift card successfully and returns 201', async () => {
    authenticatedUser()
    const createdCard = {
      id: TEST_GIFT_CARD_ID,
      store_id: TEST_STORE_ID,
      code: 'GIFT-NEW',
      initial_balance: 50000,
      current_balance: 50000,
      customer_id: null,
      status: 'active',
      expires_at: null,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      customers: null,
    }

    setupMockFrom('gift_cards', { data: createdCard })

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', {
        code: 'GIFT-NEW',
        initial_balance: 50000,
        current_balance: 50000,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.code).toBe('GIFT-NEW')
    expect(json.initial_balance).toBe(50000)
    expect(json.store_id).toBe(TEST_STORE_ID)
  })

  it('creates a gift card with optional customer_id and expires_at', async () => {
    authenticatedUser()
    const createdCard = {
      id: TEST_GIFT_CARD_ID,
      store_id: TEST_STORE_ID,
      code: 'GIFT-CUST',
      initial_balance: 100000,
      current_balance: 100000,
      customer_id: TEST_CUSTOMER_ID,
      status: 'active',
      expires_at: '2027-01-01T00:00:00Z',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
      customers: { id: TEST_CUSTOMER_ID, name: 'Test Customer', phone: '99001122' },
    }

    setupMockFrom('gift_cards', { data: createdCard })

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', {
        code: 'GIFT-CUST',
        initial_balance: 100000,
        current_balance: 100000,
        customer_id: TEST_CUSTOMER_ID,
        expires_at: '2027-01-01T00:00:00Z',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.customer_id).toBe(TEST_CUSTOMER_ID)
    expect(json.expires_at).toBe('2027-01-01T00:00:00Z')
  })

  it('returns 500 when insert fails', async () => {
    authenticatedUser()
    setupMockFrom('gift_cards', { data: null, error: { message: 'Unique constraint violation' } })

    const res = await giftCardsPOST(
      makePostRequest('/api/gift-cards', {
        code: 'GIFT-DUP',
        initial_balance: 50000,
        current_balance: 50000,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Unique constraint violation')
  })
})

// ===========================================================================
// Gift Cards — /api/gift-cards/[id] (GET + PATCH)
// ===========================================================================

describe('GET /api/gift-cards/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await giftCardDetailGET(
      makeGetRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 404 when gift card does not exist', async () => {
    authenticatedUser()
    setupMockFrom('gift_cards', { data: null, error: { message: 'not found' } })

    const res = await giftCardDetailGET(
      makeGetRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Gift card not found')
  })

  it('returns a single gift card by id', async () => {
    authenticatedUser()
    const giftCard = {
      id: TEST_GIFT_CARD_ID,
      store_id: TEST_STORE_ID,
      code: 'GIFT-DETAIL',
      initial_balance: 80000,
      current_balance: 60000,
      customer_id: null,
      status: 'active',
      expires_at: null,
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-20T00:00:00Z',
      customers: null,
    }

    setupMockFrom('gift_cards', { data: giftCard })

    const res = await giftCardDetailGET(
      makeGetRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe(TEST_GIFT_CARD_ID)
    expect(json.code).toBe('GIFT-DETAIL')
    expect(json.current_balance).toBe(60000)
  })
})

describe('PATCH /api/gift-cards/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await giftCardDetailPATCH(
      makePatchRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`, { status: 'disabled' }),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when store is not found', async () => {
    authenticatedUser()
    storeNotFound()

    const res = await giftCardDetailPATCH(
      makePatchRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`, { status: 'disabled' }),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('updates a gift card successfully', async () => {
    authenticatedUser()
    const updatedCard = {
      id: TEST_GIFT_CARD_ID,
      store_id: TEST_STORE_ID,
      code: 'GIFT-UPD',
      initial_balance: 50000,
      current_balance: 25000,
      customer_id: null,
      status: 'active',
      expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-01T10:00:00Z',
      customers: null,
    }

    setupMockFrom('gift_cards', { data: updatedCard })

    const res = await giftCardDetailPATCH(
      makePatchRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`, { current_balance: 25000 }),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.current_balance).toBe(25000)
  })

  it('returns 404 when gift card to update does not exist', async () => {
    authenticatedUser()
    // error is null but data is null => 404
    setupMockFrom('gift_cards', { data: null, error: null })

    const res = await giftCardDetailPATCH(
      makePatchRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`, { status: 'disabled' }),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Gift card not found')
  })

  it('returns 500 when update encounters a database error', async () => {
    authenticatedUser()
    setupMockFrom('gift_cards', { data: null, error: { message: 'Update failed' } })

    const res = await giftCardDetailPATCH(
      makePatchRequest(`/api/gift-cards/${TEST_GIFT_CARD_ID}`, { status: 'disabled' }),
      routeContext(TEST_GIFT_CARD_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Update failed')
  })
})

// ===========================================================================
// Loyalty Transactions — /api/loyalty-transactions (GET + POST)
// ===========================================================================

describe('GET /api/loyalty-transactions', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await loyaltyGET(makeGetRequest('/api/loyalty-transactions'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns a list of loyalty transactions', async () => {
    authenticatedUser()
    const transactions = [
      {
        id: TEST_TRANSACTION_ID,
        store_id: TEST_STORE_ID,
        customer_id: TEST_CUSTOMER_ID,
        points: 500,
        transaction_type: 'earn',
        reference_type: 'order',
        reference_id: null,
        description: 'Purchase reward',
        created_at: '2026-01-20T00:00:00Z',
        customers: { id: TEST_CUSTOMER_ID, name: 'Bat', phone: '99112233' },
      },
    ]

    setupMockFrom('loyalty_transactions', { data: transactions, count: 1 })

    const res = await loyaltyGET(makeGetRequest('/api/loyalty-transactions'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual(transactions)
    expect(json.total).toBe(1)
  })

  it('applies customer_id filter', async () => {
    authenticatedUser()
    setupMockFrom('loyalty_transactions', { data: [], count: 0 })

    const res = await loyaltyGET(
      makeGetRequest('/api/loyalty-transactions', { customer_id: TEST_CUSTOMER_ID })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('loyalty_transactions')
  })

  it('applies transaction_type filter', async () => {
    authenticatedUser()
    setupMockFrom('loyalty_transactions', { data: [], count: 0 })

    const res = await loyaltyGET(
      makeGetRequest('/api/loyalty-transactions', { transaction_type: 'redeem' })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    authenticatedUser()
    setupMockFrom('loyalty_transactions', {
      data: null,
      error: { message: 'Query timeout' },
      count: 0,
    })

    const res = await loyaltyGET(makeGetRequest('/api/loyalty-transactions'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Query timeout')
  })
})

describe('POST /api/loyalty-transactions', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await loyaltyPOST(
      makePostRequest('/api/loyalty-transactions', {
        points: 100,
        transaction_type: 'earn',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when required fields are missing', async () => {
    authenticatedUser()
    storeExists()

    const res = await loyaltyPOST(
      makePostRequest('/api/loyalty-transactions', { points: 100 })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toMatch(/transaction_type/)
  })

  it('returns 400 when transaction_type is invalid', async () => {
    authenticatedUser()
    storeExists()

    const res = await loyaltyPOST(
      makePostRequest('/api/loyalty-transactions', {
        points: 100,
        transaction_type: 'invalid_type',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('creates a loyalty transaction successfully and returns 201', async () => {
    authenticatedUser()
    const createdTx = {
      id: TEST_TRANSACTION_ID,
      store_id: TEST_STORE_ID,
      customer_id: TEST_CUSTOMER_ID,
      points: 250,
      transaction_type: 'earn',
      reference_type: null,
      reference_id: null,
      description: 'Loyalty earn',
      created_at: '2026-02-01T00:00:00Z',
      customers: { id: TEST_CUSTOMER_ID, name: 'Bat', phone: '99112233' },
    }

    setupMockFrom('loyalty_transactions', { data: createdTx })

    const res = await loyaltyPOST(
      makePostRequest('/api/loyalty-transactions', {
        customer_id: TEST_CUSTOMER_ID,
        points: 250,
        transaction_type: 'earn',
        description: 'Loyalty earn',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.points).toBe(250)
    expect(json.transaction_type).toBe('earn')
    expect(json.store_id).toBe(TEST_STORE_ID)
  })

  it('returns 500 when insert fails', async () => {
    authenticatedUser()
    setupMockFrom('loyalty_transactions', {
      data: null,
      error: { message: 'Foreign key violation' },
    })

    const res = await loyaltyPOST(
      makePostRequest('/api/loyalty-transactions', {
        points: 100,
        transaction_type: 'earn',
      })
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Foreign key violation')
  })
})

// ===========================================================================
// Loyalty Transactions — /api/loyalty-transactions/[id] (GET + PATCH)
// ===========================================================================

describe('GET /api/loyalty-transactions/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await loyaltyDetailGET(
      makeGetRequest(`/api/loyalty-transactions/${TEST_TRANSACTION_ID}`),
      routeContext(TEST_TRANSACTION_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 404 when transaction does not exist', async () => {
    authenticatedUser()
    setupMockFrom('loyalty_transactions', { data: null, error: { message: 'not found' } })

    const res = await loyaltyDetailGET(
      makeGetRequest(`/api/loyalty-transactions/${TEST_TRANSACTION_ID}`),
      routeContext(TEST_TRANSACTION_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Loyalty transaction not found')
  })

  it('returns a single loyalty transaction by id', async () => {
    authenticatedUser()
    const tx = {
      id: TEST_TRANSACTION_ID,
      store_id: TEST_STORE_ID,
      customer_id: TEST_CUSTOMER_ID,
      points: 150,
      transaction_type: 'redeem',
      reference_type: null,
      reference_id: null,
      description: 'Redeemed for discount',
      created_at: '2026-01-25T00:00:00Z',
      customers: { id: TEST_CUSTOMER_ID, name: 'Bat', phone: '99112233' },
    }

    setupMockFrom('loyalty_transactions', { data: tx })

    const res = await loyaltyDetailGET(
      makeGetRequest(`/api/loyalty-transactions/${TEST_TRANSACTION_ID}`),
      routeContext(TEST_TRANSACTION_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe(TEST_TRANSACTION_ID)
    expect(json.points).toBe(150)
    expect(json.transaction_type).toBe('redeem')
  })
})

describe('PATCH /api/loyalty-transactions/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await loyaltyDetailPATCH(
      makePatchRequest(`/api/loyalty-transactions/${TEST_TRANSACTION_ID}`, { points: 200 }),
      routeContext(TEST_TRANSACTION_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('updates a loyalty transaction successfully', async () => {
    authenticatedUser()
    const updatedTx = {
      id: TEST_TRANSACTION_ID,
      store_id: TEST_STORE_ID,
      customer_id: TEST_CUSTOMER_ID,
      points: 300,
      transaction_type: 'adjust',
      reference_type: null,
      reference_id: null,
      description: 'Adjusted points',
      created_at: '2026-01-25T00:00:00Z',
      customers: { id: TEST_CUSTOMER_ID, name: 'Bat', phone: '99112233' },
    }

    setupMockFrom('loyalty_transactions', { data: updatedTx })

    const res = await loyaltyDetailPATCH(
      makePatchRequest(`/api/loyalty-transactions/${TEST_TRANSACTION_ID}`, {
        points: 300,
        transaction_type: 'adjust',
      }),
      routeContext(TEST_TRANSACTION_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.points).toBe(300)
    expect(json.transaction_type).toBe('adjust')
  })

  it('returns 404 when transaction to update does not exist', async () => {
    authenticatedUser()
    setupMockFrom('loyalty_transactions', { data: null, error: null })

    const res = await loyaltyDetailPATCH(
      makePatchRequest(`/api/loyalty-transactions/${TEST_TRANSACTION_ID}`, { points: 999 }),
      routeContext(TEST_TRANSACTION_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Loyalty transaction not found')
  })
})

// ===========================================================================
// Stock Transfers — /api/stock-transfers (GET + POST)
// ===========================================================================

describe('GET /api/stock-transfers', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await stockTransfersGET(makeGetRequest('/api/stock-transfers'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when store is not found', async () => {
    authenticatedUser()
    storeNotFound()

    const res = await stockTransfersGET(makeGetRequest('/api/stock-transfers'))
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('returns a list of stock transfers with total count', async () => {
    authenticatedUser()
    const transfers = [
      {
        id: TEST_TRANSFER_ID,
        store_id: TEST_STORE_ID,
        from_location_id: TEST_LOCATION_A,
        to_location_id: TEST_LOCATION_B,
        status: 'pending',
        initiated_by: TEST_USER_ID,
        notes: 'Warehouse to store',
        created_at: '2026-01-28T00:00:00Z',
        updated_at: '2026-01-28T00:00:00Z',
        transfer_items: [
          { id: 'ti-1', product_id: TEST_PRODUCT_ID, quantity: 10, received_quantity: 0 },
        ],
      },
    ]

    setupMockFrom('stock_transfers', { data: transfers, count: 1 })

    const res = await stockTransfersGET(makeGetRequest('/api/stock-transfers'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual(transfers)
    expect(json.total).toBe(1)
  })

  it('applies status filter when status is valid', async () => {
    authenticatedUser()
    setupMockFrom('stock_transfers', { data: [], count: 0 })

    const res = await stockTransfersGET(
      makeGetRequest('/api/stock-transfers', { status: 'in_transit' })
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('stock_transfers')
  })

  it('returns 500 when database query fails', async () => {
    authenticatedUser()
    setupMockFrom('stock_transfers', {
      data: null,
      error: { message: 'Connection refused' },
      count: 0,
    })

    const res = await stockTransfersGET(makeGetRequest('/api/stock-transfers'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Connection refused')
  })
})

describe('POST /api/stock-transfers', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await stockTransfersPOST(
      makePostRequest('/api/stock-transfers', {
        from_location_id: TEST_LOCATION_A,
        to_location_id: TEST_LOCATION_B,
        items: [{ product_id: TEST_PRODUCT_ID, quantity: 5 }],
      })
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when items array is empty', async () => {
    authenticatedUser()
    storeExists()

    const res = await stockTransfersPOST(
      makePostRequest('/api/stock-transfers', { items: [] })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
    expect(json.error).toMatch(/item/i)
  })

  it('returns 400 when items field is missing', async () => {
    authenticatedUser()
    storeExists()

    const res = await stockTransfersPOST(
      makePostRequest('/api/stock-transfers', {
        from_location_id: TEST_LOCATION_A,
      })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBeDefined()
  })

  it('creates a stock transfer successfully and returns 201', async () => {
    authenticatedUser()
    const createdTransfer = {
      id: TEST_TRANSFER_ID,
      store_id: TEST_STORE_ID,
      from_location_id: TEST_LOCATION_A,
      to_location_id: TEST_LOCATION_B,
      status: 'pending',
      initiated_by: TEST_USER_ID,
      notes: null,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    }

    const finalResult = {
      ...createdTransfer,
      transfer_items: [
        { id: 'ti-1', product_id: TEST_PRODUCT_ID, quantity: 5, received_quantity: 0 },
      ],
    }

    setupMockFromMulti({
      stock_transfers: { data: createdTransfer },
      transfer_items: { data: null, error: null },
    })

    // The route makes 3 calls to stock_transfers (insert, then re-fetch) and 1 to transfer_items.
    // We need to handle the re-fetch returning the final result.
    // Since our proxy returns the same value for any table match, we use the multi setup.
    // The first call gets createdTransfer (for insert+select+single), the re-fetch also
    // gets the same shape, which is acceptable.

    const res = await stockTransfersPOST(
      makePostRequest('/api/stock-transfers', {
        from_location_id: TEST_LOCATION_A,
        to_location_id: TEST_LOCATION_B,
        initiated_by: TEST_USER_ID,
        items: [{ product_id: TEST_PRODUCT_ID, quantity: 5 }],
      })
    )
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.store_id).toBe(TEST_STORE_ID)
    expect(json.from_location_id).toBe(TEST_LOCATION_A)
    expect(json.to_location_id).toBe(TEST_LOCATION_B)
  })

  it('returns 500 when transfer insert fails', async () => {
    authenticatedUser()
    setupMockFromMulti({
      stock_transfers: { data: null, error: { message: 'Insert failed' } },
      transfer_items: { data: null, error: null },
    })

    const res = await stockTransfersPOST(
      makePostRequest('/api/stock-transfers', {
        items: [{ product_id: TEST_PRODUCT_ID, quantity: 5 }],
      })
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Insert failed')
  })

  it('returns 500 when transfer items insert fails', async () => {
    authenticatedUser()
    const createdTransfer = {
      id: TEST_TRANSFER_ID,
      store_id: TEST_STORE_ID,
      from_location_id: null,
      to_location_id: null,
      status: 'pending',
      initiated_by: null,
      notes: null,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    }

    setupMockFromMulti({
      stock_transfers: { data: createdTransfer },
      transfer_items: { data: null, error: { message: 'Items insert failed' } },
    })

    const res = await stockTransfersPOST(
      makePostRequest('/api/stock-transfers', {
        items: [{ product_id: TEST_PRODUCT_ID, quantity: 3 }],
      })
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Items insert failed')
  })
})

// ===========================================================================
// Stock Transfers — /api/stock-transfers/[id] (GET + PATCH)
// ===========================================================================

describe('GET /api/stock-transfers/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await stockTransferDetailGET(
      makeGetRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 404 when stock transfer does not exist', async () => {
    authenticatedUser()
    setupMockFrom('stock_transfers', { data: null, error: { message: 'not found' } })

    const res = await stockTransferDetailGET(
      makeGetRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Stock transfer not found')
  })

  it('returns a single stock transfer by id with transfer items', async () => {
    authenticatedUser()
    const transfer = {
      id: TEST_TRANSFER_ID,
      store_id: TEST_STORE_ID,
      from_location_id: TEST_LOCATION_A,
      to_location_id: TEST_LOCATION_B,
      status: 'in_transit',
      initiated_by: TEST_USER_ID,
      notes: 'Urgent restock',
      created_at: '2026-01-28T00:00:00Z',
      updated_at: '2026-01-29T00:00:00Z',
      transfer_items: [
        { id: 'ti-1', product_id: TEST_PRODUCT_ID, quantity: 20, received_quantity: 0 },
      ],
    }

    setupMockFrom('stock_transfers', { data: transfer })

    const res = await stockTransferDetailGET(
      makeGetRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe(TEST_TRANSFER_ID)
    expect(json.status).toBe('in_transit')
    expect(json.transfer_items).toHaveLength(1)
    expect(json.transfer_items[0].quantity).toBe(20)
  })
})

describe('PATCH /api/stock-transfers/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    unauthenticatedUser()

    const res = await stockTransferDetailPATCH(
      makePatchRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`, { status: 'received' }),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 403 when store is not found', async () => {
    authenticatedUser()
    storeNotFound()

    const res = await stockTransferDetailPATCH(
      makePatchRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`, { status: 'received' }),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error).toBe('Store not found')
  })

  it('updates a stock transfer status successfully', async () => {
    authenticatedUser()
    const updatedTransfer = {
      id: TEST_TRANSFER_ID,
      store_id: TEST_STORE_ID,
      from_location_id: TEST_LOCATION_A,
      to_location_id: TEST_LOCATION_B,
      status: 'received',
      initiated_by: TEST_USER_ID,
      notes: 'Received all items',
      created_at: '2026-01-28T00:00:00Z',
      updated_at: '2026-02-01T12:00:00Z',
      transfer_items: [
        { id: 'ti-1', product_id: TEST_PRODUCT_ID, quantity: 20, received_quantity: 20 },
      ],
    }

    setupMockFrom('stock_transfers', { data: updatedTransfer })

    const res = await stockTransferDetailPATCH(
      makePatchRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`, {
        status: 'received',
        notes: 'Received all items',
      }),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('received')
    expect(json.notes).toBe('Received all items')
  })

  it('returns 404 when stock transfer to update does not exist', async () => {
    authenticatedUser()
    setupMockFrom('stock_transfers', { data: null, error: null })

    const res = await stockTransferDetailPATCH(
      makePatchRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`, { status: 'cancelled' }),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('Stock transfer not found')
  })

  it('returns 500 when update encounters a database error', async () => {
    authenticatedUser()
    setupMockFrom('stock_transfers', {
      data: null,
      error: { message: 'Deadlock detected' },
    })

    const res = await stockTransferDetailPATCH(
      makePatchRequest(`/api/stock-transfers/${TEST_TRANSFER_ID}`, { status: 'in_transit' }),
      routeContext(TEST_TRANSFER_ID)
    )
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Deadlock detected')
  })
})
