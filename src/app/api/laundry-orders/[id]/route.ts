import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLaundryOrderSchema } from '@/lib/validations'
import { validateTransition, laundryOrderTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/laundry-orders/:id
 *
 * Get a single laundry order by id.
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

  const { data: order, error } = await supabase
    .from('laundry_orders')
    .select(`
      id, customer_id, order_number, status, total_items, total_amount, paid_amount, rush_order, pickup_date, notes, created_at, updated_at,
      customers(id, name, phone),
      laundry_items(id, item_type, service_type, quantity, unit_price)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Laundry order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}

/**
 * PATCH /api/laundry-orders/:id
 *
 * Update a laundry order.
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

  const { data: body, error: validationError } = await validateBody(request, updateLaundryOrderSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Validate status transition
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('laundry_orders')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Laundry order not found' }, { status: 404 })
    }

    const result = validateTransition(laundryOrderTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    updateData.status = body.status
  }
  if (body.paid_amount !== undefined) updateData.paid_amount = body.paid_amount
  if (body.pickup_date !== undefined) updateData.pickup_date = body.pickup_date
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data: order, error } = await supabase
    .from('laundry_orders')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, customer_id, order_number, status, total_items, total_amount, paid_amount, rush_order, pickup_date, notes, created_at, updated_at,
      customers(id, name, phone),
      laundry_items(id, item_type, service_type, quantity, unit_price)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Laundry order not found' }, { status: 404 })
  }

  return NextResponse.json(order)
}
