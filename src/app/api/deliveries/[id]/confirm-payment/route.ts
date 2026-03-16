/**
 * POST /api/deliveries/[id]/confirm-payment
 *
 * Store owner manually confirms they have received pre-payment for an order.
 * Sets order.payment_status = 'paid'.
 * For intercity orders, this unblocks driver assignment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveStoreId } from '@/lib/resolve-store'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deliveryId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const store = { id: storeId }

  // Fetch delivery + linked order
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, order_id, delivery_type, store_id')
    .eq('id', deliveryId)
    .eq('store_id', store.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  if (!delivery.order_id) return NextResponse.json({ error: 'No order linked' }, { status: 400 })

  // Update order payment status to paid
  const { error } = await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_method: 'manual_confirmed',
    })
    .eq('id', delivery.order_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, order_id: delivery.order_id })
}
