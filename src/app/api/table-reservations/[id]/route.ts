import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateTableReservationSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/table-reservations/[id]
 *
 * Get a single table reservation with table and customer info.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
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

  const { data, error } = await supabase
    .from('table_reservations')
    .select(`
      *,
      table_layouts(id, name, section, capacity, shape),
      customers(id, name, phone, email)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/table-reservations/[id]
 *
 * Update a table reservation.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
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

  const { data: body, error: validationError } = await validateBody(request, updateTableReservationSchema)
  if (validationError) return validationError

  // If changing table, verify new table belongs to store
  if (body.table_id) {
    const { data: table } = await supabase
      .from('table_layouts')
      .select('id')
      .eq('id', body.table_id)
      .eq('store_id', store.id)
      .single()

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 })
    }
  }

  const { data: item, error } = await supabase
    .from('table_reservations')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, party_size, reservation_time, duration_minutes,
      status, notes, created_at, updated_at,
      table_layouts(id, name, section),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!item) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  return NextResponse.json(item)
}

/**
 * DELETE /api/table-reservations/[id]
 *
 * Delete a table reservation.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
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
    .from('table_reservations')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
