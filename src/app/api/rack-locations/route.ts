import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parsePagination } from '@/lib/validations'

/**
 * GET /api/rack-locations
 *
 * List rack locations for the store. Supports filtering by status.
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

  const validStatuses = ['empty', 'occupied', 'reserved'] as const

  let query = supabase
    .from('rack_locations')
    .select(`
      id, rack_number, order_id, status, created_at, updated_at,
      laundry_orders(id, order_number, status)
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
 * POST /api/rack-locations
 *
 * Create a new rack location.
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

  const body = await request.json()

  if (!body.rack_number || typeof body.rack_number !== 'string') {
    return NextResponse.json({ error: 'rack_number is required and must be a string' }, { status: 400 })
  }

  const { data: rack, error } = await supabase
    .from('rack_locations')
    .insert({
      store_id: store.id,
      rack_number: body.rack_number,
      status: 'empty',
    })
    .select(`
      id, rack_number, order_id, status, created_at, updated_at,
      laundry_orders(id, order_number, status)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(rack, { status: 201 })
}
