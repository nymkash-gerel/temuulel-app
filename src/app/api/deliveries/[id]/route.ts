import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, updateDeliverySchema } from '@/lib/validations'
import { dispatchNotification } from '@/lib/notifications'
import type { Database } from '@/lib/database.types'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed', 'delayed'],
  delayed: ['in_transit', 'delivered', 'failed'],
}

/**
 * GET /api/deliveries/:id
 *
 * Get delivery detail with driver, order, and status log.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Fetch delivery and related data separately to avoid deep type instantiation
  const { data: deliveryRaw, error: delError } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (delError || !deliveryRaw) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })

  const [orderRes, driverRes, logsRes] = await Promise.all([
    deliveryRaw.order_id
      ? supabase.from('orders').select('id, order_number, total_amount, status, customer_id').eq('id', deliveryRaw.order_id).single()
      : Promise.resolve({ data: null }),
    deliveryRaw.driver_id
      ? supabase.from('delivery_drivers').select('id, name, phone, vehicle_type, vehicle_number, status').eq('id', deliveryRaw.driver_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('delivery_status_log')
      .select('id, status, changed_by, notes, location, created_at')
      .eq('delivery_id', id)
      .order('created_at', { ascending: false }),
  ])

  const delivery = {
    ...deliveryRaw,
    orders: orderRes.data || null,
    delivery_drivers: driverRes.data || null,
    delivery_status_log: logsRes.data || [],
  }

  return NextResponse.json({ delivery })
}

/**
 * PATCH /api/deliveries/:id
 *
 * Update delivery: change status, assign driver, update details.
 * Status transitions are validated. Notifications dispatched on status changes.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, updateDeliverySchema)
  if (validationError) return validationError

  // Fetch current delivery + related data
  const { data: currentRaw } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!currentRaw) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })

  // Fetch driver and order info separately for notification data
  const [driverRes, orderRes] = await Promise.all([
    currentRaw.driver_id
      ? supabase.from('delivery_drivers').select('id, name').eq('id', currentRaw.driver_id).single()
      : Promise.resolve({ data: null }),
    currentRaw.order_id
      ? supabase.from('orders').select('id, order_number').eq('id', currentRaw.order_id).single()
      : Promise.resolve({ data: null }),
  ])

  const current = {
    ...currentRaw,
    delivery_drivers: driverRes.data || null,
    orders: orderRes.data || null,
  }

  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = { updated_at: now }

  // Handle status change
  if (body.status && body.status !== current.status) {
    const allowed = VALID_TRANSITIONS[current.status]
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json({
        error: `Cannot transition from ${current.status} to ${body.status}`,
      }, { status: 400 })
    }
    updateData.status = body.status

    if (body.status === 'delivered') {
      updateData.actual_delivery_time = now
    }
    if (body.status === 'failed') {
      updateData.failure_reason = body.failure_reason || null
    }
  }

  // Handle driver assignment (pending → assigned)
  if (body.driver_id && body.driver_id !== current.driver_id) {
    // Verify driver
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('id, name')
      .eq('id', body.driver_id)
      .eq('store_id', store.id)
      .single()

    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

    updateData.driver_id = body.driver_id

    // If assigning while pending, auto-advance to assigned
    if (current.status === 'pending' && !body.status) {
      updateData.status = 'assigned'
    }

    // Update driver status
    await supabase
      .from('delivery_drivers')
      .update({ status: 'on_delivery', updated_at: now })
      .eq('id', body.driver_id)
  }

  // Other field updates
  if (body.proof_photo_url) updateData.proof_photo_url = body.proof_photo_url
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.estimated_delivery_time) updateData.estimated_delivery_time = body.estimated_delivery_time
  if (body.delivery_fee !== undefined) updateData.delivery_fee = body.delivery_fee
  if (body.delivery_address) updateData.delivery_address = body.delivery_address
  if (body.customer_name !== undefined) updateData.customer_name = body.customer_name
  if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone

  const { data: updated, error: updateError } = await supabase
    .from('deliveries')
    .update(updateData as Database['public']['Tables']['deliveries']['Update'])
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Log status change
  const newStatus = (updateData.status as string) || undefined
  if (newStatus) {
    await supabase.from('delivery_status_log').insert({
      delivery_id: id,
      status: newStatus,
      changed_by: user.email || 'store_owner',
      notes: body.failure_reason || body.notes || null,
    })
  }

  // Free driver on terminal statuses
  const terminalStatuses = ['delivered', 'failed', 'cancelled']
  if (newStatus && terminalStatuses.includes(newStatus) && current.driver_id) {
    // Check if driver has other active deliveries
    const { count } = await supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', current.driver_id)
      .in('status', ['assigned', 'picked_up', 'in_transit'])
      .neq('id', id)

    if (!count || count === 0) {
      await supabase
        .from('delivery_drivers')
        .update({ status: 'active', updated_at: now })
        .eq('id', current.driver_id)
    }
  }

  // Update order status if delivered
  if (newStatus === 'delivered' && current.order_id) {
    await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', current.order_id)
  }

  // Dispatch notifications for status changes
  if (newStatus) {
    const driverName = (current.delivery_drivers as { name: string } | null)?.name || ''
    const orderNumber = (current.orders as { order_number: string } | null)?.order_number || ''

    const eventMap: Record<string, 'delivery_assigned' | 'delivery_picked_up' | 'delivery_completed' | 'delivery_failed' | 'delivery_delayed'> = {
      assigned: 'delivery_assigned',
      picked_up: 'delivery_picked_up',
      delivered: 'delivery_completed',
      failed: 'delivery_failed',
      delayed: 'delivery_delayed',
    }

    const notifEvent = eventMap[newStatus]
    if (notifEvent) {
      dispatchNotification(store.id, notifEvent, {
        delivery_id: id,
        delivery_number: current.delivery_number,
        driver_name: driverName,
        order_number: orderNumber,
        failure_reason: body.failure_reason || '',
        notes: body.notes || '',
      })
    }
  }

  return NextResponse.json({ delivery: updated })
}
