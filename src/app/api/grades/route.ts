import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createGradeSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/grades
 *
 * List grades for the authenticated user's store.
 * Supports filtering by enrollment_id.
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
  const enrollmentId = searchParams.get('enrollment_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('grades')
    .select(`
      id, enrollment_id, assessment_name, score, max_score, weight, notes, graded_at, created_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (enrollmentId) {
    query = query.eq('enrollment_id', enrollmentId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/grades
 *
 * Create a new grade record.
 * Verifies enrollment_id belongs to the store.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, createGradeSchema)
  if (validationError) return validationError

  // Verify enrollment belongs to store
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('id', body.enrollment_id)
    .eq('store_id', store.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const { data: grade, error } = await supabase
    .from('grades')
    .insert({
      store_id: store.id,
      enrollment_id: body.enrollment_id,
      assessment_name: body.assessment_name,
      score: body.score ?? null,
      max_score: body.max_score ?? undefined,
      weight: body.weight ?? undefined,
      notes: body.notes || null,
      graded_at: new Date().toISOString(),
    })
    .select('id, enrollment_id, assessment_name, score, max_score, weight, notes, graded_at, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(grade, { status: 201 })
}
