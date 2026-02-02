import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePurchaseOrderSchema } from '@/lib/validations'
import { validateTransition, purchaseOrderTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/purchase-orders/:id
 *
 * Get a single purchase order by id, including supplier and items.
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

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select(`
      id, supplier_id, po_number, status, total_amount, expected_date, received_date, notes, created_at, updated_at,
      suppliers(id, name),
      purchase_order_items(id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  return NextResponse.json(po)
}

/**
 * PATCH /api/purchase-orders/:id
 *
 * Update a purchase order (status, expected_date, received_date, notes).
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

  const { data: body, error: validationError } = await validateBody(request, updatePurchaseOrderSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.expected_date !== undefined) updateData.expected_date = body.expected_date
  if (body.received_date !== undefined) updateData.received_date = body.received_date
  if (body.notes !== undefined) updateData.notes = body.notes

  // Validate status transition
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('purchase_orders')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const result = validateTransition(purchaseOrderTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    updateData.status = body.status
    if (body.status === 'received') updateData.received_date = updateData.received_date || new Date().toISOString()
  }

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, supplier_id, po_number, status, total_amount, expected_date, received_date, notes, created_at, updated_at,
      suppliers(id, name),
      purchase_order_items(id, product_id, variant_id, quantity_ordered, quantity_received, unit_cost)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  return NextResponse.json(po)
}
