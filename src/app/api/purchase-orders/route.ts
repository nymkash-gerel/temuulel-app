import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPurchaseOrderSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/purchase-orders
 *
 * List purchase orders for the store. Supports filtering by status, supplier_id.
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
  const supplierId = searchParams.get('supplier_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'] as const

  let query = supabase
    .from('purchase_orders')
    .select(`
      id, supplier_id, po_number, status, total_amount, expected_date, received_date, notes, created_at, updated_at,
      suppliers(id, name),
      purchase_order_items(id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (supplierId) {
    query = query.eq('supplier_id', supplierId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/purchase-orders
 *
 * Create a new purchase order with items.
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

  const { data: body, error: validationError } = await validateBody(request, createPurchaseOrderSchema)
  if (validationError) return validationError

  // Verify supplier belongs to store
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', body.supplier_id)
    .eq('store_id', store.id)
    .single()

  if (!supplier) {
    return NextResponse.json({ error: 'Supplier not found in this store' }, { status: 404 })
  }

  // Calculate total_amount from items
  const totalAmount = body.items.reduce(
    (sum: number, item: { quantity_ordered: number; unit_cost: number }) => sum + item.quantity_ordered * item.unit_cost,
    0
  )

  // Insert purchase order
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      store_id: store.id,
      supplier_id: body.supplier_id,
      po_number: body.po_number,
      status: 'draft',
      total_amount: totalAmount,
      expected_date: body.expected_date || null,
      notes: body.notes || null,
    })
    .select('id')
    .single()

  if (poError || !po) {
    return NextResponse.json({ error: poError?.message || 'Failed to create purchase order' }, { status: 500 })
  }

  // Insert purchase order items
  const itemsToInsert = body.items.map((item: { product_id: string; variant_id?: string; quantity_ordered: number; unit_cost: number }) => ({
    purchase_order_id: po.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity_ordered: item.quantity_ordered,
    quantity_received: 0,
    unit_cost: item.unit_cost,
  }))

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Fetch the complete purchase order with joins
  const { data: fullPo, error: fetchError } = await supabase
    .from('purchase_orders')
    .select(`
      id, supplier_id, po_number, status, total_amount, expected_date, received_date, notes, created_at, updated_at,
      suppliers(id, name),
      purchase_order_items(id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost)
    `)
    .eq('id', po.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(fullPo, { status: 201 })
}
