import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateMaintenanceRequestSchema } from '@/lib/validations'
import { validateTransition, maintenanceTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/maintenance/:id
 *
 * Get a single maintenance request by id with unit and staff joins.
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

  const { data: maintenanceRequest, error } = await supabase
    .from('maintenance_requests')
    .select(`
      id, unit_id, reported_by, assigned_to, category, description, priority, status,
      estimated_cost, actual_cost, created_at, updated_at,
      units(id, unit_number),
      staff!maintenance_requests_assigned_to_fkey(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !maintenanceRequest) {
    return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 })
  }

  return NextResponse.json(maintenanceRequest)
}

/**
 * PATCH /api/maintenance/:id
 *
 * Update a maintenance request.
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

  const { data: body, error: validationError } = await validateBody(request, updateMaintenanceRequestSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to
  if (body.priority !== undefined) updateData.priority = body.priority
  if (body.actual_cost !== undefined) updateData.actual_cost = body.actual_cost

  // Validate status transition
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('maintenance_requests')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 })
    }

    const result = validateTransition(maintenanceTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    updateData.status = body.status
    if (body.status === 'completed') updateData.completed_at = new Date().toISOString()
  }

  const { data: maintenanceRequest, error } = await supabase
    .from('maintenance_requests')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, unit_id, reported_by, assigned_to, category, description, priority, status,
      estimated_cost, actual_cost, created_at, updated_at,
      units(id, unit_number),
      staff!maintenance_requests_assigned_to_fkey(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!maintenanceRequest) {
    return NextResponse.json({ error: 'Maintenance request not found' }, { status: 404 })
  }

  return NextResponse.json(maintenanceRequest)
}
