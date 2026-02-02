import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createBookingItemSchema, parsePagination } from '@/lib/validations'
import { checkConflicts } from '@/lib/booking-conflict'

/**
 * GET /api/booking-items
 *
 * List booking items for the store.
 * Supports filtering by appointment_id, staff_id, resource_id, status.
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
  const appointmentId = searchParams.get('appointment_id')
  const staffId = searchParams.get('staff_id')
  const resourceId = searchParams.get('resource_id')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('booking_items')
    .select(`
      id, appointment_id, service_id, variation_id, staff_id, resource_id,
      start_at, end_at, price, status, notes, created_at, updated_at,
      services(id, name),
      staff(id, name),
      bookable_resources(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('start_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (appointmentId) {
    query = query.eq('appointment_id', appointmentId)
  }
  if (staffId) {
    query = query.eq('staff_id', staffId)
  }
  if (resourceId) {
    query = query.eq('resource_id', resourceId)
  }
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/booking-items
 *
 * Create a new booking item with conflict detection.
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

  const { data: body, error: validationError } = await validateBody(request, createBookingItemSchema)
  if (validationError) return validationError

  // Validate end_at > start_at
  if (new Date(body.end_at) <= new Date(body.start_at)) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 })
  }

  // Verify appointment belongs to store
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id')
    .eq('id', body.appointment_id)
    .eq('store_id', store.id)
    .single()

  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  // Check for conflicts
  const conflictResult = await checkConflicts(supabase, {
    storeId: store.id,
    staffId: body.staff_id || undefined,
    resourceId: body.resource_id || undefined,
    startAt: body.start_at,
    endAt: body.end_at,
  })

  if (conflictResult.hasConflict) {
    return NextResponse.json({
      error: 'Scheduling conflict detected',
      conflicts: conflictResult.conflicts,
    }, { status: 409 })
  }

  const { data: item, error } = await supabase
    .from('booking_items')
    .insert({
      store_id: store.id,
      appointment_id: body.appointment_id,
      service_id: body.service_id || null,
      variation_id: body.variation_id || null,
      staff_id: body.staff_id || null,
      resource_id: body.resource_id || null,
      start_at: body.start_at,
      end_at: body.end_at,
      price: body.price,
      status: body.status,
      notes: body.notes || null,
    })
    .select(`
      id, appointment_id, service_id, variation_id, staff_id, resource_id,
      start_at, end_at, price, status, notes, created_at, updated_at,
      services(id, name),
      staff(id, name),
      bookable_resources(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(item, { status: 201 })
}
