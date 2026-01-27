import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { decrementStockAndNotify } from '@/lib/stock'
import { dispatchNotification } from '@/lib/notifications'

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

/**
 * PATCH /api/orders/status
 *
 * Update an order's status. When status becomes "confirmed",
 * decrements variant stock and triggers low_stock notifications.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { order_id, status, tracking_number } = body

  if (!order_id || !status) {
    return NextResponse.json(
      { error: 'order_id and status required' },
      { status: 400 }
    )
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  // Fetch order to get current status and store_id
  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, status, order_number')
    .eq('id', order_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const previousStatus = order.status

  // Build update payload
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'shipped' && tracking_number) {
    updateData.tracking_number = tracking_number
  }

  const { data: updated, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', order_id)
    .select('id, status, tracking_number, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Decrement stock when order transitions to "confirmed"
  if (status === 'confirmed' && previousStatus !== 'confirmed') {
    await decrementStockAndNotify(supabase, order_id, order.store_id)
  }

  // Dispatch order_status notification when status changes
  if (status !== previousStatus) {
    dispatchNotification(order.store_id, 'order_status', {
      order_id: order.id,
      order_number: order.order_number,
      previous_status: previousStatus,
      new_status: status,
    })
  }

  return NextResponse.json({
    order_id: updated.id,
    status: updated.status,
    tracking_number: updated.tracking_number,
    updated_at: updated.updated_at,
  })
}
