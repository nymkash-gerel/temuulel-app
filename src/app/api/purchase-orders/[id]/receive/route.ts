import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, receivePurchaseOrderItemSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/purchase-orders/:id/receive
 *
 * Receive items for a purchase order.
 * Updates quantity_received on the PO item, creates an inventory movement,
 * and auto-updates PO status based on whether all items are fully received.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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

  // Verify purchase order belongs to store
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  const { data: body, error: validationError } = await validateBody(request, receivePurchaseOrderItemSchema)
  if (validationError) return validationError

  // Fetch the PO item
  const { data: poItem } = await supabase
    .from('purchase_order_items')
    .select('id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost')
    .eq('id', body.item_id)
    .eq('purchase_order_id', id)
    .single()

  if (!poItem) {
    return NextResponse.json({ error: 'Purchase order item not found' }, { status: 404 })
  }

  const newQuantityReceived = (poItem.quantity_received || 0) + body.quantity_received

  // Update quantity_received on the PO item
  const { error: updateItemError } = await supabase
    .from('purchase_order_items')
    .update({ quantity_received: newQuantityReceived })
    .eq('id', body.item_id)

  if (updateItemError) {
    return NextResponse.json({ error: updateItemError.message }, { status: 500 })
  }

  // Create inventory movement record
  const { error: movementError } = await supabase
    .from('inventory_movements')
    .insert({
      store_id: store.id,
      product_id: poItem.product_id,
      variant_id: poItem.variant_id || null,
      movement_type: 'received',
      quantity: body.quantity_received,
      reference_type: 'purchase_order',
      reference_id: id,
      unit_cost: poItem.unit_cost || null,
      notes: `Received from PO ${id}`,
    })

  if (movementError) {
    return NextResponse.json({ error: movementError.message }, { status: 500 })
  }

  // Check if all items are fully received to auto-update PO status
  const { data: allItems } = await supabase
    .from('purchase_order_items')
    .select('quantity_ordered, quantity_received')
    .eq('purchase_order_id', id)

  let newStatus: string = 'partially_received'
  if (allItems && allItems.length > 0) {
    const allFullyReceived = allItems.every(
      (item) => (item.quantity_received || 0) >= item.quantity_ordered
    )
    if (allFullyReceived) {
      newStatus = 'received'
    }
  }

  const { error: updatePoError } = await supabase
    .from('purchase_orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === 'received' ? { received_date: new Date().toISOString() } : {}),
    })
    .eq('id', id)

  if (updatePoError) {
    return NextResponse.json({ error: updatePoError.message }, { status: 500 })
  }

  // Fetch the updated PO with items
  const { data: updatedPo, error: fetchError } = await supabase
    .from('purchase_orders')
    .select(`
      id, supplier_id, po_number, status, total_amount, expected_date, received_date, notes, created_at, updated_at,
      suppliers(id, name),
      purchase_order_items(id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost)
    `)
    .eq('id', id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(updatedPo)
}
