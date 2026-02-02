import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createEncounterSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/encounters
 *
 * List encounters for the store. Supports filtering by status, patient_id, provider_id.
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
  const patientId = searchParams.get('patient_id')
  const providerId = searchParams.get('provider_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'] as const

  let query = supabase
    .from('encounters')
    .select(`
      id, patient_id, provider_id, encounter_type, status, chief_complaint, diagnosis, treatment_plan, notes, encounter_date, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (patientId) {
    query = query.eq('patient_id', patientId)
  }

  if (providerId) {
    query = query.eq('provider_id', providerId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/encounters
 *
 * Create a new encounter.
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

  const { data: body, error: validationError } = await validateBody(request, createEncounterSchema)
  if (validationError) return validationError

  // Verify patient belongs to store
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patient_id)
    .eq('store_id', store.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found in this store' }, { status: 404 })
  }

  const { data: encounter, error } = await supabase
    .from('encounters')
    .insert({
      store_id: store.id,
      patient_id: body.patient_id,
      provider_id: body.provider_id || null,
      encounter_type: body.encounter_type || undefined,
      chief_complaint: body.chief_complaint || null,
      encounter_date: body.encounter_date || new Date().toISOString(),
    })
    .select(`
      id, patient_id, provider_id, encounter_type, status, chief_complaint, diagnosis, treatment_plan, notes, encounter_date, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(encounter, { status: 201 })
}
