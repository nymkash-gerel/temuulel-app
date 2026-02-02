import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateStockTransferSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/stock-transfers/:id
 *
 * Get a single stock transfer by id with transfer items.
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

  const { data: transfer, error } = await supabase
    .from('stock_transfers')
    .select(`
      id, store_id, from_location_id, to_location_id, status, initiated_by,
      notes, created_at, updated_at,
      transfer_items(id, product_id, quantity, received_quantity)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !transfer) {
    return NextResponse.json({ error: 'Stock transfer not found' }, { status: 404 })
  }

  return NextResponse.json(transfer)
}

/**
 * PATCH /api/stock-transfers/:id
 *
 * Update a stock transfer status.
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

  const { data: body, error: validationError } = await validateBody(request, updateStockTransferSchema)
  if (validationError) return validationError

  const { data: transfer, error } = await supabase
    .from('stock_transfers')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, store_id, from_location_id, to_location_id, status, initiated_by,
      notes, created_at, updated_at,
      transfer_items(id, product_id, quantity, received_quantity)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!transfer) {
    return NextResponse.json({ error: 'Stock transfer not found' }, { status: 404 })
  }

  return NextResponse.json(transfer)
}
