import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { validateBody, driverUpdateStatusSchema } from '@/lib/validations'
import { dispatchNotification } from '@/lib/notifications'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const DRIVER_VALID_TRANSITIONS: Record<string, string[]> = {
  assigned: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed', 'delayed'],
  delayed: ['in_transit', 'delivered', 'failed'],
}

/**
 * GET /api/driver/deliveries/:id
 *
 * Get delivery detail for the authenticated driver.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rl = await rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  // Fetch delivery
  const { data: delivery, error: delError } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', id)
    .eq('driver_id', driver.id)
    .single()

  if (delError || !delivery) {
    return NextResponse.json({ error: 'Хүргэлт олдсонгүй' }, { status: 404 })
  }

  // Fetch related data separately
  const [orderRes, logsRes] = await Promise.all([
    delivery.order_id
      ? supabase.from('orders').select('id, order_number, total_amount, status').eq('id', delivery.order_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('delivery_status_log')
      .select('id, status, changed_by, notes, location, created_at')
      .eq('delivery_id', id)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    delivery: {
      ...delivery,
      order: orderRes.data || null,
      status_log: logsRes.data || [],
    },
  })
}

/**
 * PATCH /api/driver/deliveries/:id
 *
 * Update delivery status from the driver's perspective.
 * Only allows driver-specific transitions (no cancel/assign).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  const { data: body, error: validationError } = await validateBody(request, driverUpdateStatusSchema)
  if (validationError) return validationError

  // Fetch current delivery
  const { data: current } = await supabase
    .from('deliveries')
    .select('id, delivery_number, status, order_id, store_id')
    .eq('id', id)
    .eq('driver_id', driver.id)
    .single()

  if (!current) {
    return NextResponse.json({ error: 'Хүргэлт олдсонгүй' }, { status: 404 })
  }

  // Validate transition
  const allowed = DRIVER_VALID_TRANSITIONS[current.status]
  if (!allowed || !allowed.includes(body.status)) {
    return NextResponse.json({
      error: `${current.status} статусаас ${body.status} руу шилжих боломжгүй`,
    }, { status: 400 })
  }

  // Require failure_reason for failed status
  if (body.status === 'failed' && !body.failure_reason) {
    return NextResponse.json({
      error: 'Амжилтгүй болсон шалтгаан оруулна уу',
    }, { status: 400 })
  }

  // Update delivery
  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = {
    status: body.status,
    updated_at: now,
  }

  if (body.status === 'delivered') updateData.actual_delivery_time = now
  if (body.status === 'failed' && body.failure_reason) updateData.failure_reason = body.failure_reason
  if (body.proof_photo_url) updateData.proof_photo_url = body.proof_photo_url
  if (body.notes) updateData.notes = body.notes

  const { error: updateError } = await supabase
    .from('deliveries')
    .update(updateData)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Log status change
  await supabase.from('delivery_status_log').insert({
    delivery_id: id,
    status: body.status,
    changed_by: driver.name,
    notes: body.failure_reason || body.notes || null,
    location: body.location || null,
  })

  // Free driver on terminal statuses
  const terminalStatuses = ['delivered', 'failed']
  if (terminalStatuses.includes(body.status)) {
    // Check if driver has other active deliveries
    const { count } = await supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driver.id)
      .in('status', ['assigned', 'picked_up', 'in_transit'])
      .neq('id', id)

    if (!count || count === 0) {
      await supabase
        .from('delivery_drivers')
        .update({ status: 'active', updated_at: now })
        .eq('id', driver.id)
    }
  }

  // Update order status if delivered
  if (body.status === 'delivered' && current.order_id) {
    await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', current.order_id)
  }

  // Fetch order number for notification
  let orderNumber = ''
  if (current.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', current.order_id)
      .single()
    orderNumber = order?.order_number || ''
  }

  // Dispatch notification to store owner
  const eventMap: Record<string, 'delivery_picked_up' | 'delivery_completed' | 'delivery_failed' | 'delivery_delayed'> = {
    picked_up: 'delivery_picked_up',
    delivered: 'delivery_completed',
    failed: 'delivery_failed',
    delayed: 'delivery_delayed',
  }

  const notifEvent = eventMap[body.status]
  if (notifEvent) {
    dispatchNotification(current.store_id, notifEvent, {
      delivery_id: id,
      delivery_number: current.delivery_number,
      driver_name: driver.name,
      order_number: orderNumber,
      failure_reason: body.failure_reason || '',
      notes: body.notes || '',
    })
  }

  return NextResponse.json({ success: true, delivery_id: id, status: body.status })
}
