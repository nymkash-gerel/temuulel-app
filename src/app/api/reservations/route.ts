import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createReservationSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/reservations
 *
 * List reservations for the store. Supports filtering by status, unit_id, guest_id, date range.
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
  const unitId = searchParams.get('unit_id')
  const guestId = searchParams.get('guest_id')
  const fromDate = searchParams.get('from_date')
  const toDate = searchParams.get('to_date')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'] as const

  let query = supabase
    .from('reservations')
    .select(`
      id, unit_id, guest_id, check_in, check_out, actual_check_in, actual_check_out, adults, children,
      rate_per_night, total_amount, deposit_amount, deposit_status, status, source, special_requests,
      created_at, updated_at,
      units(id, unit_number, unit_type),
      guests(id, first_name, last_name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  if (guestId) {
    query = query.eq('guest_id', guestId)
  }

  if (fromDate) {
    query = query.gte('check_in', fromDate)
  }

  if (toDate) {
    query = query.lte('check_out', toDate)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/reservations
 *
 * Create a new reservation. Verifies unit_id and guest_id belong to the store.
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

  const { data: body, error: validationError } = await validateBody(request, createReservationSchema)
  if (validationError) return validationError

  // Verify unit belongs to store
  const { data: unit } = await supabase
    .from('units')
    .select('id')
    .eq('id', body.unit_id)
    .eq('store_id', store.id)
    .single()

  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  // Verify guest belongs to store
  const { data: guest } = await supabase
    .from('guests')
    .select('id')
    .eq('id', body.guest_id)
    .eq('store_id', store.id)
    .single()

  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      store_id: store.id,
      unit_id: body.unit_id,
      guest_id: body.guest_id,
      check_in: body.check_in,
      check_out: body.check_out,
      adults: body.adults || undefined,
      children: body.children || undefined,
      rate_per_night: body.rate_per_night,
      total_amount: body.total_amount,
      deposit_amount: body.deposit_amount || undefined,
      source: body.source || undefined,
      special_requests: body.special_requests || null,
    })
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

  return NextResponse.json(reservation, { status: 201 })
}
