/**
 * POST /api/deliveries/batch-assign
 *
 * Smart batch dispatch: assigns all pending deliveries to drivers in one shot.
 * Zone-aware + load-balanced — no driver gets overloaded.
 *
 * Body: { dry_run?: boolean }
 *
 * dry_run = true  → returns preview without writing to DB
 * dry_run = false → executes assignments + sends Telegram notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addressMatchesZones } from '@/lib/ai/delivery-assigner'
import { sendBatchAssignmentNotification } from '@/lib/driver-telegram'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

interface PendingDelivery {
  id: string
  delivery_number: string
  delivery_address: string
  customer_name: string | null
  customer_phone: string | null
  delivery_type: string
  order_id: string | null
  orders: { order_number: string; payment_status: string | null } | null
}

interface ActiveDriver {
  id: string
  name: string
  phone: string
  vehicle_type: string
  delivery_zones: string[]
  telegram_chat_id: number | null
  todayCount: number  // deliveries already assigned today
}

export interface BatchAssignment {
  delivery_id: string
  delivery_number: string
  delivery_address: string
  customer_name: string | null
  delivery_type: string
  driver_id: string
  driver_name: string
  zone_match: boolean
}

export interface BatchPreview {
  assignments: BatchAssignment[]
  unassigned: { delivery_id: string; delivery_number: string; reason: string }[]
  by_driver: {
    driver_id: string
    driver_name: string
    zones: string[]
    today_existing: number
    new_count: number
    deliveries: { delivery_number: string; address: string; zone_match: boolean }[]
  }[]
  total: number
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 20, windowSeconds: 60 })
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

  const body = await request.json().catch(() => ({}))
  const dryRun = body.dry_run !== false // default to dry_run = true for safety

  // ── 1. Fetch all pending deliveries ────────────────────────────────────
  const { data: rawDeliveries } = await supabase
    .from('deliveries')
    .select('id, delivery_number, delivery_address, customer_name, customer_phone, delivery_type, order_id, orders(order_number, payment_status)')
    .eq('store_id', store.id)
    .eq('status', 'pending')
    .is('driver_id', null)
    .order('created_at', { ascending: true })

  if (!rawDeliveries || rawDeliveries.length === 0) {
    return NextResponse.json({ message: 'Оноох хүргэлт байхгүй', assignments: [], total: 0 })
  }

  // Filter out intercity deliveries with unpaid orders
  const pending: PendingDelivery[] = rawDeliveries.filter(d => {
    if (d.delivery_type === 'intercity_post') {
      const order = d.orders as { order_number: string; payment_status: string | null } | null
      return order?.payment_status === 'paid'
    }
    return true
  }) as PendingDelivery[]

  if (pending.length === 0) {
    return NextResponse.json({ message: 'Бүх хотоор хоорондын захиалга төлбөр хүлээж байна', assignments: [], total: 0 })
  }

  // ── 2. Fetch active drivers ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawDrivers } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name, phone, vehicle_type, delivery_zones, telegram_chat_id')
    .eq('store_id', store.id)
    .in('status', ['active', 'on_delivery'])

  if (!rawDrivers || rawDrivers.length === 0) {
    return NextResponse.json({ error: 'Идэвхтэй жолооч байхгүй байна' }, { status: 400 })
  }

  // ── 3. Fetch today's delivery counts per driver ─────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString()

  const { data: todayCounts } = await supabase
    .from('deliveries')
    .select('driver_id')
    .eq('store_id', store.id)
    .not('driver_id', 'is', null)
    .in('status', ['assigned', 'at_store', 'picked_up', 'in_transit', 'delivered'])
    .gte('created_at', todayIso)

  const driverTodayMap: Record<string, number> = {}
  todayCounts?.forEach(r => {
    if (r.driver_id) driverTodayMap[r.driver_id] = (driverTodayMap[r.driver_id] || 0) + 1
  })

  const drivers: ActiveDriver[] = rawDrivers.map((d: { id: string; name: string; phone: string; vehicle_type: string; delivery_zones: string[] | null; telegram_chat_id: number | null }) => ({
    ...d,
    delivery_zones: d.delivery_zones || [],
    todayCount: driverTodayMap[d.id] || 0,
  }))

  // ── 4. Batch assignment algorithm ───────────────────────────────────────
  // Track how many deliveries we're adding to each driver IN THIS BATCH
  const batchCounts: Record<string, number> = {}
  drivers.forEach(d => { batchCounts[d.id] = 0 })

  const assignments: BatchAssignment[] = []
  const unassigned: { delivery_id: string; delivery_number: string; reason: string }[] = []

  for (const delivery of pending) {
    // Find drivers whose zones match this delivery
    const zoneMatches = drivers.filter(d => addressMatchesZones(delivery.delivery_address, d.delivery_zones))
    const candidates = zoneMatches.length > 0 ? zoneMatches : drivers // fallback to all

    if (candidates.length === 0) {
      unassigned.push({ delivery_id: delivery.id, delivery_number: delivery.delivery_number, reason: 'Жолооч олдсонгүй' })
      continue
    }

    // Sort by total load (today + batch) ascending — lowest load gets next delivery
    const sorted = [...candidates].sort((a, b) =>
      (a.todayCount + batchCounts[a.id]) - (b.todayCount + batchCounts[b.id])
    )
    const best = sorted[0]
    batchCounts[best.id]++

    assignments.push({
      delivery_id: delivery.id,
      delivery_number: delivery.delivery_number,
      delivery_address: delivery.delivery_address,
      customer_name: delivery.customer_name,
      delivery_type: delivery.delivery_type,
      driver_id: best.id,
      driver_name: best.name,
      zone_match: zoneMatches.some(d => d.id === best.id),
    })
  }

  // ── 5. Build per-driver preview ─────────────────────────────────────────
  const byDriver = drivers
    .filter(d => batchCounts[d.id] > 0)
    .map(d => ({
      driver_id: d.id,
      driver_name: d.name,
      zones: d.delivery_zones,
      today_existing: d.todayCount,
      new_count: batchCounts[d.id],
      deliveries: assignments
        .filter(a => a.driver_id === d.id)
        .map(a => ({
          delivery_number: a.delivery_number,
          address: a.delivery_address,
          zone_match: a.zone_match,
        })),
    }))

  const preview: BatchPreview = { assignments, unassigned, by_driver: byDriver, total: assignments.length }

  if (dryRun) {
    return NextResponse.json({ ...preview, dry_run: true })
  }

  // ── 6. Execute assignments ──────────────────────────────────────────────
  const executed: string[] = []
  const failed: string[] = []

  for (const a of assignments) {
    const { error } = await supabase
      .from('deliveries')
      .update({ status: 'assigned', driver_id: a.driver_id, updated_at: new Date().toISOString() })
      .eq('id', a.delivery_id)

    if (error) { failed.push(a.delivery_id); continue }
    executed.push(a.delivery_id)
  }

  // ── 7. Send Telegram notifications (batch summary per driver) ────────────
  // Group by driver and send ONE batch summary instead of N individual messages
  const driverAssignments = assignments.filter(a => executed.includes(a.delivery_id))
  const grouped: Record<string, BatchAssignment[]> = {}
  driverAssignments.forEach(a => {
    grouped[a.driver_id] = grouped[a.driver_id] || []
    grouped[a.driver_id].push(a)
  })

  for (const [driverId, delivs] of Object.entries(grouped)) {
    // Send ONE batch notification per driver (not N separate cards)
    sendBatchAssignmentNotification(
      supabase,
      driverId,
      store.id,
      delivs.map(a => ({
        id: a.delivery_id,
        delivery_number: a.delivery_number,
        delivery_address: a.delivery_address,
        customer_name: a.customer_name,
        customer_phone: null, // Not available in BatchAssignment, will be fetched later if needed
      }))
    ).catch(() => {})
  }

  return NextResponse.json({
    ...preview,
    dry_run: false,
    executed: executed.length,
    failed: failed.length,
  })
}
