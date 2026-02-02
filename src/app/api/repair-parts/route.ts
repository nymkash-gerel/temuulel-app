import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createRepairPartSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/repair-parts
 *
 * List repair parts for the store. Supports filtering by repair_order_id.
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
  const repairOrderId = searchParams.get('repair_order_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('repair_parts')
    .select(`
      id, repair_order_id, name, part_number, quantity, unit_cost, supplier, created_at,
      repair_orders(id, order_number, device_type, status)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (repairOrderId) {
    query = query.eq('repair_order_id', repairOrderId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/repair-parts
 *
 * Create a new repair part.
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

  const { data: body, error: validationError } = await validateBody(request, createRepairPartSchema)
  if (validationError) return validationError

  // Verify repair order belongs to store
  const { data: repairOrder } = await supabase
    .from('repair_orders')
    .select('id')
    .eq('id', body.repair_order_id)
    .eq('store_id', store.id)
    .single()

  if (!repairOrder) {
    return NextResponse.json({ error: 'Repair order not found in this store' }, { status: 404 })
  }

  const { data: part, error } = await supabase
    .from('repair_parts')
    .insert({
      store_id: store.id,
      repair_order_id: body.repair_order_id,
      name: body.name,
      part_number: body.part_number || null,
      quantity: body.quantity || undefined,
      unit_cost: body.unit_cost || undefined,
      supplier: body.supplier || null,
    })
    .select(`
      id, repair_order_id, name, part_number, quantity, unit_cost, supplier, created_at,
      repair_orders(id, order_number, device_type, status)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: part }, { status: 201 })
}
