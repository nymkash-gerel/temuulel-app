import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createRetainerSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/retainers
 *
 * List retainers for the store. Supports filtering by case_id, client_id, status.
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
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['active', 'depleted', 'refunded'] as const

  let query = supabase
    .from('retainers')
    .select(`
      id, case_id, client_id, initial_amount, current_balance, status, created_at, updated_at,
      legal_cases(id, case_number, title),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/retainers
 *
 * Create a new retainer.
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

  const { data: body, error: validationError } = await validateBody(request, createRetainerSchema)
  if (validationError) return validationError

  const { data: retainer, error } = await supabase
    .from('retainers')
    .insert({
      store_id: store.id,
      case_id: body.case_id,
      client_id: body.client_id || null,
      initial_amount: body.initial_amount,
      current_balance: body.current_balance ?? body.initial_amount,
      status: body.status || undefined,
    })
    .select(`
      id, case_id, client_id, initial_amount, current_balance, status, created_at, updated_at,
      legal_cases(id, case_number, title),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(retainer, { status: 201 })
}
