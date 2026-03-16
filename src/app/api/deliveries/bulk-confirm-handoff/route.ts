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
import { sendToDriver, handoffReadyKeyboard } from '@/lib/driver-telegram'
import { resolveStoreId } from '@/lib/resolve-store'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const store = { id: storeId }

  const body = await request.json()
  const { driver_id } = body
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 })

  // Fetch all at_store deliveries for this driver in this store with full info
  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select(`
      id, delivery_number, customer_name, customer_phone, delivery_address,
      delivery_fee, order_id
    `)
    .eq('store_id', store.id)
    .eq('driver_id', driver_id)
    .eq('status', 'at_store')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ confirmed: 0, delivery_ids: [] })
  }

  const now = new Date().toISOString()
  const ids = deliveries.map(d => d.id)

  // Do NOT update status to picked_up yet — driver must accept first
  // Just mark updated_at to trigger realtime
  const { error: updateError } = await supabase
    .from('deliveries')
    .update({ updated_at: now })
    .in('id', ids)
    .eq('store_id', store.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Send one Telegram message per delivery with Accept/Cancel buttons
  // Await all sequentially to stay within serverless time budget
  for (const delivery of deliveries as {
    id: string
    delivery_number: string
    customer_name: string | null
    customer_phone: string | null
    delivery_address: string
    delivery_fee: number | null
    order_id: string | null
  }[]) {
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
          productList = items.slice(0, 3).map(item => `• ${item.products?.name || 'Бараа'} x${item.quantity}`).join('\n')
          if (items.length > 3) productList += `\n• +${items.length - 3} бараа`
        }
      }
    }

    const deliveryFee = delivery.delivery_fee || 0
    const grandTotal = totalAmount + deliveryFee

    const cardText =
      `📦 <b>Бараа бэлэн боллоо — #${delivery.delivery_number}</b>\n\n` +
      `👤 ${delivery.customer_name || '—'}\n` +
      `📞 ${delivery.customer_phone ? `<code>${delivery.customer_phone}</code>` : '—'}\n` +
      `📍 ${delivery.delivery_address || '—'}\n` +
      (productList ? `\n🛍️ <b>Бараа:</b>\n${productList}\n` : '') +
      `\n💰 Нийт: ${new Intl.NumberFormat('mn-MN').format(grandTotal)}₮` +
      (deliveryFee > 0 ? ` (+${new Intl.NumberFormat('mn-MN').format(deliveryFee)}₮ хүргэлт)` : '') +
      `\n\n<b>Барааг хүлээж авсан уу?</b>`

    await sendToDriver(
      supabase,
      driver_id,
      cardText,
      handoffReadyKeyboard(delivery.id)
    ).catch(() => {})
  }

  return NextResponse.json({ confirmed: deliveries.length, delivery_ids: ids })
}
