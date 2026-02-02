import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateWashOrderSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/wash-orders/:id
 *
 * Get a single wash order by id with vehicle and customer joins.
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

  const { data: washOrder, error } = await supabase
    .from('wash_orders')
    .select(`
      id, vehicle_id, customer_id, order_number, service_type, status, total_amount, bay_number,
      started_at, completed_at, notes, created_at, updated_at,
      vehicles(id, plate_number, make, model),
      customers(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !washOrder) {
    return NextResponse.json({ error: 'Wash order not found' }, { status: 404 })
  }

  return NextResponse.json(washOrder)
}

/**
 * PATCH /api/wash-orders/:id
 *
 * Update a wash order.
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

  const { data: updates, error: validationError } = await validateBody(request, updateWashOrderSchema)
  if (validationError) return validationError

  const { data: washOrder, error } = await supabase
    .from('wash_orders')
    .update(updates)
    .eq('id', id)
    .eq('store_id', store.id)
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

  if (!washOrder) {
    return NextResponse.json({ error: 'Wash order not found' }, { status: 404 })
  }

  return NextResponse.json(washOrder)
}

/**
 * DELETE /api/wash-orders/:id
 *
 * Delete a wash order.
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
    .from('wash_orders')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
