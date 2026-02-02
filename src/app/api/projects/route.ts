import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createProjectSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/projects
 *
 * List projects for the store. Supports filtering by status, project_type, priority, customer_id.
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
  const projectType = searchParams.get('project_type')
  const priority = searchParams.get('priority')
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const

  let query = supabase
    .from('projects')
    .select(`
      id, name, customer_id, manager_id, project_type, priority, status, description, start_date, end_date, budget, location, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (projectType) {
    query = query.eq('project_type', projectType)
  }

  if (priority) {
    query = query.eq('priority', priority)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/projects
 *
 * Create a new project.
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

  const { data: body, error: validationError } = await validateBody(request, createProjectSchema)
  if (validationError) return validationError

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      store_id: store.id,
      name: body.name,
      customer_id: body.customer_id || null,
      manager_id: body.manager_id || null,
      project_type: body.project_type || undefined,
      priority: body.priority || undefined,
      status: 'planning',
      description: body.description || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      budget: body.budget || null,
      location: body.location || null,
      notes: body.notes || null,
    })
    .select(`
      id, name, customer_id, manager_id, project_type, priority, status, description, start_date, end_date, budget, location, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(project, { status: 201 })
}
