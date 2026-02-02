import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { decrementStockAndNotify, restoreStockOnCancellation } from '@/lib/stock'
import { dispatchNotification } from '@/lib/notifications'
import { validateBody, updateOrderStatusSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { assignDriver, DEFAULT_DELIVERY_SETTINGS } from '@/lib/ai/delivery-assigner'
import type { DriverCandidate, AssignmentRules } from '@/lib/ai/delivery-assigner'

/**
 * PATCH /api/orders/status
 *
 * Update an order's status. When status becomes "confirmed",
 * decrements variant stock and triggers low_stock notifications.
 */
export async function PATCH(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()

  // Authenticate the user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user owns a store
  const { data: store } = await supabase
    .from('stores')
    .select('id, delivery_settings')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, updateOrderStatusSchema)
  if (validationError) return validationError
  const { order_id, status, tracking_number } = body

  // Fetch order and verify it belongs to the user's store
  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, status, order_number')
    .eq('id', order_id)
    .eq('store_id', store.id)
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

  // Restore stock when order is cancelled (only if stock was previously decremented)
  const stockDecrementedStatuses = ['confirmed', 'processing', 'shipped']
  if (status === 'cancelled' && stockDecrementedStatuses.includes(previousStatus)) {
    await restoreStockOnCancellation(supabase, order_id)
  }

  // Auto-create delivery when order transitions to "shipped"
  if (status === 'shipped' && previousStatus !== 'shipped') {
    try {
      const { data: orderDetail } = await supabase
        .from('orders')
        .select('customer_id, shipping_address, customers(name, phone)')
        .eq('id', order_id)
        .single()

      const customer = orderDetail?.customers as { name: string; phone: string } | null

      // Check if a delivery already exists for this order
      const { count: existingCount } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', order_id)

      if (!existingCount || existingCount === 0) {
        const shippingAddr = orderDetail?.shipping_address as { address?: string } | null
        const deliveryAddress = shippingAddr?.address || 'Хаяг тодорхойгүй'
        const deliveryNumber = `DEL-${Date.now()}`

        const { data: newDelivery } = await supabase.from('deliveries').insert({
          store_id: store.id,
          order_id,
          delivery_number: deliveryNumber,
          status: 'pending',
          delivery_type: 'own_driver',
          delivery_address: deliveryAddress,
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
        }).select('id').single()

        // AI auto-assign driver if configured
        if (newDelivery) {
          const rawSettings = (store.delivery_settings || {}) as Record<string, unknown>
          const assignMode = (rawSettings.assignment_mode as string) || 'manual'
          const autoAssignOnShipped = rawSettings.auto_assign_on_shipped !== false

          if (assignMode !== 'manual' && autoAssignOnShipped) {
            try {
              const rules: AssignmentRules = {
                assignment_mode: assignMode as 'auto' | 'suggest',
                priority_rules: (rawSettings.priority_rules as string[]) || DEFAULT_DELIVERY_SETTINGS.priority_rules,
                max_concurrent_deliveries: (rawSettings.max_concurrent_deliveries as number) || DEFAULT_DELIVERY_SETTINGS.max_concurrent_deliveries,
                assignment_radius_km: (rawSettings.assignment_radius_km as number) || DEFAULT_DELIVERY_SETTINGS.assignment_radius_km,
                working_hours: rawSettings.working_hours as AssignmentRules['working_hours'],
              }

              // Get available drivers with stats
              const { data: activeDrivers } = await supabase
                .from('delivery_drivers')
                .select('id, name, vehicle_type, current_location, status')
                .eq('store_id', store.id)
                .in('status', ['active', 'on_delivery'])

              if (activeDrivers && activeDrivers.length > 0) {
                const driverCandidates: DriverCandidate[] = await Promise.all(
                  activeDrivers.map(async (d) => {
                    const { count: activeCount } = await supabase
                      .from('deliveries')
                      .select('id', { count: 'exact', head: true })
                      .eq('driver_id', d.id)
                      .in('status', ['assigned', 'picked_up', 'in_transit'])
                    const { count: completedCount } = await supabase
                      .from('deliveries')
                      .select('id', { count: 'exact', head: true })
                      .eq('driver_id', d.id)
                      .eq('status', 'delivered')
                    const { count: totalDone } = await supabase
                      .from('deliveries')
                      .select('id', { count: 'exact', head: true })
                      .eq('driver_id', d.id)
                      .in('status', ['delivered', 'failed'])
                    return {
                      id: d.id,
                      name: d.name,
                      location: d.current_location as { lat: number; lng: number } | null,
                      active_delivery_count: activeCount || 0,
                      vehicle_type: d.vehicle_type,
                      completion_rate: totalDone && totalDone > 0 ? Math.round(((completedCount || 0) / totalDone) * 100) : 100,
                    }
                  })
                )

                const result = await assignDriver(
                  { address: deliveryAddress, customer_zone: customer?.name || undefined },
                  driverCandidates,
                  rules,
                )

                const now = new Date().toISOString()
                await supabase.from('deliveries').update({ ai_assignment: JSON.parse(JSON.stringify({ ...result, assigned_at: now })) }).eq('id', newDelivery.id)

                if (assignMode === 'auto' && result.recommended_driver_id) {
                  await supabase.from('deliveries').update({
                    driver_id: result.recommended_driver_id,
                    status: 'assigned',
                    updated_at: now,
                  }).eq('id', newDelivery.id)

                  await supabase.from('delivery_drivers').update({ status: 'on_delivery', updated_at: now }).eq('id', result.recommended_driver_id)

                  const assignedDriver = driverCandidates.find(d => d.id === result.recommended_driver_id)
                  await supabase.from('delivery_status_log').insert({
                    delivery_id: newDelivery.id,
                    status: 'assigned',
                    changed_by: `AI (${result.method})`,
                    notes: `Жолооч: ${assignedDriver?.name || 'N/A'} — Итгэл: ${result.confidence}%`,
                  })

                  dispatchNotification(store.id, 'delivery_assigned', {
                    delivery_id: newDelivery.id,
                    delivery_number: deliveryNumber,
                    driver_name: assignedDriver?.name || '',
                    order_number: order.order_number,
                    failure_reason: '',
                    notes: `AI оноосон (${result.confidence}% итгэлтэй)`,
                  })
                }
              }
            } catch (assignErr) {
              console.error('AI auto-assign failed:', assignErr)
            }
          }
        }
      }
    } catch (err) {
      console.error('Auto-create delivery failed:', err)
    }
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
