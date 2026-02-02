import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMaterialOrderSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/material-orders
 *
 * List material orders for the store. Supports filtering by status, project_id.
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
  const projectId = searchParams.get('project_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['ordered', 'shipped', 'delivered', 'cancelled'] as const

  let query = supabase
    .from('material_orders')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/material-orders
 *
 * Create a new material order.
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

  const { data: body, error: validationError } = await validateBody(request, createMaterialOrderSchema)
  if (validationError) return validationError

  const { data: materialOrder, error } = await supabase
    .from('material_orders')
    .insert({
      store_id: store.id,
      project_id: body.project_id,
      supplier_name: body.supplier_name,
      order_date: body.order_date || undefined,
      expected_delivery: body.expected_delivery || null,
      total_cost: body.total_cost || 0,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(materialOrder, { status: 201 })
}
