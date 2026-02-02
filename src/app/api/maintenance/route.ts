import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMaintenanceRequestSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/maintenance
 *
 * List maintenance requests for the store. Supports filtering by status, priority, unit_id.
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
  const priority = searchParams.get('priority')
  const unitId = searchParams.get('unit_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['reported', 'assigned', 'in_progress', 'completed', 'cancelled'] as const
  const validPriorities = ['low', 'normal', 'high', 'urgent'] as const

  let query = supabase
    .from('maintenance_requests')
    .select(`
      id, unit_id, reported_by, assigned_to, category, description, priority, status,
      estimated_cost, actual_cost, created_at, updated_at,
      units(id, unit_number),
      staff!maintenance_requests_assigned_to_fkey(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (priority && validPriorities.includes(priority as typeof validPriorities[number])) {
    query = query.eq('priority', priority as typeof validPriorities[number])
  }

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/maintenance
 *
 * Create a new maintenance request.
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

  const { data: body, error: validationError } = await validateBody(request, createMaintenanceRequestSchema)
  if (validationError) return validationError

  const { data: maintenanceRequest, error } = await supabase
    .from('maintenance_requests')
    .insert({
      store_id: store.id,
      unit_id: body.unit_id || null,
      assigned_to: body.assigned_to || null,
      category: body.category || undefined,
      description: body.description,
      priority: body.priority || undefined,
      estimated_cost: body.estimated_cost || null,
      reported_by: user.id,
    })
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

  return NextResponse.json(maintenanceRequest, { status: 201 })
}
