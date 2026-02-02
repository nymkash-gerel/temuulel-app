import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTableSessionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/table-sessions
 *
 * List table sessions for the store. Supports filtering by status.
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

  const validStatuses = ['active', 'closed'] as const

  let query = supabase
    .from('table_sessions')
    .select(`
      id, table_id, server_id, guest_count, seated_at, closed_at, status, notes,
      created_at, updated_at,
      table_layouts(id, name, section, capacity)
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
 * POST /api/table-sessions
 *
 * Create a new table session.
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

  const { data: body, error: validationError } = await validateBody(request, createTableSessionSchema)
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

  const { data: session, error } = await supabase
    .from('table_sessions')
    .insert({
      store_id: store.id,
      table_id: body.table_id,
      server_id: body.server_id || null,
      guest_count: body.guest_count,
      notes: body.notes || null,
    })
    .select(`
      id, table_id, server_id, guest_count, seated_at, closed_at, status, notes,
      created_at, updated_at,
      table_layouts(id, name, section, capacity)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: session }, { status: 201 })
}
