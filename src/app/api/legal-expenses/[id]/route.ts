import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLegalExpenseSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/legal-expenses/:id
 *
 * Get a single legal expense by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const { data: expense, error } = await supabase
    .from('legal_expenses')
    .select(`
      id, case_id, expense_type, description, amount, incurred_date, is_billable, receipt_url, created_at, updated_at,
      legal_cases(id, case_number, title)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !expense) {
    return NextResponse.json({ error: 'Legal expense not found' }, { status: 404 })
  }

  return NextResponse.json(expense)
}

/**
 * PATCH /api/legal-expenses/:id
 *
 * Update a legal expense.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const { data: body, error: validationError } = await validateBody(request, updateLegalExpenseSchema)
  if (validationError) return validationError

  const { data: expense, error } = await supabase
    .from('legal_expenses')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, case_id, expense_type, description, amount, incurred_date, is_billable, receipt_url, created_at, updated_at,
      legal_cases(id, case_number, title)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!expense) {
    return NextResponse.json({ error: 'Legal expense not found' }, { status: 404 })
  }

  return NextResponse.json(expense)
}

/**
 * DELETE /api/legal-expenses/:id
 *
 * Delete a legal expense.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const { error } = await supabase
    .from('legal_expenses')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
