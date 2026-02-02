import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { parsePagination } from '@/lib/validations'
import { z } from 'zod'

/**
 * GET /api/processing
 *
 * Fetch laundry orders currently in processing states.
 * Provides a processing view over laundry orders with status in
 * ('processing', 'washing', 'drying', 'ironing').
 * Supports filtering by machine_id and status.
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

  const processingStatuses = ['processing', 'washing', 'drying', 'ironing'] as const

  let query = supabase
    .from('laundry_orders')
    .select(`
      id, order_number, status, total_items, total_amount, rush_order, notes, created_at, updated_at,
      laundry_items(id, item_type, service_type, quantity),
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && processingStatuses.includes(status as typeof processingStatuses[number])) {
    query = query.eq('status', status as typeof processingStatuses[number])
  } else {
    query = query.in('status', [...processingStatuses])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

const updateProcessingSchema = z.object({
  order_id: z.string().uuid(),
  status: z.enum(['processing', 'washing', 'drying', 'ironing', 'ready']),
})

/**
 * POST /api/processing
 *
 * Update a laundry order's status to the next processing step.
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

  let body: z.infer<typeof updateProcessingSchema>
  try {
    const raw = await request.json()
    body = updateProcessingSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Validate the order belongs to this store
  const { data: existingOrder, error: fetchError } = await supabase
    .from('laundry_orders')
    .select('id, status')
    .eq('id', body.order_id)
    .eq('store_id', store.id)
    .single()

  if (fetchError || !existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from('laundry_orders')
    .update({ status: body.status })
    .eq('id', body.order_id)
    .eq('store_id', store.id)
    .select(`
      id, order_number, status, total_items, total_amount, rush_order, notes, created_at, updated_at,
      laundry_items(id, item_type, service_type, quantity),
      customers(id, name)
    `)
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updatedOrder)
}
