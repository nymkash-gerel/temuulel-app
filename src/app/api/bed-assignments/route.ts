import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createBedAssignmentSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/bed-assignments
 *
 * List bed/unit assignments. Filter by admission_id.
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
  const admission_id = searchParams.get('admission_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('bed_assignments')
    .select(`
      id, admission_id, unit_id, start_at, end_at, created_at,
      admissions(id, patient_id, status,
        patients(id, first_name, last_name)),
      bookable_resources(id, name, type, status)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('start_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (admission_id) {
    query = query.eq('admission_id', admission_id)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/bed-assignments
 *
 * Assign a bed/unit to an admission.
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

  const { data: body, error: validationError } = await validateBody(request, createBedAssignmentSchema)
  if (validationError) return validationError

  // Verify admission belongs to store
  const { data: admission } = await supabase
    .from('admissions')
    .select('id')
    .eq('id', body.admission_id)
    .eq('store_id', store.id)
    .single()

  if (!admission) {
    return NextResponse.json({ error: 'Admission not found' }, { status: 404 })
  }

  const { data: assignment, error } = await supabase
    .from('bed_assignments')
    .insert({
      store_id: store.id,
      admission_id: body.admission_id,
      unit_id: body.unit_id || null,
      start_at: body.start_at || new Date().toISOString(),
      end_at: body.end_at || null,
    })
    .select(`
      id, admission_id, unit_id, start_at, end_at, created_at,
      bookable_resources(id, name, type)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(assignment, { status: 201 })
}
