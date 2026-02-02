import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateHousekeepingTaskSchema } from '@/lib/validations'
import { validateTransition, housekeepingTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/housekeeping/:id
 *
 * Get a single housekeeping task by id with unit and staff joins.
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

  const { data: task, error } = await supabase
    .from('housekeeping_tasks')
    .select(`
      id, unit_id, assigned_to, task_type, priority, status, scheduled_at, completed_at, notes,
      created_at, updated_at,
      units(id, unit_number),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !task) {
    return NextResponse.json({ error: 'Housekeeping task not found' }, { status: 404 })
  }

  return NextResponse.json(task)
}

/**
 * PATCH /api/housekeeping/:id
 *
 * Update a housekeeping task. Auto-sets completed_at when status changes to 'completed'.
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

  const { data: body, error: validationError } = await validateBody(request, updateHousekeepingTaskSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to
  if (body.priority !== undefined) updateData.priority = body.priority
  if (body.completed_at !== undefined) updateData.completed_at = body.completed_at
  if (body.notes !== undefined) updateData.notes = body.notes

  // Validate status transition
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('housekeeping_tasks')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Housekeeping task not found' }, { status: 404 })
    }

    const result = validateTransition(housekeepingTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    updateData.status = body.status
  }

  // Auto-set completed_at when status changes to 'completed' (if not provided)
  if (body.status === 'completed' && body.completed_at === undefined) {
    updateData.completed_at = new Date().toISOString()
  }

  const { data: task, error } = await supabase
    .from('housekeeping_tasks')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, unit_id, assigned_to, task_type, priority, status, scheduled_at, completed_at, notes,
      created_at, updated_at,
      units(id, unit_number),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!task) {
    return NextResponse.json({ error: 'Housekeeping task not found' }, { status: 404 })
  }

  return NextResponse.json(task)
}
