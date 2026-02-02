import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createClassBookingSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/class-bookings
 *
 * List class bookings for the store. Supports filtering by class_id, customer_id, status, booking_date.
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
  const classId = searchParams.get('class_id')
  const customerId = searchParams.get('customer_id')
  const status = searchParams.get('status')
  const bookingDate = searchParams.get('booking_date')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['booked', 'attended', 'cancelled', 'no_show'] as const

  let query = supabase
    .from('class_bookings')
    .select(`
      id, class_id, customer_id, booking_date, status, notes, created_at, updated_at,
      fitness_classes(id, name, class_type),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('booking_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (classId) {
    query = query.eq('class_id', classId)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (bookingDate) {
    query = query.eq('booking_date', bookingDate)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/class-bookings
 *
 * Create a new class booking. Verifies class_id belongs to the store.
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

  const { data: body, error: validationError } = await validateBody(request, createClassBookingSchema)
  if (validationError) return validationError

  const { data: fitnessClass } = await supabase
    .from('fitness_classes')
    .select('id')
    .eq('id', body.class_id)
    .eq('store_id', store.id)
    .single()

  if (!fitnessClass) {
    return NextResponse.json({ error: 'Fitness class not found' }, { status: 404 })
  }

  const { data: booking, error } = await supabase
    .from('class_bookings')
    .insert({
      store_id: store.id,
      class_id: body.class_id,
      customer_id: body.customer_id || null,
      booking_date: body.booking_date,
      status: body.status || undefined,
      notes: body.notes || null,
    })
    .select(`
      id, class_id, customer_id, booking_date, status, notes, created_at, updated_at,
      fitness_classes(id, name, class_type),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: booking }, { status: 201 })
}
