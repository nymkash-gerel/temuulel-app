import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateEncounterSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/encounters/:id
 *
 * Get a single encounter by id.
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

  const { data: encounter, error } = await supabase
    .from('encounters')
    .select(`
      id, patient_id, provider_id, encounter_type, status, chief_complaint, diagnosis, treatment_plan, notes, encounter_date, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  }

  return NextResponse.json(encounter)
}

/**
 * PATCH /api/encounters/:id
 *
 * Update an encounter.
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

  const { data: body, error: validationError } = await validateBody(request, updateEncounterSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.diagnosis !== undefined) updateData.diagnosis = body.diagnosis
  if (body.treatment_plan !== undefined) updateData.treatment_plan = body.treatment_plan
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data: encounter, error } = await supabase
    .from('encounters')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, patient_id, provider_id, encounter_type, status, chief_complaint, diagnosis, treatment_plan, notes, encounter_date, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 })
  }

  return NextResponse.json(encounter)
}
