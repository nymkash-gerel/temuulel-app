import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createVenueBookingSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/venue-bookings
 *
 * List venue bookings for the store. Supports filtering by status, event_type, and venue_id.
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
  const eventType = searchParams.get('event_type')
  const venueId = searchParams.get('venue_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const

  let query = supabase
    .from('venue_bookings')
    .select(`
      id, venue_id, customer_id, event_type, start_at, end_at, guests_count, total_amount, deposit_amount,
      special_requests, status, created_at, updated_at,
      venues(id, name),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (eventType) {
    query = query.eq('event_type', eventType)
  }

  if (venueId) {
    query = query.eq('venue_id', venueId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/venue-bookings
 *
 * Create a new venue booking. Verifies venue_id belongs to the store.
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

  const { data: body, error: validationError } = await validateBody(request, createVenueBookingSchema)
  if (validationError) return validationError

  // Verify venue belongs to store
  const { data: venue } = await supabase
    .from('venues')
    .select('id')
    .eq('id', body.venue_id)
    .eq('store_id', store.id)
    .single()

  if (!venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
  }

  const { data: booking, error } = await supabase
    .from('venue_bookings')
    .insert({
      store_id: store.id,
      venue_id: body.venue_id,
      customer_id: body.customer_id || null,
      event_type: body.event_type || undefined,
      start_at: body.start_at,
      end_at: body.end_at,
      guests_count: body.guests_count || null,
      total_amount: body.total_amount || undefined,
      deposit_amount: body.deposit_amount || null,
      special_requests: body.special_requests || null,
    })
    .select(`
      id, venue_id, customer_id, event_type, start_at, end_at, guests_count, total_amount, deposit_amount,
      special_requests, status, created_at, updated_at,
      venues(id, name),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(booking, { status: 201 })
}
