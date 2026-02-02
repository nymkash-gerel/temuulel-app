/**
 * Tests for billing utilities: invoice creation, payment recording, number generation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateInvoiceNumber,
  generatePaymentNumber,
  calculateLineTotal,
  createInvoice,
  recordPayment,
} from './billing'

// ---------------------------------------------------------------------------
// Helper: build a mock Supabase client with chainable methods
// ---------------------------------------------------------------------------

interface MockSupabaseOverrides {
  invoiceInsert?: { data: Record<string, unknown> | null; error: { message: string } | null }
  itemsInsert?: { error: { message: string } | null }
  paymentInsert?: { data: Record<string, unknown> | null; error: { message: string } | null }
  allocationInsert?: { error: { message: string } | null }
  invoiceSelect?: { data: Record<string, unknown> | null }
  invoiceUpdate?: { error: { message: string } | null }
}

function createMockSupabase(overrides: MockSupabaseOverrides = {}) {
  const insertCalls: { table: string; data: unknown }[] = []
  const updateCalls: { table: string; data: unknown; eqField?: string; eqValue?: unknown }[] = []

  const invoiceInsertResult = overrides.invoiceInsert ?? {
    data: {
      id: 'inv_1',
      store_id: 'store_1',
      invoice_number: 'INV-20260201-ABC12',
      status: 'draft',
      total_amount: 100,
    },
    error: null,
  }
  const itemsInsertResult = overrides.itemsInsert ?? { error: null }
  const paymentInsertResult = overrides.paymentInsert ?? {
    data: {
      id: 'pay_1',
      store_id: 'store_1',
      payment_number: 'PAY-1234567890',
      amount: 5000,
      method: 'cash',
      status: 'completed',
    },
    error: null,
  }
  const allocationInsertResult = overrides.allocationInsert ?? { error: null }
  const invoiceSelectResult = overrides.invoiceSelect ?? {
    data: { total_amount: 10000, amount_paid: 0 },
  }
  const invoiceUpdateResult = overrides.invoiceUpdate ?? { error: null }

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'invoices') {
        return {
          insert: vi.fn((data: unknown) => {
            insertCalls.push({ table: 'invoices', data })
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue(invoiceInsertResult),
              })),
            }
          }),
          select: vi.fn(() => ({
            eq: vi.fn((_field: string, _value: unknown) => ({
              single: vi.fn().mockResolvedValue(invoiceSelectResult),
            })),
          })),
          update: vi.fn((data: unknown) => ({
            eq: vi.fn((field: string, value: unknown) => {
              updateCalls.push({ table: 'invoices', data, eqField: field, eqValue: value })
              return Promise.resolve(invoiceUpdateResult)
            }),
          })),
        }
      }
      if (table === 'invoice_items') {
        return {
          insert: vi.fn((data: unknown) => {
            insertCalls.push({ table: 'invoice_items', data })
            return Promise.resolve(itemsInsertResult)
          }),
        }
      }
      if (table === 'billing_payments') {
        return {
          insert: vi.fn((data: unknown) => {
            insertCalls.push({ table: 'billing_payments', data })
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue(paymentInsertResult),
              })),
            }
          }),
        }
      }
      if (table === 'payment_allocations') {
        return {
          insert: vi.fn((data: unknown) => {
            insertCalls.push({ table: 'payment_allocations', data })
            return Promise.resolve(allocationInsertResult)
          }),
        }
      }
      return {}
    }),
  }

   
  return { client: client as any, insertCalls, updateCalls }
}

// ===========================================================================
// generateInvoiceNumber
// ===========================================================================

describe('generateInvoiceNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a string starting with "INV-"', () => {
    const num = generateInvoiceNumber()
    expect(num).toMatch(/^INV-/)
  })

  it('contains a date segment in YYYYMMDD format', () => {
    const num = generateInvoiceNumber()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    expect(num).toContain(`${y}${m}${d}`)
  })

  it('matches the full format INV-YYYYMMDD-XXXXX', () => {
    const num = generateInvoiceNumber()
    expect(num).toMatch(/^INV-\d{8}-[A-Z0-9]{1,5}$/)
  })

  it('returns unique values on consecutive calls', () => {
    const results = new Set<string>()
    for (let i = 0; i < 50; i++) {
      results.add(generateInvoiceNumber())
    }
    // With 5-char random suffix, 50 calls should all be unique
    expect(results.size).toBe(50)
  })
})

// ===========================================================================
// generatePaymentNumber
// ===========================================================================

describe('generatePaymentNumber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a string starting with "PAY-"', () => {
    const num = generatePaymentNumber()
    expect(num).toMatch(/^PAY-/)
  })

  it('contains a numeric timestamp after the prefix', () => {
    const num = generatePaymentNumber()
    const suffix = num.replace('PAY-', '')
    expect(Number(suffix)).not.toBeNaN()
    // Timestamp should be a reasonable value (after 2024-01-01)
    expect(Number(suffix)).toBeGreaterThan(1704067200000)
  })

  it('matches the full format PAY-{digits}', () => {
    const num = generatePaymentNumber()
    expect(num).toMatch(/^PAY-\d+$/)
  })
})

// ===========================================================================
// calculateLineTotal
// ===========================================================================

describe('calculateLineTotal', () => {
  it('calculates basic line total (quantity * unit_price)', () => {
    const result = calculateLineTotal({
      description: 'Widget',
      quantity: 3,
      unit_price: 1000,
    })
    expect(result).toBe(3000)
  })

  it('applies discount correctly', () => {
    // subtotal = 2 * 500 = 1000, discount = 200, afterDiscount = 800, no tax
    const result = calculateLineTotal({
      description: 'Widget',
      quantity: 2,
      unit_price: 500,
      discount: 200,
    })
    expect(result).toBe(800)
  })

  it('applies tax rate correctly', () => {
    // subtotal = 1 * 1000 = 1000, no discount, tax = 1000 * 10% = 100
    const result = calculateLineTotal({
      description: 'Service',
      quantity: 1,
      unit_price: 1000,
      tax_rate: 10,
    })
    expect(result).toBe(1100)
  })

  it('applies both discount and tax', () => {
    // subtotal = 4 * 2500 = 10000, discount = 1000, afterDiscount = 9000
    // tax = 9000 * 10% = 900, total = 9900
    const result = calculateLineTotal({
      description: 'Product',
      quantity: 4,
      unit_price: 2500,
      discount: 1000,
      tax_rate: 10,
    })
    expect(result).toBe(9900)
  })

  it('rounds to 2 decimal places', () => {
    // subtotal = 3 * 33.33 = 99.99, discount = 0, tax = 99.99 * 7% = 6.9993
    // total = 106.9893 -> rounded to 106.99
    const result = calculateLineTotal({
      description: 'Fractional',
      quantity: 3,
      unit_price: 33.33,
      tax_rate: 7,
    })
    expect(result).toBe(106.99)
  })

  it('handles zero quantity', () => {
    const result = calculateLineTotal({
      description: 'Nothing',
      quantity: 0,
      unit_price: 5000,
    })
    expect(result).toBe(0)
  })

  it('handles zero unit_price', () => {
    const result = calculateLineTotal({
      description: 'Free item',
      quantity: 5,
      unit_price: 0,
    })
    expect(result).toBe(0)
  })

  it('handles discount equal to subtotal', () => {
    // subtotal = 2 * 500 = 1000, discount = 1000, afterDiscount = 0
    const result = calculateLineTotal({
      description: 'Free',
      quantity: 2,
      unit_price: 500,
      discount: 1000,
    })
    expect(result).toBe(0)
  })
})

// ===========================================================================
// createInvoice
// ===========================================================================

describe('createInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an invoice with line items and returns the invoice', async () => {
    const mock = createMockSupabase()

    const result = await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'customer',
      partyId: 'cust_1',
      items: [
        { description: 'Widget A', quantity: 2, unit_price: 1500 },
        { description: 'Widget B', quantity: 1, unit_price: 3000 },
      ],
    })

    expect(result.error).toBeNull()
    expect(result.invoice).not.toBeNull()
    expect(result.invoice!.id).toBe('inv_1')

    // Verify invoices insert was called
    const invoicesInsert = mock.insertCalls.find(c => c.table === 'invoices')
    expect(invoicesInsert).toBeDefined()

    // Verify invoice_items insert was called
    const itemsInsert = mock.insertCalls.find(c => c.table === 'invoice_items')
    expect(itemsInsert).toBeDefined()
    const items = itemsInsert!.data as unknown[]
    expect(items).toHaveLength(2)
  })

  it('handles invoice insert error', async () => {
    const mock = createMockSupabase({
      invoiceInsert: {
        data: null,
        error: { message: 'Database connection failed' },
      },
    })

    const result = await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'customer',
      items: [{ description: 'Item', quantity: 1, unit_price: 1000 }],
    })

    expect(result.invoice).toBeNull()
    expect(result.error).toBe('Database connection failed')

    // Should NOT try to insert line items when invoice creation fails
    const itemsInsert = mock.insertCalls.find(c => c.table === 'invoice_items')
    expect(itemsInsert).toBeUndefined()
  })

  it('handles items insert error', async () => {
    const mock = createMockSupabase({
      itemsInsert: { error: { message: 'Items insert failed' } },
    })

    const result = await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'supplier',
      items: [{ description: 'Part', quantity: 10, unit_price: 250 }],
    })

    expect(result.invoice).toBeNull()
    expect(result.error).toBe('Items insert failed')
  })

  it('calculates correct totals for line items', async () => {
    const mock = createMockSupabase()

    await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'customer',
      items: [
        { description: 'A', quantity: 2, unit_price: 1000, discount: 100, tax_rate: 10 },
        { description: 'B', quantity: 3, unit_price: 500 },
      ],
    })

    const invoicesInsert = mock.insertCalls.find(c => c.table === 'invoices')
    expect(invoicesInsert).toBeDefined()
    const invoiceData = invoicesInsert!.data as Record<string, unknown>

    // subtotal = (2*1000) + (3*500) = 2000 + 1500 = 3500
    expect(invoiceData.subtotal).toBe(3500)

    // No global taxRate or discountAmount, so tax is calculated per line item:
    // Item A: afterDiscount = 2*1000 - 100 = 1900, tax = 1900 * 10/100 = 190
    // Item B: afterDiscount = 3*500 - 0 = 1500, tax = 1500 * 0/100 = 0
    // Total tax = 190
    expect(invoiceData.tax_amount).toBe(190)

    // total_amount = subtotal - discountAmount + taxAmount = 3500 - 0 + 190 = 3690
    expect(invoiceData.total_amount).toBe(3690)
    expect(invoiceData.amount_due).toBe(3690)
    expect(invoiceData.discount_amount).toBe(0)
    expect(invoiceData.status).toBe('draft')
  })

  it('calculates correct totals with global taxRate and discountAmount', async () => {
    const mock = createMockSupabase()

    await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'customer',
      items: [
        { description: 'A', quantity: 1, unit_price: 10000 },
      ],
      taxRate: 10,
      discountAmount: 2000,
    })

    const invoicesInsert = mock.insertCalls.find(c => c.table === 'invoices')
    const invoiceData = invoicesInsert!.data as Record<string, unknown>

    // subtotal = 10000
    expect(invoiceData.subtotal).toBe(10000)
    expect(invoiceData.discount_amount).toBe(2000)
    // taxAmount = (10000 - 2000) * 10/100 = 800
    expect(invoiceData.tax_amount).toBe(800)
    // totalAmount = 10000 - 2000 + 800 = 8800
    expect(invoiceData.total_amount).toBe(8800)
    expect(invoiceData.amount_due).toBe(8800)
  })

  it('passes optional fields correctly', async () => {
    const mock = createMockSupabase()

    await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'driver',
      partyId: 'driver_1',
      sourceType: 'order',
      sourceId: 'order_1',
      dueDate: '2026-03-01',
      notes: 'Test invoice notes',
      items: [{ description: 'Fee', quantity: 1, unit_price: 500 }],
    })

    const invoicesInsert = mock.insertCalls.find(c => c.table === 'invoices')
    const invoiceData = invoicesInsert!.data as Record<string, unknown>

    expect(invoiceData.store_id).toBe('store_1')
    expect(invoiceData.party_type).toBe('driver')
    expect(invoiceData.party_id).toBe('driver_1')
    expect(invoiceData.source_type).toBe('order')
    expect(invoiceData.source_id).toBe('order_1')
    expect(invoiceData.due_date).toBe('2026-03-01')
    expect(invoiceData.notes).toBe('Test invoice notes')
  })

  it('defaults optional fields to null or expected values', async () => {
    const mock = createMockSupabase()

    await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'customer',
      items: [{ description: 'Item', quantity: 1, unit_price: 100 }],
    })

    const invoicesInsert = mock.insertCalls.find(c => c.table === 'invoices')
    const invoiceData = invoicesInsert!.data as Record<string, unknown>

    expect(invoiceData.party_id).toBeNull()
    expect(invoiceData.source_type).toBe('manual')
    expect(invoiceData.source_id).toBeNull()
    expect(invoiceData.due_date).toBeNull()
    expect(invoiceData.notes).toBeNull()
  })

  it('sets correct item_type, item_id, and sort_order on line items', async () => {
    const mock = createMockSupabase()

    await createInvoice(mock.client, {
      storeId: 'store_1',
      partyType: 'customer',
      items: [
        { description: 'Product', quantity: 1, unit_price: 100, item_type: 'product', item_id: 'prod_1' },
        { description: 'Custom', quantity: 2, unit_price: 50 },
      ],
    })

    const itemsInsert = mock.insertCalls.find(c => c.table === 'invoice_items')
    const items = itemsInsert!.data as Record<string, unknown>[]

    expect(items[0].item_type).toBe('product')
    expect(items[0].item_id).toBe('prod_1')
    expect(items[0].sort_order).toBe(0)
    expect(items[0].invoice_id).toBe('inv_1')

    expect(items[1].item_type).toBe('custom')
    expect(items[1].item_id).toBeNull()
    expect(items[1].sort_order).toBe(1)
    expect(items[1].invoice_id).toBe('inv_1')
  })
})

// ===========================================================================
// recordPayment
// ===========================================================================

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records a payment without an invoice', async () => {
    const mock = createMockSupabase()

    const result = await recordPayment(mock.client, {
      storeId: 'store_1',
      amount: 5000,
      method: 'cash',
      notes: 'Walk-in payment',
    })

    expect(result.error).toBeNull()
    expect(result.payment).not.toBeNull()
    expect(result.payment!.id).toBe('pay_1')

    // Verify billing_payments insert was called
    const paymentInsert = mock.insertCalls.find(c => c.table === 'billing_payments')
    expect(paymentInsert).toBeDefined()
    const paymentData = paymentInsert!.data as Record<string, unknown>
    expect(paymentData.store_id).toBe('store_1')
    expect(paymentData.amount).toBe(5000)
    expect(paymentData.method).toBe('cash')
    expect(paymentData.invoice_id).toBeNull()
    expect(paymentData.status).toBe('completed')
    expect(paymentData.notes).toBe('Walk-in payment')

    // Should NOT create payment allocation or update invoice
    const allocationInsert = mock.insertCalls.find(c => c.table === 'payment_allocations')
    expect(allocationInsert).toBeUndefined()
  })

  it('records a payment linked to an invoice, creates allocation, and updates invoice', async () => {
    const mock = createMockSupabase({
      invoiceSelect: {
        data: { total_amount: 10000, amount_paid: 0 },
      },
    })

    const result = await recordPayment(mock.client, {
      storeId: 'store_1',
      invoiceId: 'inv_1',
      amount: 5000,
      method: 'qpay',
      gatewayRef: 'qpay_ref_123',
      gatewayResponse: { status: 'success' },
    })

    expect(result.error).toBeNull()
    expect(result.payment).not.toBeNull()

    // Verify billing_payments insert
    const paymentInsert = mock.insertCalls.find(c => c.table === 'billing_payments')
    expect(paymentInsert).toBeDefined()
    const paymentData = paymentInsert!.data as Record<string, unknown>
    expect(paymentData.invoice_id).toBe('inv_1')
    expect(paymentData.gateway_ref).toBe('qpay_ref_123')
    expect(paymentData.gateway_response).toEqual({ status: 'success' })

    // Verify payment_allocations insert
    const allocationInsert = mock.insertCalls.find(c => c.table === 'payment_allocations')
    expect(allocationInsert).toBeDefined()
    const allocData = allocationInsert!.data as Record<string, unknown>
    expect(allocData.payment_id).toBe('pay_1')
    expect(allocData.invoice_id).toBe('inv_1')
    expect(allocData.amount).toBe(5000)

    // Verify invoice update: partial payment (5000 of 10000)
    expect(mock.updateCalls).toHaveLength(1)
    const updateData = mock.updateCalls[0].data as Record<string, unknown>
    expect(updateData.amount_paid).toBe(5000)
    expect(updateData.amount_due).toBe(5000)
    expect(updateData.status).toBe('partial')
    expect(mock.updateCalls[0].eqValue).toBe('inv_1')
  })

  it('marks invoice as paid when full amount is recorded', async () => {
    const mock = createMockSupabase({
      invoiceSelect: {
        data: { total_amount: 5000, amount_paid: 0 },
      },
    })

    await recordPayment(mock.client, {
      storeId: 'store_1',
      invoiceId: 'inv_1',
      amount: 5000,
      method: 'bank',
    })

    expect(mock.updateCalls).toHaveLength(1)
    const updateData = mock.updateCalls[0].data as Record<string, unknown>
    expect(updateData.amount_paid).toBe(5000)
    expect(updateData.amount_due).toBe(0)
    expect(updateData.status).toBe('paid')
  })

  it('marks invoice as paid when overpayment occurs (amount_due clamped to 0)', async () => {
    const mock = createMockSupabase({
      invoiceSelect: {
        data: { total_amount: 3000, amount_paid: 0 },
      },
    })

    await recordPayment(mock.client, {
      storeId: 'store_1',
      invoiceId: 'inv_1',
      amount: 5000,
      method: 'cash',
    })

    expect(mock.updateCalls).toHaveLength(1)
    const updateData = mock.updateCalls[0].data as Record<string, unknown>
    expect(updateData.amount_paid).toBe(5000)
    expect(updateData.amount_due).toBe(0) // clamped via Math.max(0, ...)
    expect(updateData.status).toBe('paid')
  })

  it('accumulates amount_paid for subsequent payments', async () => {
    const mock = createMockSupabase({
      invoiceSelect: {
        data: { total_amount: 10000, amount_paid: 4000 },
      },
    })

    await recordPayment(mock.client, {
      storeId: 'store_1',
      invoiceId: 'inv_1',
      amount: 3000,
      method: 'card',
    })

    expect(mock.updateCalls).toHaveLength(1)
    const updateData = mock.updateCalls[0].data as Record<string, unknown>
    // newAmountPaid = 4000 + 3000 = 7000
    expect(updateData.amount_paid).toBe(7000)
    // newAmountDue = 10000 - 7000 = 3000
    expect(updateData.amount_due).toBe(3000)
    expect(updateData.status).toBe('partial')
  })

  it('handles payment insert error', async () => {
    const mock = createMockSupabase({
      paymentInsert: {
        data: null,
        error: { message: 'Payment processing failed' },
      },
    })

    const result = await recordPayment(mock.client, {
      storeId: 'store_1',
      amount: 5000,
      method: 'cash',
    })

    expect(result.payment).toBeNull()
    expect(result.error).toBe('Payment processing failed')

    // Should NOT create allocation or update invoice
    const allocationInsert = mock.insertCalls.find(c => c.table === 'payment_allocations')
    expect(allocationInsert).toBeUndefined()
    expect(mock.updateCalls).toHaveLength(0)
  })

  it('defaults optional fields when not provided', async () => {
    const mock = createMockSupabase()

    await recordPayment(mock.client, {
      storeId: 'store_1',
      amount: 1000,
      method: 'online',
    })

    const paymentInsert = mock.insertCalls.find(c => c.table === 'billing_payments')
    const paymentData = paymentInsert!.data as Record<string, unknown>
    expect(paymentData.invoice_id).toBeNull()
    expect(paymentData.gateway_ref).toBeNull()
    expect(paymentData.gateway_response).toEqual({})
    expect(paymentData.notes).toBeNull()
  })
})
