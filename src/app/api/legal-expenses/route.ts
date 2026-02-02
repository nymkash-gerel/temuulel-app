import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createLegalExpenseSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/legal-expenses
 *
 * List legal expenses for the store. Supports filtering by case_id, expense_type, is_billable.
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
  const caseId = searchParams.get('case_id')
  const expenseType = searchParams.get('expense_type')
  const isBillable = searchParams.get('is_billable')
  const { limit, offset } = parsePagination(searchParams)

  const validExpenseTypes = ['filing_fee', 'travel', 'expert_witness', 'court_reporter', 'copying', 'other'] as const

  let query = supabase
    .from('legal_expenses')
    .select(`
      id, case_id, expense_type, description, amount, incurred_date, is_billable, receipt_url, created_at, updated_at,
      legal_cases(id, case_number, title)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('incurred_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (expenseType && validExpenseTypes.includes(expenseType as typeof validExpenseTypes[number])) {
    query = query.eq('expense_type', expenseType as typeof validExpenseTypes[number])
  }

  if (isBillable === 'true' || isBillable === 'false') {
    query = query.eq('is_billable', isBillable === 'true')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/legal-expenses
 *
 * Create a new legal expense.
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

  const { data: body, error: validationError } = await validateBody(request, createLegalExpenseSchema)
  if (validationError) return validationError

  const { data: expense, error } = await supabase
    .from('legal_expenses')
    .insert({
      store_id: store.id,
      case_id: body.case_id,
      expense_type: body.expense_type || undefined,
      description: body.description,
      amount: body.amount,
      incurred_date: body.incurred_date || undefined,
      is_billable: body.is_billable ?? true,
      receipt_url: body.receipt_url || null,
    })
    .select(`
      id, case_id, expense_type, description, amount, incurred_date, is_billable, receipt_url, created_at, updated_at,
      legal_cases(id, case_number, title)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(expense, { status: 201 })
}
