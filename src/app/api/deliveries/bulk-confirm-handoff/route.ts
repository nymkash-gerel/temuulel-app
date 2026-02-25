/**
 * POST /api/deliveries/bulk-confirm-handoff
 *
 * Confirm handoff for ALL at_store deliveries belonging to one driver.
 * One click from the store manager instead of confirming each delivery individually.
 *
 * Body: { driver_id: string }
 * Returns: { confirmed: number, delivery_ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendToDriver, enRouteKeyboard } from '@/lib/driver-telegram'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body = await request.json()
  const { driver_id } = body
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 })

  // Fetch all at_store deliveries for this driver in this store
  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select('id, delivery_number, customer_name, customer_phone, delivery_address')
    .eq('store_id', store.id)
    .eq('driver_id', driver_id)
    .eq('status', 'at_store')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ confirmed: 0, delivery_ids: [] })
  }

  const now = new Date().toISOString()
  const ids = deliveries.map(d => d.id)

  // Bulk update all to picked_up
  const { error: updateError } = await supabase
    .from('deliveries')
    .update({ status: 'picked_up', updated_at: now })
    .in('id', ids)
    .eq('store_id', store.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Send one Telegram message per delivery (each with its own action buttons)
  // Await all sequentially to stay within serverless time budget
  for (const delivery of deliveries) {
    await sendToDriver(
      supabase,
      driver_id,
      `✅ <b>Бараа өгсөн — #${delivery.delivery_number}</b>\n` +
      (delivery.customer_name ? `👤 ${delivery.customer_name}\n` : '') +
      (delivery.delivery_address ? `📍 ${delivery.delivery_address}\n` : '') +
      `\nХаягруу явна уу.`,
      enRouteKeyboard(delivery.id)
    ).catch(() => {})
  }

  return NextResponse.json({ confirmed: deliveries.length, delivery_ids: ids })
}
