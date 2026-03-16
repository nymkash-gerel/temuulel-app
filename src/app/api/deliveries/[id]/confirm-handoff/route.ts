/**
 * POST /api/deliveries/[id]/confirm-handoff
 *
 * Store owner confirms they have handed the product to the driver.
 * Transitions delivery: at_store → picked_up
 * Sends driver a Telegram notification to start delivery.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendToDriver, handoffReadyKeyboard } from '@/lib/driver-telegram'
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

  // Fetch delivery with full info — must belong to this store and be in at_store status
  const { data: delivery } = await supabase
    .from('deliveries')
    .select(`
      id, status, driver_id, customer_name, customer_phone, delivery_number,
      delivery_address, delivery_fee, order_id
    `)
    .eq('id', deliveryId)
    .eq('store_id', store.id)
    .single()

  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  if (delivery.status !== 'at_store') {
    return NextResponse.json({ error: 'Delivery is not in at_store status' }, { status: 400 })
  }

  // Get order details for full info
  let totalAmount = 0
  let productList = ''
  if (delivery.order_id) {
    const { data: orderData } = await supabase
      .from('orders')
      .select('total_amount, order_items(quantity, products(name))')
      .eq('id', delivery.order_id)
      .single()

    if (orderData) {
      totalAmount = (orderData as { total_amount: number | null }).total_amount || 0
      const items = (orderData as { order_items: { quantity: number; products: { name: string } | null }[] }).order_items || []
      if (items.length > 0) {
        productList = items.map(item => `• ${item.products?.name || 'Бараа'} x${item.quantity}`).join('\n')
      }
    }
  }

  const deliveryFee = delivery.delivery_fee || 0
  const grandTotal = totalAmount + deliveryFee

  // Do NOT update status to picked_up yet — driver must accept first
  // Just mark updated_at to trigger realtime
  const { error } = await supabase
    .from('deliveries')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', deliveryId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify driver via Telegram with full delivery info and Accept/Cancel buttons
  if (delivery.driver_id) {
    const cardText =
      `📦 <b>Бараа бэлэн боллоо — #${delivery.delivery_number}</b>\n\n` +
      `👤 ${delivery.customer_name || '—'}\n` +
      `📞 ${delivery.customer_phone ? `<code>${delivery.customer_phone}</code>` : '—'}\n` +
      `📍 ${delivery.delivery_address || '—'}\n` +
      (productList ? `\n🛍️ <b>Бараа:</b>\n${productList}\n` : '') +
      `\n💰 Нийт: ${new Intl.NumberFormat('mn-MN').format(grandTotal)}₮` +
      (deliveryFee > 0 ? ` (+${new Intl.NumberFormat('mn-MN').format(deliveryFee)}₮ хүргэлт)` : '') +
      `\n\n<b>Барааг хүлээж авсан уу?</b>`

    const sent = await sendToDriver(
      supabase,
      delivery.driver_id,
      cardText,
      handoffReadyKeyboard(deliveryId)
    ).catch(err => {
      console.error(`[confirm-handoff] TG notify failed:`, err?.message ?? err)
      return false
    })
    console.log(`[confirm-handoff] TG notify driver=${delivery.driver_id} sent=${sent}`)
  }

  return NextResponse.json({ ok: true, status: 'at_store' })
}
