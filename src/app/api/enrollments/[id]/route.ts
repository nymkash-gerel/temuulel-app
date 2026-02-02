import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, updateEnrollmentSchema } from '@/lib/validations'
import { validateTransition, enrollmentTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/enrollments/:id
 *
 * Get a single enrollment by id.
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

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .select(`
      id, student_id, program_id, status, enrolled_at, completed_at, grade, notes, created_at, updated_at,
      students(id, first_name, last_name),
      programs(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  return NextResponse.json(enrollment)
}

/**
 * PATCH /api/enrollments/:id
 *
 * Update an enrollment (status, grade, notes).
 * Automatically sets completed_at when status changes to 'completed'.
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

  const { data: body, error: validationError } = await validateBody(request, updateEnrollmentSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.grade !== undefined) updateData.grade = body.grade || null
  if (body.notes !== undefined) updateData.notes = body.notes || null

  // Validate status transition
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('enrollments')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    const result = validateTransition(enrollmentTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    updateData.status = body.status
  }

  // Auto-set completed_at when status changes to 'completed'
  if (body.status === 'completed') {
    updateData.completed_at = new Date().toISOString()
  }

  const { data: enrollment, error } = await supabase
    .from('enrollments')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, student_id, program_id, status, enrolled_at, completed_at, grade, notes, created_at, updated_at,
      students(id, first_name, last_name),
      programs(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  return NextResponse.json(enrollment)
}
