import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createHousekeepingTaskSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/housekeeping
 *
 * List housekeeping tasks for the store. Supports filtering by status, unit_id, assigned_to.
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
  const unitId = searchParams.get('unit_id')
  const assignedTo = searchParams.get('assigned_to')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['pending', 'in_progress', 'completed', 'skipped'] as const

  let query = supabase
    .from('housekeeping_tasks')
    .select(`
      id, unit_id, assigned_to, task_type, priority, status, scheduled_at, completed_at, notes,
      created_at, updated_at,
      units(id, unit_number),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (unitId) {
    query = query.eq('unit_id', unitId)
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
 * POST /api/housekeeping
 *
 * Create a new housekeeping task.
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

  const { data: body, error: validationError } = await validateBody(request, createHousekeepingTaskSchema)
  if (validationError) return validationError

  const { data: task, error } = await supabase
    .from('housekeeping_tasks')
    .insert({
      store_id: store.id,
      unit_id: body.unit_id,
      assigned_to: body.assigned_to || null,
      task_type: body.task_type || undefined,
      priority: body.priority || undefined,
      scheduled_at: body.scheduled_at || null,
      notes: body.notes || null,
    })
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

  return NextResponse.json(task, { status: 201 })
}
