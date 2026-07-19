import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock factories are hoisted; shared spies must come from vi.hoisted.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    decrementStockAndNotify: vi.fn(),
    dispatchNotification: vi.fn(),
    checkQPayPayment: vi.fn(),
    isQPayConfigured: vi.fn(() => true),
    validateBody: vi.fn(),
    getSupabase: vi.fn(),
  },
}))

vi.mock('@/lib/stock', () => ({ decrementStockAndNotify: mocks.decrementStockAndNotify }))
vi.mock('@/lib/notifications', () => ({ dispatchNotification: mocks.dispatchNotification }))
vi.mock('@/lib/qpay', () => ({
  checkQPayPayment: mocks.checkQPayPayment,
  isQPayConfigured: mocks.isQPayConfigured,
}))
vi.mock('@/lib/validations', () => ({
  validateBody: mocks.validateBody,
  checkPaymentSchema: {},
  updatePaymentStatusSchema: {},
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabase: () => mocks.getSupabase() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn(() => 'ip'),
}))

import { POST } from './route'

const ORDER = {
  id: 'ord-1',
  store_id: 'store-A',
  order_number: 'ORD-001',
  payment_method: 'qpay',
  payment_status: 'pending',
  notes: JSON.stringify({ qpay_invoice_id: 'inv-1' }),
  total_amount: 50000,
}

// Supabase mock: the first `.from('orders')...single()` (select) returns the order;
// the second (which calls .update()) returns the optimistic-lock result.
function makeSupabase(order: unknown, lockResult: unknown) {
  const from = vi.fn(() => {
    let isUpdate = false
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.select = vi.fn(chain)
    b.update = vi.fn(() => { isUpdate = true; return b })
    b.eq = vi.fn(chain)
    b.neq = vi.fn(chain)
    b.single = vi.fn(() => Promise.resolve(isUpdate ? lockResult : order))
    return b
  })
  return { from }
}

const req = {} as unknown as import('next/server').NextRequest

describe('POST /api/payments/check — optimistic lock (HIGH #6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isQPayConfigured.mockReturnValue(true)
    mocks.validateBody.mockResolvedValue({ data: { order_id: 'ord-1' }, error: null })
    mocks.checkQPayPayment.mockResolvedValue({
      count: 1,
      paid_amount: 50000,
      rows: [{ payment_id: 'pay-1', payment_date: '2026-01-01' }],
    })
  })

  it('decrements stock and notifies exactly once when the lock is won', async () => {
    // Update matches the still-pending row → returns the updated id.
    mocks.getSupabase.mockReturnValue(
      makeSupabase({ data: ORDER, error: null }, { data: { id: 'ord-1' }, error: null })
    )

    const res = await POST(req)
    const json = await res.json()

    expect(json.status).toBe('paid')
    expect(mocks.decrementStockAndNotify).toHaveBeenCalledTimes(1)
    expect(mocks.dispatchNotification).toHaveBeenCalledTimes(1)
  })

  it('does NOT decrement stock or notify when the lock is lost (concurrent processing)', async () => {
    // A concurrent callback already flipped payment_status to 'paid', so the
    // `.neq('payment_status','paid')` update matches no row.
    mocks.getSupabase.mockReturnValue(
      makeSupabase({ data: ORDER, error: null }, { data: null, error: { code: 'PGRST116' } })
    )

    const res = await POST(req)
    const json = await res.json()

    expect(json.status).toBe('paid') // still reports paid to the caller
    expect(mocks.decrementStockAndNotify).not.toHaveBeenCalled()
    expect(mocks.dispatchNotification).not.toHaveBeenCalled()
  })

  it('short-circuits an already-paid order without calling QPay', async () => {
    mocks.getSupabase.mockReturnValue(
      makeSupabase({ data: { ...ORDER, payment_status: 'paid' }, error: null }, { data: null, error: null })
    )

    const res = await POST(req)
    const json = await res.json()

    expect(json.status).toBe('paid')
    expect(mocks.checkQPayPayment).not.toHaveBeenCalled()
    expect(mocks.decrementStockAndNotify).not.toHaveBeenCalled()
  })
})
