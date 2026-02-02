import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateEventBookingSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/event-bookings/:id
 *
 * Get a single event booking by id, including event_timeline milestones.
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
    .from('event_bookings')
    .select(`
      id, customer_id, customer_name, customer_phone, customer_email,
      event_type, event_date, event_start_time, event_end_time,
      guest_count, venue_resource_id, status, budget_estimate,
      quoted_amount, final_amount, special_requirements, menu_selection, setup_notes,
      created_at, updated_at,
      event_timeline(id, milestone_type, scheduled_at, completed_at, notes, created_at)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !booking) {
    return NextResponse.json({ error: 'Event booking not found' }, { status: 404 })
  }

  return NextResponse.json(booking)
}

/**
 * PATCH /api/event-bookings/:id
 *
 * Update an event booking.
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

  const { data: body, error: validationError } = await validateBody(request, updateEventBookingSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.quoted_amount !== undefined) updateData.quoted_amount = body.quoted_amount
  if (body.final_amount !== undefined) updateData.final_amount = body.final_amount
  if (body.special_requirements !== undefined) updateData.special_requirements = body.special_requirements
  if (body.menu_selection !== undefined) updateData.menu_selection = body.menu_selection as Json
  if (body.setup_notes !== undefined) updateData.setup_notes = body.setup_notes
  if (body.guest_count !== undefined) updateData.guest_count = body.guest_count

  const { data: booking, error } = await supabase
    .from('event_bookings')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, customer_id, customer_name, customer_phone, customer_email,
      event_type, event_date, event_start_time, event_end_time,
      guest_count, venue_resource_id, status, budget_estimate,
      quoted_amount, final_amount, special_requirements, menu_selection, setup_notes,
      created_at, updated_at,
      event_timeline(id, milestone_type, scheduled_at, completed_at, notes, created_at)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!booking) {
    return NextResponse.json({ error: 'Event booking not found' }, { status: 404 })
  }

  return NextResponse.json(booking)
}
