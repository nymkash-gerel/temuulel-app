import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createProjectTaskSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/project-tasks
 *
 * List project tasks for the store. Supports filtering by project_id, status, priority, assigned_to.
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
  const projectId = searchParams.get('project_id')
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignedTo = searchParams.get('assigned_to')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['todo', 'in_progress', 'review', 'completed', 'cancelled'] as const

  let query = supabase
    .from('project_tasks')
    .select(`
      id, project_id, title, assigned_to, description, due_date, estimated_hours, priority, sort_order, status, created_at, updated_at,
      projects(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (priority) {
    query = query.eq('priority', priority)
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
 * POST /api/project-tasks
 *
 * Create a new project task.
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

  const { data: body, error: validationError } = await validateBody(request, createProjectTaskSchema)
  if (validationError) return validationError

  // Verify project belongs to store
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', body.project_id)
    .eq('store_id', store.id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found in this store' }, { status: 404 })
  }

  const { data: task, error } = await supabase
    .from('project_tasks')
    .insert({
      store_id: store.id,
      project_id: body.project_id,
      title: body.title,
      assigned_to: body.assigned_to || null,
      description: body.description || null,
      due_date: body.due_date || null,
      estimated_hours: body.estimated_hours || null,
      priority: body.priority || undefined,
      sort_order: body.sort_order || undefined,
    })
    .select(`
      id, project_id, title, assigned_to, description, due_date, estimated_hours, priority, sort_order, status, created_at, updated_at,
      projects(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(task, { status: 201 })
}
