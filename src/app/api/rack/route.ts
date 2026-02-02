import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parsePagination } from '@/lib/validations'
import { z } from 'zod'

/**
 * GET /api/rack
 *
 * List rack locations for the store. Supports filtering by status and order_id.
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
  const orderId = searchParams.get('order_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['available', 'occupied', 'reserved'] as const

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

  if (orderId) {
    query = query.eq('order_id', orderId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

const createRackSchema = z.object({
  rack_number: z.string().min(1),
  order_id: z.string().uuid().optional(),
})

/**
 * POST /api/rack
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

  let body: z.infer<typeof createRackSchema>
  try {
    const raw = await request.json()
    body = createRackSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: rack, error } = await supabase
    .from('rack_locations')
    .insert({
      store_id: store.id,
      rack_number: body.rack_number,
      order_id: body.order_id || null,
      status: 'available',
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
