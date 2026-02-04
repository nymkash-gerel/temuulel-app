import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createKdsTicketSchema, parsePagination } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

/**
 * GET /api/kds-tickets
 *
 * List KDS tickets for the store. Supports filtering by status.
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
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['new', 'preparing', 'ready', 'served', 'cancelled'] as const

  let query = supabase
    .from('kds_tickets')
    .select(`
      id, station_id, order_id, table_session_id, items, priority, status,
      started_at, completed_at, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/kds-tickets
 *
 * Create a new KDS ticket.
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

  const { data: body, error: validationError } = await validateBody(request, createKdsTicketSchema)
  if (validationError) return validationError

  const { data: ticket, error } = await supabase
    .from('kds_tickets')
    .insert({
      store_id: store.id,
      station_id: body.station_id || null,
      order_id: body.order_id || null,
      table_session_id: body.table_session_id || null,
      items: toJson(body.items || []),
      priority: body.priority ?? 0,
    })
    .select(`
      id, station_id, order_id, table_session_id, items, priority, status,
      started_at, completed_at, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: ticket }, { status: 201 })
}
