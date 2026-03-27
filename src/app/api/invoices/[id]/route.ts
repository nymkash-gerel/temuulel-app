import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateInvoiceSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
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

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, store_id, party_id, party_type, source_id, source_type, status, subtotal, discount_amount, tax_amount, total_amount, amount_paid, amount_due, currency, issued_at, due_date, notes, metadata, created_at, updated_at')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Fetch line items
  const { data: items } = await supabase
    .from('invoice_items')
    .select('id, invoice_id, description, quantity, unit_price, discount, tax_rate, line_total, item_id, item_type, sort_order')
    .eq('invoice_id', id)
    .order('sort_order', { ascending: true })

  // Fetch payments
  const { data: payments } = await supabase
    .from('billing_payments')
    .select('id, payment_number, amount, method, status, paid_at')
    .eq('invoice_id', id)
    .order('paid_at', { ascending: false })

  return NextResponse.json({ ...invoice, items: items || [], payments: payments || [] })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
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

  const { data: body, error: validationError } = await validateBody(request, updateInvoiceSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) updateData.status = body.status
  if (body.due_date !== undefined) updateData.due_date = body.due_date
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.metadata !== undefined) updateData.metadata = body.metadata

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select('id, invoice_number, store_id, party_id, party_type, source_id, source_type, status, subtotal, discount_amount, tax_amount, total_amount, amount_paid, amount_due, currency, issued_at, due_date, notes, metadata, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  return NextResponse.json(invoice)
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
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

  // Only allow deleting draft invoices
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (invoice.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 400 })
  }

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
