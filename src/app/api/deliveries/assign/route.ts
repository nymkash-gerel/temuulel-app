import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, triggerAssignmentSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { assignDriver, DEFAULT_DELIVERY_SETTINGS } from '@/lib/ai/delivery-assigner'
import type { DriverCandidate, AssignmentRules } from '@/lib/ai/delivery-assigner'
import { dispatchNotification } from '@/lib/notifications'
import { sendPushToUser } from '@/lib/push'
import { sendDeliveryTrackingSMS } from '@/lib/sms'

/**
 * POST /api/deliveries/assign
 *
 * Trigger AI assignment for a pending delivery.
 * Finds available drivers, runs the assignment engine, and optionally auto-assigns.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id, delivery_settings')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, triggerAssignmentSchema)
  if (validationError) return validationError

  // Fetch the delivery
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, delivery_number, store_id, delivery_address, customer_name, customer_phone, status, driver_id, order_id')
    .eq('id', body.delivery_id)
    .eq('store_id', store.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })

  if (delivery.status !== 'pending') {
    return NextResponse.json({ error: 'Зөвхөн хүлээгдэж буй хүргэлтэд жолооч оноох боломжтой' }, { status: 400 })
  }

  // Get store rules
  const rawSettings = (store.delivery_settings || {}) as Record<string, unknown>
  const rules: AssignmentRules = {
    assignment_mode: (rawSettings.assignment_mode as AssignmentRules['assignment_mode']) || DEFAULT_DELIVERY_SETTINGS.assignment_mode,
    priority_rules: (rawSettings.priority_rules as string[]) || DEFAULT_DELIVERY_SETTINGS.priority_rules,
    max_concurrent_deliveries: (rawSettings.max_concurrent_deliveries as number) || DEFAULT_DELIVERY_SETTINGS.max_concurrent_deliveries,
    assignment_radius_km: (rawSettings.assignment_radius_km as number) || DEFAULT_DELIVERY_SETTINGS.assignment_radius_km,
    working_hours: rawSettings.working_hours as AssignmentRules['working_hours'],
  }

  // Force auto mode for this explicit trigger
  rules.assignment_mode = 'auto'

  // Get available drivers (primary store + shared via assignments)
  const { data: assignmentDriverIds } = await supabase
    .from('driver_store_assignments')
    .select('driver_id')
    .eq('store_id', store.id)
    .eq('status', 'active')

  const sharedDriverIds = (assignmentDriverIds || []).map(a => a.driver_id)

  // Fetch drivers from primary store
  const { data: primaryDrivers } = await supabase
    .from('delivery_drivers')
    .select('id, name, vehicle_type, current_location, status')
    .eq('store_id', store.id)
    .in('status', ['active', 'on_delivery'])

  // Fetch shared drivers (if any)
  let sharedDrivers: typeof primaryDrivers = []
  if (sharedDriverIds.length > 0) {
    const { data } = await supabase
      .from('delivery_drivers')
      .select('id, name, vehicle_type, current_location, status')
      .in('id', sharedDriverIds)
      .in('status', ['active', 'on_delivery'])
    sharedDrivers = data || []
  }

  // Merge and deduplicate
  const driverMap = new Map<string, NonNullable<typeof primaryDrivers>[0]>()
  for (const d of [...(primaryDrivers || []), ...(sharedDrivers || [])]) {
    if (d && !driverMap.has(d.id)) driverMap.set(d.id, d)
  }
  const activeDrivers = Array.from(driverMap.values())

  if (!activeDrivers || activeDrivers.length === 0) {
    return NextResponse.json({ error: 'Идэвхтэй жолооч байхгүй байна' }, { status: 404 })
  }

  // Count active deliveries per driver
  const driverCandidates: DriverCandidate[] = await Promise.all(
    activeDrivers.map(async (d) => {
      const { count } = await supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', d.id)
        .in('status', ['assigned', 'picked_up', 'in_transit'])

      // Get completion stats
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
        active_delivery_count: count || 0,
        vehicle_type: d.vehicle_type,
        completion_rate: totalDone && totalDone > 0 ? Math.round(((completedCount || 0) / totalDone) * 100) : 100,
      }
    })
  )

  // Run assignment engine
  const result = await assignDriver(
    { address: delivery.delivery_address, customer_zone: delivery.customer_name || undefined },
    driverCandidates,
    rules,
  )

  // Store AI assignment result
  const now = new Date().toISOString()
  await supabase
    .from('deliveries')
    .update({ ai_assignment: JSON.parse(JSON.stringify({ ...result, assigned_at: now })) })
    .eq('id', delivery.id)

  // Auto-assign if recommended
  if (result.recommended_driver_id) {
    await supabase
      .from('deliveries')
      .update({ driver_id: result.recommended_driver_id, status: 'assigned', updated_at: now })
      .eq('id', delivery.id)

    // Update driver status
    await supabase
      .from('delivery_drivers')
      .update({ status: 'on_delivery', updated_at: now })
      .eq('id', result.recommended_driver_id)

    // Log status change
    const assignedDriver = driverCandidates.find(d => d.id === result.recommended_driver_id)
    await supabase.from('delivery_status_log').insert({
      delivery_id: delivery.id,
      status: 'assigned',
      changed_by: `AI (${result.method})`,
      notes: `Жолооч: ${assignedDriver?.name || 'N/A'} — Итгэл: ${result.confidence}%`,
    })

    // Fetch order number for notification
    let orderNumber = ''
    if (delivery.order_id) {
      const { data: order } = await supabase.from('orders').select('order_number').eq('id', delivery.order_id).single()
      orderNumber = order?.order_number || ''
    }

    // Dispatch notification to store owner
    dispatchNotification(store.id, 'delivery_assigned', {
      delivery_id: delivery.id,
      delivery_number: delivery.delivery_number,
      driver_name: assignedDriver?.name || '',
      order_number: orderNumber,
      failure_reason: '',
      notes: `AI оноосон (${result.confidence}% итгэлтэй)`,
    })

    // Send push notification to driver
    const { data: driverRecord } = await supabase
      .from('delivery_drivers')
      .select('user_id')
      .eq('id', result.recommended_driver_id)
      .single()

    if (driverRecord?.user_id) {
      sendPushToUser(driverRecord.user_id, {
        title: 'Шинэ хүргэлт оноогдлоо',
        body: `${delivery.delivery_number} — ${delivery.delivery_address}`,
        url: `/driver/delivery/${delivery.id}`,
        tag: 'driver-new-delivery',
      })
    }

    // Send tracking SMS to customer
    if (delivery.customer_phone) {
      sendDeliveryTrackingSMS(
        delivery.customer_phone,
        delivery.delivery_number,
        delivery.customer_name,
      ).catch(() => {}) // Non-blocking
    }
  }

  return NextResponse.json({
    assignment: result,
    auto_assigned: !!result.recommended_driver_id,
  })
}
