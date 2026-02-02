import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createProductionBatchSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/production-batches
 *
 * List production batches for the store. Supports filtering by status and date range.
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
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['planned', 'in_progress', 'completed'] as const

  let query = supabase
    .from('production_batches')
    .select(`
      id, product_id, production_date, target_qty, produced_qty,
      cost_per_unit, expiry_date, status, assigned_to, notes,
      created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('production_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (fromDate) {
    query = query.gte('production_date', fromDate)
  }

  if (toDate) {
    query = query.lte('production_date', toDate)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/production-batches
 *
 * Create a new production batch.
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

  const { data: body, error: validationError } = await validateBody(request, createProductionBatchSchema)
  if (validationError) return validationError

  const { data: batch, error } = await supabase
    .from('production_batches')
    .insert({
      store_id: store.id,
      product_id: body.product_id || null,
      production_date: body.production_date,
      target_qty: body.target_qty,
      cost_per_unit: body.cost_per_unit ?? null,
      expiry_date: body.expiry_date || null,
      assigned_to: body.assigned_to || null,
      notes: body.notes || null,
    })
    .select(`
      id, product_id, production_date, target_qty, produced_qty,
      cost_per_unit, expiry_date, status, assigned_to, notes,
      created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: batch }, { status: 201 })
}
