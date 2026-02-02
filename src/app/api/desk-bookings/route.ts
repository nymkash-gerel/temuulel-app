import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createDeskBookingSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/desk-bookings
 *
 * List desk bookings for the store. Supports filtering by status, space_id, booking_date.
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
  const spaceId = searchParams.get('space_id')
  const bookingDate = searchParams.get('booking_date')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] as const

  let query = supabase
    .from('desk_bookings')
    .select(`
      id, space_id, customer_id, booking_date, start_time, end_time, total_amount, status, notes, created_at, updated_at,
      coworking_spaces(id, name, space_type),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (spaceId) {
    query = query.eq('space_id', spaceId)
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
 * POST /api/desk-bookings
 *
 * Create a new desk booking. Verifies space_id belongs to the store.
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

  const { data: body, error: validationError } = await validateBody(request, createDeskBookingSchema)
  if (validationError) return validationError

  // Verify space belongs to store
  const { data: space } = await supabase
    .from('coworking_spaces')
    .select('id')
    .eq('id', body.space_id)
    .eq('store_id', store.id)
    .single()

  if (!space) {
    return NextResponse.json({ error: 'Coworking space not found' }, { status: 404 })
  }

  const { data: booking, error } = await supabase
    .from('desk_bookings')
    .insert({
      store_id: store.id,
      space_id: body.space_id,
      customer_id: body.customer_id || null,
      booking_date: body.booking_date,
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      total_amount: body.total_amount || undefined,
      status: 'confirmed',
      notes: body.notes || null,
    })
    .select(`
      id, space_id, customer_id, booking_date, start_time, end_time, total_amount, status, notes, created_at, updated_at,
      coworking_spaces(id, name, space_type),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(booking, { status: 201 })
}
