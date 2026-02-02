import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateDeskBookingSchema } from '@/lib/validations'
import { validateTransition, deskBookingTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/desk-bookings/:id
 *
 * Get a single desk booking by id with coworking space and customer joins.
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
    .from('desk_bookings')
    .select(`
      id, space_id, customer_id, booking_date, start_time, end_time, total_amount, status, notes, created_at, updated_at,
      coworking_spaces(id, name, space_type),
      customers(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Desk booking not found' }, { status: 404 })
  }

  return NextResponse.json(booking)
}

/**
 * PATCH /api/desk-bookings/:id
 *
 * Update a desk booking.
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

  const { data: body, error: validationError } = await validateBody(request, updateDeskBookingSchema)
  if (validationError) return validationError

  // Validate status transition
  if (body.status) {
    const { data: current } = await supabase
      .from('desk_bookings')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Desk booking not found' }, { status: 404 })
    }

    const result = validateTransition(deskBookingTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const { data: booking, error } = await supabase
    .from('desk_bookings')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, space_id, customer_id, booking_date, start_time, end_time, total_amount, status, notes, created_at, updated_at,
      coworking_spaces(id, name, space_type),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!booking) {
    return NextResponse.json({ error: 'Desk booking not found' }, { status: 404 })
  }

  return NextResponse.json(booking)
}

/**
 * DELETE /api/desk-bookings/:id
 *
 * Delete a desk booking.
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
    .from('desk_bookings')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
