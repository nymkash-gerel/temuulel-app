import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMedicalNoteSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/medical-notes
 *
 * List medical notes for the store. Supports filtering by patient_id, encounter_id, note_type.
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
  const patientId = searchParams.get('patient_id')
  const encounterId = searchParams.get('encounter_id')
  const noteType = searchParams.get('note_type')
  const { limit, offset } = parsePagination(searchParams)

  const validNoteTypes = ['progress', 'soap', 'procedure', 'discharge', 'referral'] as const

  let query = supabase
    .from('medical_notes')
    .select(`
      id, encounter_id, patient_id, author_id, note_type, content, is_private, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (patientId) {
    query = query.eq('patient_id', patientId)
  }

  if (encounterId) {
    query = query.eq('encounter_id', encounterId)
  }

  if (noteType && validNoteTypes.includes(noteType as typeof validNoteTypes[number])) {
    query = query.eq('note_type', noteType as typeof validNoteTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/medical-notes
 *
 * Create a new medical note. Sets author_id from the staff record linked to the current user.
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

  const { data: body, error: validationError } = await validateBody(request, createMedicalNoteSchema)
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

  // Look up staff record for the current user to set author_id
  const { data: staff } = await supabase
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .eq('store_id', store.id)
    .single()

  const { data: note, error } = await supabase
    .from('medical_notes')
    .insert({
      store_id: store.id,
      patient_id: body.patient_id,
      encounter_id: body.encounter_id || null,
      author_id: staff?.id || null,
      note_type: body.note_type || undefined,
      content: body.content,
      is_private: body.is_private || false,
    })
    .select(`
      id, encounter_id, patient_id, author_id, note_type, content, is_private, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(note, { status: 201 })
}
