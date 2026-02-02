import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPetAppointmentSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/pet-appointments
 *
 * List pet appointments for the authenticated user's store.
 * Supports filtering by pet_id and status.
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
  const petId = searchParams.get('pet_id')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('pet_appointments')
    .select(`
      id, scheduled_at, duration_minutes, status, notes, total_amount, created_at, updated_at,
      pets(id, name, species),
      services(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('scheduled_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (petId) {
    query = query.eq('pet_id', petId)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/pet-appointments
 *
 * Create a new pet appointment for the store.
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

  const { data: body, error: validationError } = await validateBody(request, createPetAppointmentSchema)
  if (validationError) return validationError

  const { data: appointment, error } = await supabase
    .from('pet_appointments')
    .insert({
      store_id: store.id,
      pet_id: body.pet_id,
      service_id: body.service_id || null,
      staff_id: body.staff_id || null,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes || undefined,
      status: 'scheduled' as const,
      notes: body.notes || null,
      total_amount: body.total_amount || null,
    })
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

  return NextResponse.json(appointment, { status: 201 })
}
