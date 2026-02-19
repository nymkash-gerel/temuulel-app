import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createEnrollmentSchema, parsePagination } from '@/lib/validations'

const ENROLLMENT_STATUSES = ['active', 'completed', 'withdrawn', 'suspended'] as const

/**
 * GET /api/enrollments
 *
 * List enrollments for the authenticated user's store.
 * Supports filtering by status, student_id, and program_id.
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
  const studentId = searchParams.get('student_id')
  const programId = searchParams.get('program_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('enrollments')
    .select(`
      id, student_id, program_id, status, enrolled_at, completed_at, grade, notes, created_at, updated_at,
      students(id, first_name, last_name),
      programs(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && ENROLLMENT_STATUSES.includes(status as typeof ENROLLMENT_STATUSES[number])) {
    query = query.eq('status', status as typeof ENROLLMENT_STATUSES[number])
  }

  if (studentId) {
    query = query.eq('student_id', studentId)
  }

  if (programId) {
    query = query.eq('program_id', programId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/enrollments
 *
 * Create a new enrollment for the store.
 * Verifies both student_id and program_id belong to the store.
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

  const { data: body, error: validationError } = await validateBody(request, createEnrollmentSchema)
  if (validationError) return validationError

  // Verify student belongs to store
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('id', body.student_id)
    .eq('store_id', store.id)
    .single()

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

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

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .insert({
      store_id: store.id,
      student_id: body.student_id,
      program_id: body.program_id,
      status: 'active',
      enrolled_at: new Date().toISOString(),
    })
    .select(`
      id, student_id, program_id, status, enrolled_at, completed_at, grade, notes, created_at, updated_at,
      students(id, first_name, last_name),
      programs(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(enrollment, { status: 201 })
}
