import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTreatmentSessionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/treatment-sessions
 *
 * List treatment sessions for the store. Supports filtering by treatment_plan_id, status.
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
  const treatmentPlanId = searchParams.get('treatment_plan_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['scheduled', 'completed', 'missed', 'cancelled'] as const

  let query = supabase
    .from('treatment_sessions')
    .select(`
      id, treatment_plan_id, appointment_id, session_number, status, notes, results, performed_at, created_at,
      treatment_plans(id, name),
      appointments(id)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (treatmentPlanId) {
    query = query.eq('treatment_plan_id', treatmentPlanId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/treatment-sessions
 *
 * Create a new treatment session.
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

  const { data: body, error: validationError } = await validateBody(request, createTreatmentSessionSchema)
  if (validationError) return validationError

  // Verify treatment plan belongs to store
  const { data: plan } = await supabase
    .from('treatment_plans')
    .select('id')
    .eq('id', body.treatment_plan_id)
    .eq('store_id', store.id)
    .single()

  if (!plan) {
    return NextResponse.json({ error: 'Treatment plan not found in this store' }, { status: 404 })
  }

  const { data: session, error } = await supabase
    .from('treatment_sessions')
    .insert({
      store_id: store.id,
      treatment_plan_id: body.treatment_plan_id,
      appointment_id: body.appointment_id || null,
      session_number: body.session_number || undefined,
      notes: body.notes || null,
      results: body.results || null,
      performed_at: body.performed_at || null,
    })
    .select(`
      id, treatment_plan_id, appointment_id, session_number, status, notes, results, performed_at, created_at,
      treatment_plans(id, name),
      appointments(id)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(session, { status: 201 })
}
