import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMedicalComplaintSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/medical-complaints
 *
 * List medical complaints/QA issues for the store.
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
  const category = searchParams.get('category')
  const severity = searchParams.get('severity')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('medical_complaints')
    .select(`
      id, patient_id, encounter_id, category, severity, description,
      status, assigned_to, resolution, resolved_at, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['open', 'assigned', 'reviewed', 'resolved', 'closed'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status)
  }

  const validCategories = ['wait_time', 'treatment', 'staff_behavior', 'facility', 'billing', 'other'] as const
  if (category && validCategories.includes(category as typeof validCategories[number])) {
    query = query.eq('category', category)
  }

  const validSeverities = ['minor', 'moderate', 'serious'] as const
  if (severity && validSeverities.includes(severity as typeof validSeverities[number])) {
    query = query.eq('severity', severity)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/medical-complaints
 *
 * File a new medical complaint.
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

  const { data: body, error: validationError } = await validateBody(request, createMedicalComplaintSchema)
  if (validationError) return validationError

  const { data: complaint, error } = await supabase
    .from('medical_complaints')
    .insert({
      store_id: store.id,
      patient_id: body.patient_id || null,
      encounter_id: body.encounter_id || null,
      category: body.category || 'other',
      severity: body.severity || 'minor',
      description: body.description,
    })
    .select(`
      id, patient_id, encounter_id, category, severity, description,
      status, assigned_to, resolution, resolved_at, created_at, updated_at,
      patients(id, first_name, last_name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(complaint, { status: 201 })
}
