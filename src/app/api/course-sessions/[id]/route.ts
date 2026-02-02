import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, updateCourseSessionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/course-sessions/:id
 *
 * Get a single course session by id.
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

  const { data: session, error } = await supabase
    .from('course_sessions')
    .select(`
      id, program_id, instructor_id, title, scheduled_at, duration_minutes, location, status, created_at, updated_at,
      programs(id, name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Course session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}

/**
 * PATCH /api/course-sessions/:id
 *
 * Update a course session. Fields are built individually to avoid
 * sending undefined values to the database.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

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

  const { data: body, error: validationError } = await validateBody(request, updateCourseSessionSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.instructor_id !== undefined) updateData.instructor_id = body.instructor_id || null
  if (body.title !== undefined) updateData.title = body.title
  if (body.scheduled_at !== undefined) updateData.scheduled_at = body.scheduled_at
  if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes
  if (body.location !== undefined) updateData.location = body.location || null
  if (body.status !== undefined) updateData.status = body.status

  const { data: session, error } = await supabase
    .from('course_sessions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, program_id, instructor_id, title, scheduled_at, duration_minutes, location, status, created_at, updated_at,
      programs(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Course session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}
