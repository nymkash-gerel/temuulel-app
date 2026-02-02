import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePetAppointmentSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/pet-appointments/:id
 *
 * Get a single pet appointment by id.
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

  const { data: appointment, error } = await supabase
    .from('pet_appointments')
    .select(`
      id, scheduled_at, duration_minutes, status, notes, total_amount, created_at, updated_at,
      pets(id, name, species),
      services(id, name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !appointment) {
    return NextResponse.json({ error: 'Pet appointment not found' }, { status: 404 })
  }

  return NextResponse.json(appointment)
}

/**
 * PATCH /api/pet-appointments/:id
 *
 * Update a pet appointment.
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

  const { data: body, error: validationError } = await validateBody(request, updatePetAppointmentSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.service_id !== undefined) updateData.service_id = body.service_id
  if (body.staff_id !== undefined) updateData.staff_id = body.staff_id
  if (body.scheduled_at !== undefined) updateData.scheduled_at = body.scheduled_at
  if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes
  if (body.status !== undefined) updateData.status = body.status
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.total_amount !== undefined) updateData.total_amount = body.total_amount

  const { data: appointment, error } = await supabase
    .from('pet_appointments')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, scheduled_at, duration_minutes, status, notes, total_amount, created_at, updated_at,
      pets(id, name, species),
      services(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!appointment) {
    return NextResponse.json({ error: 'Pet appointment not found' }, { status: 404 })
  }

  return NextResponse.json(appointment)
}

/**
 * DELETE /api/pet-appointments/:id
 *
 * Delete a pet appointment.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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

  const { error } = await supabase
    .from('pet_appointments')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
