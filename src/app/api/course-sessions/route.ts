import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createCourseSessionSchema, parsePagination } from '@/lib/validations'

const SESSION_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const

/**
 * GET /api/course-sessions
 *
 * List course sessions for the authenticated user's store.
 * Supports filtering by program_id, instructor_id, and status.
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
  const programId = searchParams.get('program_id')
  const instructorId = searchParams.get('instructor_id')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('course_sessions')
    .select(`
      id, program_id, instructor_id, title, scheduled_at, duration_minutes, location, status, created_at, updated_at,
      programs(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (programId) {
    query = query.eq('program_id', programId)
  }

  if (instructorId) {
    query = query.eq('instructor_id', instructorId)
  }

  if (status && SESSION_STATUSES.includes(status as typeof SESSION_STATUSES[number])) {
    query = query.eq('status', status as typeof SESSION_STATUSES[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/course-sessions
 *
 * Create a new course session for the store.
 * Verifies program_id belongs to the store.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, createCourseSessionSchema)
  if (validationError) return validationError

  // Verify program belongs to store
  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', body.program_id)
    .eq('store_id', store.id)
    .single()

  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 })
  }

  const { data: session, error } = await supabase
    .from('course_sessions')
    .insert({
      store_id: store.id,
      program_id: body.program_id,
      instructor_id: body.instructor_id || null,
      title: body.title,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes || undefined,
      location: body.location || null,
      status: 'scheduled',
    })
    .select(`
      id, program_id, instructor_id, title, scheduled_at, duration_minutes, location, status, created_at, updated_at,
      programs(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(session, { status: 201 })
}
