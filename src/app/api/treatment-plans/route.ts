import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTreatmentPlanSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/treatment-plans
 *
 * List treatment plans for the store. Supports filtering by status, customer_id.
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
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['active', 'completed', 'paused', 'cancelled'] as const

  let query = supabase
    .from('treatment_plans')
    .select(`
      id, customer_id, name, description, sessions_total, sessions_used, start_date, end_date, status, created_at, updated_at,
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
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
 * POST /api/treatment-plans
 *
 * Create a new treatment plan.
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

  const { data: body, error: validationError } = await validateBody(request, createTreatmentPlanSchema)
  if (validationError) return validationError

  // Verify customer belongs to store
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', body.customer_id)
    .eq('store_id', store.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found in this store' }, { status: 404 })
  }

  const { data: plan, error } = await supabase
    .from('treatment_plans')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id,
      name: body.name,
      description: body.description || null,
      sessions_total: body.sessions_total || undefined,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
    })
    .select(`
      id, customer_id, name, description, sessions_total, sessions_used, start_date, end_date, status, created_at, updated_at,
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(plan, { status: 201 })
}
