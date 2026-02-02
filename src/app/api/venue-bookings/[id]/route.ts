import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateVenueBookingSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/venue-bookings/:id
 *
 * Get a single venue booking by id with venue and customer joins.
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

  const { data: booking, error } = await supabase
    .from('venue_bookings')
    .select(`
      id, venue_id, customer_id, event_type, start_at, end_at, guests_count, total_amount, deposit_amount,
      special_requests, status, created_at, updated_at,
      venues(id, name),
      customers(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Venue booking not found' }, { status: 404 })
  }

  return NextResponse.json(booking)
}

/**
 * PATCH /api/venue-bookings/:id
 *
 * Update a venue booking.
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

  const { data: body, error: validationError } = await validateBody(request, updateVenueBookingSchema)
  if (validationError) return validationError

  const { data: booking, error } = await supabase
    .from('venue_bookings')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
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

  if (!booking) {
    return NextResponse.json({ error: 'Venue booking not found' }, { status: 404 })
  }

  return NextResponse.json(booking)
}

/**
 * DELETE /api/venue-bookings/:id
 *
 * Delete a venue booking.
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
    .from('venue_bookings')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
