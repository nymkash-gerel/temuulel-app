import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createStockTransferSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/stock-transfers
 *
 * List stock transfers for the store. Supports filtering by status.
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

  const validStatuses = ['pending', 'in_transit', 'received', 'cancelled'] as const

  let query = supabase
    .from('stock_transfers')
    .select(`
      id, store_id, from_location_id, to_location_id, status, initiated_by,
      notes, created_at, updated_at,
      transfer_items(id, product_id, quantity, received_quantity)
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
 * POST /api/stock-transfers
 *
 * Create a new stock transfer with line items.
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

  const { data: body, error: validationError } = await validateBody(request, createStockTransferSchema)
  if (validationError) return validationError

  // Create the transfer
  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .insert({
      store_id: store.id,
      from_location_id: body.from_location_id || null,
      to_location_id: body.to_location_id || null,
      initiated_by: body.initiated_by || null,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (transferError || !transfer) {
    return NextResponse.json({ error: transferError?.message || 'Failed to create transfer' }, { status: 500 })
  }

  // Create transfer items
  const itemsToInsert = body.items.map((item: { product_id: string; quantity: number }) => ({
    transfer_id: transfer.id,
    product_id: item.product_id,
    quantity: item.quantity,
  }))

  const { error: itemsError } = await supabase
    .from('transfer_items')
    .insert(itemsToInsert)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Re-fetch with items
  const { data: result, error: fetchError } = await supabase
    .from('stock_transfers')
    .select(`
      id, store_id, from_location_id, to_location_id, status, initiated_by,
      notes, created_at, updated_at,
      transfer_items(id, product_id, quantity, received_quantity)
    `)
    .eq('id', transfer.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(result, { status: 201 })
}
