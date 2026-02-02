import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateRepairOrderSchema } from '@/lib/validations'
import { validateTransition, repairOrderTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

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

  const { data: repairOrder, error } = await supabase
    .from('repair_orders')
    .select(`
      id, order_number, customer_id, assigned_to, device_type, brand, model, serial_number, issue_description, diagnosis, status, priority, estimated_cost, actual_cost, deposit_amount, received_at, estimated_completion, completed_at, delivered_at, warranty_until, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !repairOrder) {
    return NextResponse.json({ error: 'Repair order not found' }, { status: 404 })
  }

  return NextResponse.json(repairOrder)
}

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

  const { data: body, error: validationError } = await validateBody(request, updateRepairOrderSchema)
  if (validationError) return validationError

  // Validate status transition if status is being changed
  if (body.status) {
    const { data: current } = await supabase
      .from('repair_orders')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Repair order not found' }, { status: 404 })
    }

    const result = validateTransition(repairOrderTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { ...body, updated_at: now }

  // Auto-set timestamps on status transitions
  if (body.status === 'completed') updatePayload.completed_at = now
  if (body.status === 'delivered') updatePayload.delivered_at = now

  const { data: repairOrder, error } = await supabase
    .from('repair_orders')
    .update(updatePayload)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, order_number, customer_id, assigned_to, device_type, brand, model, serial_number, issue_description, diagnosis, status, priority, estimated_cost, actual_cost, deposit_amount, received_at, estimated_completion, completed_at, delivered_at, warranty_until, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!repairOrder) {
    return NextResponse.json({ error: 'Repair order not found' }, { status: 404 })
  }

  return NextResponse.json(repairOrder)
}

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
    .from('repair_orders')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
