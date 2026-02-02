import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createAdmissionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/admissions
 *
 * List inpatient admissions for the store.
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
  const patient_id = searchParams.get('patient_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('admissions')
    .select(`
      id, patient_id, attending_staff_id, admit_diagnosis, admit_at, discharge_at,
      discharge_summary, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('admit_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['admitted', 'discharged', 'transferred'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status)
  }

  if (patient_id) {
    query = query.eq('patient_id', patient_id)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/admissions
 *
 * Admit a patient (create inpatient admission).
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

  const { data: body, error: validationError } = await validateBody(request, createAdmissionSchema)
  if (validationError) return validationError

  // Verify patient belongs to store
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patient_id)
    .eq('store_id', store.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const { data: admission, error } = await supabase
    .from('admissions')
    .insert({
      store_id: store.id,
      patient_id: body.patient_id,
      attending_staff_id: body.attending_staff_id || null,
      admit_diagnosis: body.admit_diagnosis || null,
      admit_at: body.admit_at || new Date().toISOString(),
      notes: body.notes || null,
    })
    .select(`
      id, patient_id, attending_staff_id, admit_diagnosis, admit_at, discharge_at,
      discharge_summary, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(admission, { status: 201 })
}
