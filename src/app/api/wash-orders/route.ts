import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createWashOrderSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/wash-orders
 *
 * List wash orders for the store. Supports filtering by status, service_type.
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
  const serviceType = searchParams.get('service_type')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'] as const
  const validServiceTypes = ['basic', 'standard', 'premium', 'deluxe', 'interior_only', 'exterior_only'] as const

  let query = supabase
    .from('wash_orders')
    .select(`
      id, vehicle_id, customer_id, order_number, service_type, status, total_amount, bay_number,
      started_at, completed_at, notes, created_at, updated_at,
      vehicles(id, plate_number, make, model),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (serviceType && validServiceTypes.includes(serviceType as typeof validServiceTypes[number])) {
    query = query.eq('service_type', serviceType as typeof validServiceTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/wash-orders
 *
 * Create a new wash order. Generates order_number automatically.
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

  const { data: body, error: validationError } = await validateBody(request, createWashOrderSchema)
  if (validationError) return validationError

  const orderNumber = 'WO-' + Date.now()

  const { data: washOrder, error } = await supabase
    .from('wash_orders')
    .insert({
      store_id: store.id,
      vehicle_id: body.vehicle_id,
      customer_id: body.customer_id || null,
      order_number: orderNumber,
      service_type: body.service_type || undefined,
      status: 'pending',
      total_amount: body.total_amount || undefined,
      bay_number: body.bay_number || null,
      notes: body.notes || null,
    })
    .select(`
      id, vehicle_id, customer_id, order_number, service_type, status, total_amount, bay_number,
      started_at, completed_at, notes, created_at, updated_at,
      vehicles(id, plate_number, make, model),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(washOrder, { status: 201 })
}
