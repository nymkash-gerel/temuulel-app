import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createLegalCaseSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/legal-cases
 *
 * List legal cases for the store. Supports filtering by status, case_type, priority, customer_id.
 */
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
  const caseType = searchParams.get('case_type')
  const priority = searchParams.get('priority')
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['open', 'in_progress', 'pending_hearing', 'settled', 'closed', 'archived'] as const

  let query = supabase
    .from('legal_cases')
    .select(`
      id, case_number, title, customer_id, assigned_to, case_type, status, priority, description, court_name, filing_date, next_hearing, total_fees, amount_paid, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (caseType) {
    query = query.eq('case_type', caseType)
  }

  if (priority) {
    query = query.eq('priority', priority)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/legal-cases
 *
 * Create a new legal case.
 */
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

  const { data: body, error: validationError } = await validateBody(request, createLegalCaseSchema)
  if (validationError) return validationError

  const { data: legalCase, error } = await supabase
    .from('legal_cases')
    .insert({
      store_id: store.id,
      case_number: body.case_number,
      title: body.title,
      customer_id: body.customer_id || null,
      assigned_to: body.assigned_to || null,
      case_type: body.case_type || undefined,
      priority: body.priority || undefined,
      description: body.description || null,
      court_name: body.court_name || null,
      filing_date: body.filing_date || null,
      next_hearing: body.next_hearing || null,
      notes: body.notes || null,
      total_fees: body.total_fees || undefined,
    })
    .select(`
      id, case_number, title, customer_id, assigned_to, case_type, status, priority, description, court_name, filing_date, next_hearing, total_fees, amount_paid, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(legalCase, { status: 201 })
}
