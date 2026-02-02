import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTableReservationSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/table-reservations
 *
 * List table reservations for the authenticated user's store.
 * Supports filtering by table_id, customer_id, status, and reservation_time date range.
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
  const tableId = searchParams.get('table_id')
  const customerId = searchParams.get('customer_id')
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('table_reservations')
    .select(`
      id, party_size, reservation_time, duration_minutes,
      status, notes, created_at, updated_at,
      table_layouts(id, name, section),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('reservation_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tableId) {
    query = query.eq('table_id', tableId)
  }
  if (customerId) {
    query = query.eq('customer_id', customerId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (dateFrom) {
    query = query.gte('reservation_time', dateFrom)
  }
  if (dateTo) {
    query = query.lte('reservation_time', dateTo)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/table-reservations
 *
 * Create a new table reservation.
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

  const { data: body, error: validationError } = await validateBody(request, createTableReservationSchema)
  if (validationError) return validationError

  // Verify table belongs to store
  const { data: table } = await supabase
    .from('table_layouts')
    .select('id')
    .eq('id', body.table_id)
    .eq('store_id', store.id)
    .single()

  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  const { data: item, error } = await supabase
    .from('table_reservations')
    .insert({
      store_id: store.id,
      table_id: body.table_id,
      customer_id: body.customer_id || null,
      party_size: body.party_size || undefined,
      reservation_time: body.reservation_time,
      duration_minutes: body.duration_minutes || undefined,
      notes: body.notes || null,
      status: 'confirmed',
    })
    .select(`
      id, party_size, reservation_time, duration_minutes,
      status, notes, created_at,
      table_layouts(id, name, section),
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
