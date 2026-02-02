import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateMedicalComplaintSchema } from '@/lib/validations'
import { validateTransition, medicalComplaintTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/medical-complaints/:id
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

  const { data: complaint, error } = await supabase
    .from('medical_complaints')
    .select(`
      id, patient_id, encounter_id, category, severity, description,
      status, assigned_to, resolution, resolved_at, created_at, updated_at,
      patients(id, first_name, last_name),
      encounters(id, encounter_type, encounter_date, chief_complaint),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !complaint) {
    return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
  }

  return NextResponse.json(complaint)
}

/**
 * PATCH /api/medical-complaints/:id
 *
 * Update complaint (assign, resolve, close).
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

  const { data: body, error: validationError } = await validateBody(request, updateMedicalComplaintSchema)
  if (validationError) return validationError

  // Validate status transition if status is being changed
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('medical_complaints')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    const result = validateTransition(medicalComplaintTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to
  if (body.resolution !== undefined) updateData.resolution = body.resolution
  if (body.severity !== undefined) updateData.severity = body.severity

  // Auto-set resolved_at when resolving
  if (body.status === 'resolved' || body.status === 'closed') {
    updateData.resolved_at = new Date().toISOString()
  }

  const { data: complaint, error } = await supabase
    .from('medical_complaints')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, patient_id, encounter_id, category, severity, description,
      status, assigned_to, resolution, resolved_at, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!complaint) {
    return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
  }

  return NextResponse.json(complaint)
}
