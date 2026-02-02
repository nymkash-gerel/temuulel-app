import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateAdmissionSchema } from '@/lib/validations'
import { validateTransition, admissionTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/admissions/:id
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

  const { data: admission, error } = await supabase
    .from('admissions')
    .select(`
      id, patient_id, attending_staff_id, admit_diagnosis, admit_at, discharge_at,
      discharge_summary, status, notes, created_at, updated_at,
      patients(id, first_name, last_name, date_of_birth, gender, blood_type, allergies),
      staff(id, name),
      bed_assignments(id, unit_id, start_at, end_at,
        bookable_resources(id, name, type))
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !admission) {
    return NextResponse.json({ error: 'Admission not found' }, { status: 404 })
  }

  return NextResponse.json(admission)
}

/**
 * PATCH /api/admissions/:id
 *
 * Update admission (discharge, transfer, update notes).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const { data: body, error: validationError } = await validateBody(request, updateAdmissionSchema)
  if (validationError) return validationError

  // Validate status transition if status is being changed
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('admissions')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Admission not found' }, { status: 404 })
    }

    const result = validateTransition(admissionTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.attending_staff_id !== undefined) updateData.attending_staff_id = body.attending_staff_id
  if (body.discharge_at !== undefined) updateData.discharge_at = body.discharge_at
  if (body.discharge_summary !== undefined) updateData.discharge_summary = body.discharge_summary
  if (body.notes !== undefined) updateData.notes = body.notes

  // Auto-set discharge_at when discharging
  if (body.status === 'discharged' && !body.discharge_at) {
    updateData.discharge_at = new Date().toISOString()
  }

  const { data: admission, error } = await supabase
    .from('admissions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
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

  if (!admission) {
    return NextResponse.json({ error: 'Admission not found' }, { status: 404 })
  }

  return NextResponse.json(admission)
}
