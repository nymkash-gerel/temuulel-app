/**
 * Billing utility functions.
 * Handles invoice creation, payment recording, and number generation.
 */
import { SupabaseClient } from '@supabase/supabase-js'

interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  discount?: number
  tax_rate?: number
  item_type?: 'product' | 'service' | 'fee' | 'discount' | 'tax' | 'custom'
  item_id?: string | null
}

interface CreateInvoiceParams {
  storeId: string
  partyType: 'customer' | 'supplier' | 'staff' | 'driver'
  partyId?: string
  sourceType?: 'order' | 'appointment' | 'reservation' | 'manual' | 'subscription'
  sourceId?: string
  items: InvoiceLineItem[]
  dueDate?: string
  notes?: string
  taxRate?: number
  discountAmount?: number
}

interface RecordPaymentParams {
  storeId: string
  invoiceId?: string
  amount: number
  method: 'cash' | 'bank' | 'qpay' | 'card' | 'online' | 'credit'
  gatewayRef?: string
  gatewayResponse?: Record<string, unknown>
  notes?: string
}

/**
 * Generate a unique invoice number.
 * Format: INV-{YYYYMMDD}-{random}
 */
export function generateInvoiceNumber(): string {
  const date = new Date()
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `INV-${y}${m}${d}-${rand}`
}

/**
 * Generate a unique payment number.
 * Format: PAY-{timestamp}
 */
export function generatePaymentNumber(): string {
  return `PAY-${Date.now()}`
}

/**
 * Calculate line total for an invoice item.
 */
export function calculateLineTotal(item: InvoiceLineItem): number {
  const subtotal = item.quantity * item.unit_price
  const discount = item.discount || 0
  const taxRate = item.tax_rate || 0
  const afterDiscount = subtotal - discount
  const tax = afterDiscount * (taxRate / 100)
  return Math.round((afterDiscount + tax) * 100) / 100
}

/**
 * Create an invoice with line items.
 */
export async function createInvoice(
  supabase: SupabaseClient,
  params: CreateInvoiceParams,
): Promise<{ invoice: Record<string, unknown> | null; error: string | null }> {
  const invoiceNumber = generateInvoiceNumber()

  // Calculate totals
  let subtotal = 0
  const lineItems = params.items.map((item, index) => {
    const lineTotal = calculateLineTotal(item)
    subtotal += item.quantity * item.unit_price
    return {
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      tax_rate: item.tax_rate || 0,
      line_total: lineTotal,
      item_type: item.item_type || 'custom',
      item_id: item.item_id || null,
      sort_order: index,
    }
  })

  const discountAmount = params.discountAmount || 0
  const taxAmount = params.taxRate
    ? Math.round((subtotal - discountAmount) * (params.taxRate / 100) * 100) / 100
    : lineItems.reduce((sum, item) => {
        const afterDiscount = item.quantity * item.unit_price - item.discount
        return sum + afterDiscount * (item.tax_rate / 100)
      }, 0)
  const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100

  // Insert invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      store_id: params.storeId,
      invoice_number: invoiceNumber,
      party_type: params.partyType,
      party_id: params.partyId || null,
      source_type: params.sourceType || 'manual',
      source_id: params.sourceId || null,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      amount_due: totalAmount,
      due_date: params.dueDate || null,
      notes: params.notes || null,
      status: 'draft',
    })
    .select('*')
    .single()

  if (invoiceError) {
    return { invoice: null, error: invoiceError.message }
  }

  // Insert line items
  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(
        lineItems.map(item => ({
          invoice_id: invoice.id,
          ...item,
        })),
      )

    if (itemsError) {
      return { invoice: null, error: itemsError.message }
    }
  }

  return { invoice, error: null }
}

/**
 * Record a payment and update the related invoice.
 */
export async function recordPayment(
  supabase: SupabaseClient,
  params: RecordPaymentParams,
): Promise<{ payment: Record<string, unknown> | null; error: string | null }> {
  const paymentNumber = generatePaymentNumber()

  const { data: payment, error: paymentError } = await supabase
    .from('billing_payments')
    .insert({
      store_id: params.storeId,
      invoice_id: params.invoiceId || null,
      payment_number: paymentNumber,
      amount: params.amount,
      method: params.method,
      status: 'completed',
      gateway_ref: params.gatewayRef || null,
      gateway_response: params.gatewayResponse || {},
      notes: params.notes || null,
    })
    .select('*')
    .single()

  if (paymentError) {
    return { payment: null, error: paymentError.message }
  }

  // If linked to an invoice, create allocation and update invoice
  if (params.invoiceId) {
    await supabase.from('payment_allocations').insert({
      payment_id: payment.id,
      invoice_id: params.invoiceId,
      amount: params.amount,
    })

    // Fetch current invoice to update amounts
    const { data: invoice } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid')
      .eq('id', params.invoiceId)
      .single()

    if (invoice) {
      const newAmountPaid = (invoice.amount_paid || 0) + params.amount
      const newAmountDue = Math.max(0, (invoice.total_amount || 0) - newAmountPaid)
      const newStatus = newAmountDue <= 0 ? 'paid' : 'partial'

      await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
        })
        .eq('id', params.invoiceId)
    }
  }

  return { payment, error: null }
}
