import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createServiceRequestSchema, parsePagination } from '@/lib/validations'

function generateRequestNumber(): string {
  return `SR-${Date.now()}`
}

/**
 * GET /api/service-requests
 *
 * List service requests for the authenticated user's store.
 * Supports filtering by status, service_type, priority, customer_id, assigned_to.
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
  const priority = searchParams.get('priority')
  const customerId = searchParams.get('customer_id')
  const assignedTo = searchParams.get('assigned_to')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('service_requests')
    .select(`
      id, request_number, service_type, status, priority,
      address, scheduled_at, duration_estimate,
      estimated_cost, actual_cost, notes,
      completed_at, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }
  if (serviceType) {
    query = query.eq('service_type', serviceType)
  }
  if (priority) {
    query = query.eq('priority', priority)
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
 * POST /api/service-requests
 *
 * Create a new service request.
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

  const { data: body, error: validationError } = await validateBody(request, createServiceRequestSchema)
  if (validationError) return validationError

  const { data: item, error } = await supabase
    .from('service_requests')
    .insert({
      store_id: store.id,
      request_number: body.request_number || generateRequestNumber(),
      customer_id: body.customer_id || null,
      assigned_to: body.assigned_to || null,
      service_type: body.service_type || undefined,
      address: body.address || null,
      scheduled_at: body.scheduled_at || null,
      duration_estimate: body.duration_estimate || null,
      priority: body.priority || undefined,
      estimated_cost: body.estimated_cost || null,
      notes: body.notes || null,
      status: 'pending',
    })
    .select(`
      id, request_number, service_type, status, priority,
      address, scheduled_at, duration_estimate,
      estimated_cost, notes, created_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
