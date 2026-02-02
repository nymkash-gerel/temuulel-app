import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createInvoiceSchema, parsePagination } from '@/lib/validations'
import { createInvoice } from '@/lib/billing'

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
  const status = searchParams.get('status')
  const partyType = searchParams.get('party_type')
  const partyId = searchParams.get('party_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, party_type, party_id, source_type, source_id,
      status, subtotal, tax_amount, discount_amount, total_amount,
      amount_paid, amount_due, currency, due_date, issued_at, notes,
      created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'refunded'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }
  if (partyType) {
    query = query.eq('party_type', partyType as 'customer' | 'supplier' | 'staff' | 'driver')
  }
  if (partyId) {
    query = query.eq('party_id', partyId)
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

  const { data: body, error: validationError } = await validateBody(request, createInvoiceSchema)
  if (validationError) return validationError

  const { invoice, error } = await createInvoice(supabase, {
    storeId: store.id,
    partyType: body.party_type,
    partyId: body.party_id || undefined,
    sourceType: body.source_type,
    sourceId: body.source_id || undefined,
    items: body.items,
    dueDate: body.due_date || undefined,
    notes: body.notes || undefined,
    taxRate: body.tax_rate || undefined,
    discountAmount: body.discount_amount || undefined,
  })

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  return NextResponse.json(invoice, { status: 201 })
}
