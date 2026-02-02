import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { dispatchNotification } from '@/lib/notifications'

/**
 * POST /api/webhook/delivery
 *
 * External delivery provider callback endpoint.
 * Providers (e.g. HiDel, Delko) call this to update delivery status.
 *
 * Expected payload:
 * {
 *   store_id: string,
 *   provider_tracking_id: string,
 *   status: 'picked_up' | 'in_transit' | 'delivered' | 'failed' | 'delayed',
 *   failure_reason?: string,
 *   notes?: string,
 *   location?: { lat: number, lng: number },
 *   proof_photo_url?: string,
 * }
 *
 * Authentication: X-Webhook-Secret header must match the store's webhook_secret.
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const supabase = createClient(url, key)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { store_id, provider_tracking_id, status, failure_reason, notes, location, proof_photo_url } = body as {
    store_id?: string
    provider_tracking_id?: string
    status?: string
    failure_reason?: string
    notes?: string
    location?: { lat: number; lng: number }
    proof_photo_url?: string
  }

  if (!store_id || !provider_tracking_id || !status) {
    return NextResponse.json({ error: 'Missing required fields: store_id, provider_tracking_id, status' }, { status: 400 })
  }

  const validStatuses = ['picked_up', 'in_transit', 'delivered', 'failed', 'delayed']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  // Verify store and webhook secret
  const { data: store } = await supabase
    .from('stores')
    .select('id, webhook_secret')
    .eq('id', store_id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Authenticate via webhook secret
  const secret = request.headers.get('x-webhook-secret')
  if (store.webhook_secret && secret !== store.webhook_secret) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
  }

  // Find delivery by provider tracking ID
  const { data: deliveryRaw } = await supabase
    .from('deliveries')
    .select('id, delivery_number, status, driver_id, order_id')
    .eq('store_id', store_id)
    .eq('provider_tracking_id', provider_tracking_id)
    .single()

  if (!deliveryRaw) {
    return NextResponse.json({ error: 'Delivery not found for this tracking ID' }, { status: 404 })
  }

  // Fetch related names
  const [driverRes, orderRes] = await Promise.all([
    deliveryRaw.driver_id
      ? supabase.from('delivery_drivers').select('name').eq('id', deliveryRaw.driver_id).single()
      : Promise.resolve({ data: null }),
    deliveryRaw.order_id
      ? supabase.from('orders').select('order_number').eq('id', deliveryRaw.order_id).single()
      : Promise.resolve({ data: null }),
  ])

  const delivery = {
    ...deliveryRaw,
    driver_name: driverRes.data?.name || '',
    order_number: orderRes.data?.order_number || '',
  }

  // Update delivery status
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (status === 'delivered') updateData.actual_delivery_time = now
  if (status === 'failed' && failure_reason) updateData.failure_reason = failure_reason
  if (proof_photo_url) updateData.proof_photo_url = proof_photo_url

  const { error: updateError } = await supabase
    .from('deliveries')
    .update(updateData)
    .eq('id', delivery.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Log status change
  await supabase.from('delivery_status_log').insert({
    delivery_id: delivery.id,
    status,
    changed_by: `provider`,
    notes: notes || null,
    location: location || null,
  })

  // Update order status if delivered
  if (status === 'delivered' && delivery.order_id) {
    await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', delivery.order_id)
  }

  // Dispatch notification
  const eventMap: Record<string, 'delivery_picked_up' | 'delivery_completed' | 'delivery_failed' | 'delivery_delayed'> = {
    picked_up: 'delivery_picked_up',
    delivered: 'delivery_completed',
    failed: 'delivery_failed',
    delayed: 'delivery_delayed',
  }

  const notifEvent = eventMap[status]
  if (notifEvent) {
    const driverName = delivery.driver_name
    const orderNumber = delivery.order_number

    dispatchNotification(store_id, notifEvent, {
      delivery_id: delivery.id,
      delivery_number: delivery.delivery_number,
      driver_name: driverName,
      order_number: orderNumber,
      failure_reason: failure_reason || '',
      notes: notes || '',
    })
  }

  return NextResponse.json({ success: true, delivery_id: delivery.id, status })
}
