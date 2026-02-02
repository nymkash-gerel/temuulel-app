import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateReservationSchema } from '@/lib/validations'
import { validateTransition, reservationTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/reservations/:id
 *
 * Get a single reservation by id with unit and guest joins.
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

  const { data: reservation, error } = await supabase
    .from('reservations')
    .select(`
      id, unit_id, guest_id, check_in, check_out, actual_check_in, actual_check_out, adults, children,
      rate_per_night, total_amount, deposit_amount, deposit_status, status, source, special_requests,
      created_at, updated_at,
      units(id, unit_number, unit_type),
      guests(id, first_name, last_name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  return NextResponse.json(reservation)
}

/**
 * PATCH /api/reservations/:id
 *
 * Update a reservation. Supports status transitions with auto-setting
 * actual_check_in/actual_check_out timestamps.
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

  const { data: body, error: validationError } = await validateBody(request, updateReservationSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.actual_check_in !== undefined) updateData.actual_check_in = body.actual_check_in
  if (body.actual_check_out !== undefined) updateData.actual_check_out = body.actual_check_out
  if (body.deposit_status !== undefined) updateData.deposit_status = body.deposit_status
  if (body.special_requests !== undefined) updateData.special_requests = body.special_requests

  // Validate status transition
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('reservations')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
    }

    const result = validateTransition(reservationTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    updateData.status = body.status
  }

  // Auto-set actual_check_in when status changes to 'checked_in' (if not provided)
  if (body.status === 'checked_in' && body.actual_check_in === undefined) {
    updateData.actual_check_in = new Date().toISOString()
  }

  // Auto-set actual_check_out when status changes to 'checked_out' (if not provided)
  if (body.status === 'checked_out' && body.actual_check_out === undefined) {
    updateData.actual_check_out = new Date().toISOString()
  }

  const { data: reservation, error } = await supabase
    .from('reservations')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, unit_id, guest_id, check_in, check_out, actual_check_in, actual_check_out, adults, children,
      rate_per_night, total_amount, deposit_amount, deposit_status, status, source, special_requests,
      created_at, updated_at,
      units(id, unit_number, unit_type),
      guests(id, first_name, last_name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  return NextResponse.json(reservation)
}
