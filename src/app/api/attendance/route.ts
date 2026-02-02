import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, recordAttendanceSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/attendance
 *
 * List attendance records for the authenticated user's store.
 * Supports filtering by session_id and student_id.
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
  const sessionId = searchParams.get('session_id')
  const studentId = searchParams.get('student_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('attendance')
    .select(`
      id, session_id, student_id, status, notes, created_at,
      students(id, first_name, last_name),
      course_sessions(id, title, scheduled_at)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/attendance
 *
 * Record or update attendance for a student in a session.
 * Uses upsert with onConflict on session_id + student_id.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, recordAttendanceSchema)
  if (validationError) return validationError

  const { data: record, error } = await supabase
    .from('attendance')
    .upsert(
      {
        store_id: store.id,
        session_id: body.session_id,
        student_id: body.student_id,
        status: body.status || 'present',
        notes: body.notes || null,
      },
      { onConflict: 'session_id,student_id' }
    )
    .select(`
      id, session_id, student_id, status, notes, created_at,
      students(id, first_name, last_name),
      course_sessions(id, title, scheduled_at)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(record, { status: 201 })
}
