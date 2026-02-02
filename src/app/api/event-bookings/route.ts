import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createEventBookingSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/event-bookings
 *
 * List event bookings for the store. Supports filtering by status and event_type.
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
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['inquiry', 'quoted', 'deposit_paid', 'confirmed', 'in_service', 'closed', 'cancelled'] as const
  const validEventTypes = ['wedding', 'corporate', 'birthday', 'conference', 'other'] as const

  let query = supabase
    .from('event_bookings')
    .select(`
      id, customer_id, customer_name, customer_phone, customer_email,
      event_type, event_date, event_start_time, event_end_time,
      guest_count, venue_resource_id, status, budget_estimate,
      quoted_amount, final_amount, special_requirements, menu_selection, setup_notes,
      created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('event_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (eventType && validEventTypes.includes(eventType as typeof validEventTypes[number])) {
    query = query.eq('event_type', eventType as typeof validEventTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/event-bookings
 *
 * Create a new event booking.
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

  const { data: body, error: validationError } = await validateBody(request, createEventBookingSchema)
  if (validationError) return validationError

  const { data: booking, error } = await supabase
    .from('event_bookings')
    .insert({
      store_id: store.id,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email || null,
      customer_id: body.customer_id || null,
      event_type: body.event_type || 'other',
      event_date: body.event_date,
      event_start_time: body.event_start_time || null,
      event_end_time: body.event_end_time || null,
      guest_count: body.guest_count,
      venue_resource_id: body.venue_resource_id || null,
      budget_estimate: body.budget_estimate ?? null,
      special_requirements: body.special_requirements || null,
      setup_notes: body.setup_notes || null,
      menu_selection: ({} as unknown) as Json,
    })
    .select(`
      id, customer_id, customer_name, customer_phone, customer_email,
      event_type, event_date, event_start_time, event_end_time,
      guest_count, venue_resource_id, status, budget_estimate,
      quoted_amount, final_amount, special_requirements, menu_selection, setup_notes,
      created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: booking }, { status: 201 })
}
