import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createLaundryOrderSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/laundry-orders
 *
 * List laundry orders for the store. Supports filtering by status, customer_id.
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
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['received', 'processing', 'washing', 'drying', 'ironing', 'ready', 'delivered', 'cancelled'] as const

  let query = supabase
    .from('laundry_orders')
    .select(`
      id, customer_id, order_number, status, total_items, total_amount, paid_amount, rush_order, pickup_date, notes, created_at, updated_at,
      customers(id, name, phone),
      laundry_items(id, item_type, service_type, quantity, unit_price)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/laundry-orders
 *
 * Create a new laundry order with items.
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

  const { data: body, error: validationError } = await validateBody(request, createLaundryOrderSchema)
  if (validationError) return validationError

  // Calculate total_items and total_amount from items
  const totalItems = body.items.reduce(
    (sum: number, item: { quantity?: number }) => sum + (item.quantity || 1),
    0
  )
  const totalAmount = body.items.reduce(
    (sum: number, item: { quantity?: number; unit_price: number }) => sum + (item.quantity || 1) * item.unit_price,
    0
  )

  // Insert laundry order
  const { data: order, error: orderError } = await supabase
    .from('laundry_orders')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      order_number: body.order_number,
      status: 'received',
      total_items: totalItems,
      total_amount: totalAmount,
      paid_amount: 0,
      rush_order: body.rush_order || false,
      pickup_date: body.pickup_date || null,
      notes: body.notes || null,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Failed to create laundry order' }, { status: 500 })
  }

  // Insert laundry items
  const itemsToInsert = body.items.map((item: { item_type: string; service_type?: string; quantity?: number; unit_price: number; notes?: string }) => ({
    order_id: order.id,
    item_type: item.item_type,
    service_type: item.service_type || 'wash_fold',
    quantity: item.quantity || 1,
    unit_price: item.unit_price,
    notes: item.notes || null,
  }))

  const { error: itemsError } = await supabase
    .from('laundry_items')
    .insert(itemsToInsert)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Fetch the complete laundry order with joins
  const { data: fullOrder, error: fetchError } = await supabase
    .from('laundry_orders')
    .select(`
      id, customer_id, order_number, status, total_items, total_amount, paid_amount, rush_order, pickup_date, notes, created_at, updated_at,
      customers(id, name, phone),
      laundry_items(id, item_type, service_type, quantity, unit_price)
    `)
    .eq('id', order.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(fullOrder, { status: 201 })
}
