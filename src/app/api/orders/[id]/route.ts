/**
 * PATCH /api/orders/:id
 *
 * Manual order edit by store manager.
 * Updates: customer name/phone, shipping address, notes,
 *          order item quantities, shipping amount, total amount.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface EditOrderBody {
  customer_name?: string
  customer_phone?: string
  shipping_address?: string
  notes?: string
  shipping_amount?: number
  items?: { id: string; quantity: number; unit_price: number }[]
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify store ownership
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Verify order belongs to this store
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id, status')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // ── Status-based edit gating ──────────────────────────────────────────────
  const LOCKED_STATUSES   = ['picked_up', 'in_transit', 'delivered', 'failed', 'cancelled']
  const ADDRESS_ONLY_STATUSES = ['assigned', 'at_store']

  if (LOCKED_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: 'Захиалга засварлах боломжгүй — жолооч аль хэдийн авсан эсвэл дууссан байна' },
      { status: 403 }
    )
  }

  const body = await request.json() as EditOrderBody

  if (ADDRESS_ONLY_STATUSES.includes(order.status)) {
    // Partial edit only: reject item quantity or shipping amount changes
    if (body.items !== undefined || body.shipping_amount !== undefined) {
      return NextResponse.json(
        { error: 'Жолооч оноосны дараа зөвхөн хаяг болон харилцагчийн мэдээлэл засварлах боломжтой' },
        { status: 403 }
      )
    }
  }

  const now = new Date().toISOString()
  const errors: string[] = []

  // ── Update customer name/phone ────────────────────────────────────────────
  if (order.customer_id && (body.customer_name !== undefined || body.customer_phone !== undefined)) {
    const customerUpdate: Record<string, string> = {}
    if (body.customer_name !== undefined) customerUpdate.name = body.customer_name.trim()
    if (body.customer_phone !== undefined) customerUpdate.phone = body.customer_phone.trim()

    if (Object.keys(customerUpdate).length > 0) {
      const { error: custErr } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', order.customer_id)

      if (custErr) errors.push(`Customer update: ${custErr.message}`)
    }
  }

  // ── Update order item quantities ──────────────────────────────────────────
  let newSubtotal = 0
  if (body.items && body.items.length > 0) {
    for (const item of body.items) {
      if (item.quantity < 1) continue
      const { error: itemErr } = await supabase
        .from('order_items')
        .update({ quantity: item.quantity, updated_at: now })
        .eq('id', item.id)
        .eq('order_id', id)

      if (itemErr) errors.push(`Item ${item.id}: ${itemErr.message}`)
      newSubtotal += item.quantity * item.unit_price
    }
  } else {
    // Recalculate from existing items
    const { data: existingItems } = await supabase
      .from('order_items')
      .select('quantity, unit_price')
      .eq('order_id', id)
    newSubtotal = (existingItems || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  }

  // ── Update order fields ───────────────────────────────────────────────────
  const shippingAmount = body.shipping_amount ?? 0
  const orderUpdate: Record<string, unknown> = { updated_at: now }

  if (body.shipping_address !== undefined) orderUpdate.shipping_address = body.shipping_address.trim()
  if (body.notes !== undefined) orderUpdate.notes = body.notes.trim() || null
  if (body.shipping_amount !== undefined) orderUpdate.shipping_amount = shippingAmount

  // Auto-recalculate total if items or shipping changed
  if (body.items !== undefined || body.shipping_amount !== undefined) {
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('shipping_amount')
      .eq('id', id)
      .single()
    const shipping = body.shipping_amount ?? currentOrder?.shipping_amount ?? 0
    orderUpdate.total_amount = newSubtotal + shipping
  }

  const { error: orderErr } = await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', id)
    .eq('store_id', store.id)

  if (orderErr) errors.push(`Order update: ${orderErr.message}`)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
