import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, recordBillingPaymentSchema, parsePagination } from '@/lib/validations'
import { recordPayment } from '@/lib/billing'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoice_id')
  const status = searchParams.get('status')
  const method = searchParams.get('method')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('billing_payments')
    .select(`
      id, invoice_id, payment_number, amount, method, status,
      gateway_ref, paid_at, notes, created_at,
      invoices(id, invoice_number, total_amount, status)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (invoiceId) {
    query = query.eq('invoice_id', invoiceId)
  }
  const validStatuses = ['pending', 'completed', 'failed', 'refunded', 'cancelled'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }
  const validMethods = ['cash', 'bank', 'qpay', 'card', 'online', 'credit'] as const
  if (method && validMethods.includes(method as typeof validMethods[number])) {
    query = query.eq('method', method as typeof validMethods[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, recordBillingPaymentSchema)
  if (validationError) return validationError

  // Verify invoice belongs to store if provided
  if (body.invoice_id) {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', body.invoice_id)
      .eq('store_id', store.id)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
  }

  const { payment, error } = await recordPayment(supabase, {
    storeId: store.id,
    invoiceId: body.invoice_id || undefined,
    amount: body.amount,
    method: body.method,
    gatewayRef: body.gateway_ref || undefined,
    notes: body.notes || undefined,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json(payment, { status: 201 })
}
