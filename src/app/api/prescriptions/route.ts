import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPrescriptionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/prescriptions
 *
 * List prescriptions for the store. Supports filtering by status, patient_id.
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
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['active', 'completed', 'cancelled', 'expired'] as const

  let query = supabase
    .from('prescriptions')
    .select(`
      id, encounter_id, patient_id, prescribed_by, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name),
      prescription_items(id, medication_name, dosage, frequency, duration, instructions)
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

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/prescriptions
 *
 * Create a new prescription with items.
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

  const { data: body, error: validationError } = await validateBody(request, createPrescriptionSchema)
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

  // Insert prescription first
  const { data: prescription, error: prescriptionError } = await supabase
    .from('prescriptions')
    .insert({
      store_id: store.id,
      patient_id: body.patient_id,
      encounter_id: body.encounter_id || null,
      prescribed_by: body.prescribed_by || null,
      notes: body.notes || null,
    })
    .select('id')
    .single()

  if (prescriptionError || !prescription) {
    return NextResponse.json({ error: prescriptionError?.message || 'Failed to create prescription' }, { status: 500 })
  }

  // Insert prescription items
  const items = body.items.map((item) => ({
    prescription_id: prescription.id,
    medication_name: item.medication_name,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration || null,
    instructions: item.instructions || null,
  }))

  const { error: itemsError } = await supabase
    .from('prescription_items')
    .insert(items)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Return full prescription with items
  const { data: fullPrescription, error: fetchError } = await supabase
    .from('prescriptions')
    .select(`
      id, encounter_id, patient_id, prescribed_by, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name),
      prescription_items(id, medication_name, dosage, frequency, duration, instructions)
    `)
    .eq('id', prescription.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(fullPrescription, { status: 201 })
}
