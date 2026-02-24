/**
 * POST /api/deliveries/[id]/confirm-handoff
 *
 * Store owner confirms they have handed the product to the driver.
 * Transitions delivery: at_store → picked_up
 * Sends driver a Telegram notification to start delivery.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendToDriver, enRouteKeyboard } from '@/lib/driver-telegram'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deliveryId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Fetch delivery — must belong to this store and be in at_store status
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, status, driver_id, customer_name, delivery_number')
    .eq('id', deliveryId)
    .eq('store_id', store.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  if (delivery.status !== 'at_store') {
    return NextResponse.json({ error: 'Delivery is not in at_store status' }, { status: 400 })
  }

  // Update status to picked_up
  const { error } = await supabase
    .from('deliveries')
    .update({ status: 'picked_up', updated_at: new Date().toISOString() })
    .eq('id', deliveryId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify driver via Telegram
  if (delivery.driver_id) {
    sendToDriver(
      supabase,
      delivery.driver_id,
      `✅ <b>Бараа өгсөн баталгаажлаа!</b>\n\n` +
      `📦 Захиалга: #${delivery.delivery_number}\n` +
      (delivery.customer_name ? `👤 ${delivery.customer_name}\n` : '') +
      `\nХаягруу явна уу. Хүргэсний дараа доорх товчийг дарна уу.`,
      enRouteKeyboard(deliveryId)
    ).catch(() => {}) // Non-blocking
  }

  return NextResponse.json({ ok: true, status: 'picked_up' })
}
