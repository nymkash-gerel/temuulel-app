import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePrescriptionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/prescriptions/:id
 *
 * Get a single prescription by id.
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

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .select(`
      id, encounter_id, patient_id, prescribed_by, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name),
      prescription_items(id, medication_name, dosage, frequency, duration, instructions)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !prescription) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
  }

  return NextResponse.json(prescription)
}

/**
 * PATCH /api/prescriptions/:id
 *
 * Update a prescription (status, notes).
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

  const { data: body, error: validationError } = await validateBody(request, updatePrescriptionSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, encounter_id, patient_id, prescribed_by, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name),
      prescription_items(id, medication_name, dosage, frequency, duration, instructions)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!prescription) {
    return NextResponse.json({ error: 'Prescription not found' }, { status: 404 })
  }

  return NextResponse.json(prescription)
}
