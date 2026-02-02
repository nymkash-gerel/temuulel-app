import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePatientSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/patients/:id
 *
 * Get a single patient by id, including JSONB fields.
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

  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      id, first_name, last_name, date_of_birth, gender, blood_type, phone, email,
      emergency_contact, allergies, medical_history, insurance_info,
      created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  return NextResponse.json(patient)
}

/**
 * PATCH /api/patients/:id
 *
 * Update a patient.
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

  const { data: body, error: validationError } = await validateBody(request, updatePatientSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.first_name !== undefined) updateData.first_name = body.first_name
  if (body.last_name !== undefined) updateData.last_name = body.last_name
  if (body.customer_id !== undefined) updateData.customer_id = body.customer_id
  if (body.date_of_birth !== undefined) updateData.date_of_birth = body.date_of_birth
  if (body.gender !== undefined) updateData.gender = body.gender
  if (body.blood_type !== undefined) updateData.blood_type = body.blood_type
  if (body.phone !== undefined) updateData.phone = body.phone
  if (body.email !== undefined) updateData.email = body.email
  if (body.emergency_contact !== undefined) updateData.emergency_contact = body.emergency_contact as unknown as Json
  if (body.allergies !== undefined) updateData.allergies = body.allergies
  if (body.insurance_info !== undefined) updateData.insurance_info = body.insurance_info as unknown as Json

  const { data: patient, error } = await supabase
    .from('patients')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, first_name, last_name, date_of_birth, gender, blood_type, phone, email,
      emergency_contact, allergies, medical_history, insurance_info,
      created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  return NextResponse.json(patient)
}
