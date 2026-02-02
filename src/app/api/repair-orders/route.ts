import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createRepairOrderSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/repair-orders
 *
 * List repair orders for the store. Supports filtering by status, device_type, priority, customer_id, assigned_to.
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
  const deviceType = searchParams.get('device_type')
  const priority = searchParams.get('priority')
  const customerId = searchParams.get('customer_id')
  const assignedTo = searchParams.get('assigned_to')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['received', 'diagnosing', 'waiting_parts', 'in_repair', 'testing', 'completed', 'delivered', 'cancelled'] as const
  const validDeviceTypes = ['phone', 'tablet', 'laptop', 'desktop', 'tv', 'appliance', 'vehicle', 'jewelry', 'watch', 'other'] as const
  const validPriorities = ['low', 'medium', 'high', 'urgent'] as const

  let query = supabase
    .from('repair_orders')
    .select(`
      id, order_number, customer_id, assigned_to, device_type, brand, model, serial_number, issue_description, diagnosis, status, priority, estimated_cost, actual_cost, deposit_amount, received_at, estimated_completion, completed_at, delivered_at, warranty_until, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (deviceType && validDeviceTypes.includes(deviceType as typeof validDeviceTypes[number])) {
    query = query.eq('device_type', deviceType as typeof validDeviceTypes[number])
  }

  if (priority && validPriorities.includes(priority as typeof validPriorities[number])) {
    query = query.eq('priority', priority as typeof validPriorities[number])
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/repair-orders
 *
 * Create a new repair order.
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

  const { data: body, error: validationError } = await validateBody(request, createRepairOrderSchema)
  if (validationError) return validationError

  const { data: repairOrder, error } = await supabase
    .from('repair_orders')
    .insert({
      store_id: store.id,
      order_number: body.order_number,
      issue_description: body.issue_description,
      customer_id: body.customer_id || null,
      assigned_to: body.assigned_to || null,
      device_type: body.device_type || undefined,
      priority: body.priority || undefined,
      brand: body.brand || null,
      model: body.model || null,
      serial_number: body.serial_number || null,
      diagnosis: body.diagnosis || null,
      estimated_cost: body.estimated_cost || null,
      deposit_amount: body.deposit_amount || null,
      estimated_completion: body.estimated_completion || null,
      warranty_until: body.warranty_until || null,
      notes: body.notes || null,
    })
    .select(`
      id, order_number, customer_id, assigned_to, device_type, brand, model, serial_number, issue_description, diagnosis, status, priority, estimated_cost, actual_cost, deposit_amount, received_at, estimated_completion, completed_at, delivered_at, warranty_until, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: repairOrder }, { status: 201 })
}
