import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateServiceRequestSchema } from '@/lib/validations'
import { validateTransition, serviceRequestTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/service-requests/[id]
 *
 * Get a single service request with customer and staff info.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
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

  const { data, error } = await supabase
    .from('service_requests')
    .select(`
      *,
      customers(id, name, phone, email),
      staff(id, name, phone, email)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/service-requests/[id]
 *
 * Update a service request.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
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

  const { data: body, error: validationError } = await validateBody(request, updateServiceRequestSchema)
  if (validationError) return validationError

  // Validate status transition
  if (body.status) {
    const { data: current } = await supabase
      .from('service_requests')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    const result = validateTransition(serviceRequestTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const updatePayload = { ...body, updated_at: now }
  if (body.status === 'completed') updatePayload.completed_at = now

  const { data: item, error } = await supabase
    .from('service_requests')
    .update(updatePayload)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, request_number, service_type, status, priority,
      address, scheduled_at, duration_estimate,
      estimated_cost, actual_cost, notes,
      completed_at, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!item) {
    return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
  }

  return NextResponse.json(item)
}

/**
 * DELETE /api/service-requests/[id]
 *
 * Delete a service request.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
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
    .from('service_requests')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
