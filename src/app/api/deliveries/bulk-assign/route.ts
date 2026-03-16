/**
 * POST /api/deliveries/bulk-assign
 *
 * Assign multiple deliveries to a single driver.
 * Sends one individual Telegram message per delivery with its own buttons.
 *
 * Body: { driver_id: string, delivery_ids: string[] }
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, bulkAssignSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendToDriverWithLog, orderAssignedKeyboard } from '@/lib/driver-telegram'
import { resolveStoreId } from '@/lib/resolve-store'

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 20, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storeId = await resolveStoreId(supabase, user.id)
  if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const store = { id: storeId }

  const { data: body, error: validationError } = await validateBody(request, bulkAssignSchema)
  if (validationError) return validationError

  // Verify driver belongs to store
  const { data: driver } = await supabase
    .from('delivery_drivers')
    .select('id, name')
    .eq('id', body.driver_id)
    .eq('store_id', store.id)
    .single()

  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  // Fetch all specified deliveries that belong to this store
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('id, delivery_number, delivery_address, customer_name, customer_phone, status, delivery_fee, metadata')
    .in('id', body.delivery_ids)
    .eq('store_id', store.id)

  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ error: 'No deliveries found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const terminal = ['cancelled', 'failed', 'delivered']

  // Update all deliveries and send one notification per delivery
  await Promise.all(deliveries.map(async (d) => {
    const newStatus = (d.status === 'pending' || terminal.includes(d.status)) ? 'assigned' : d.status
    await supabase
      .from('deliveries')
      .update({ driver_id: body.driver_id, status: newStatus, updated_at: now })
      .eq('id', d.id)

    if (newStatus !== d.status) {
      await supabase.from('delivery_status_log').insert({
        delivery_id: d.id,
        status: newStatus,
        changed_by: user.email || 'store_owner',
      })
    }

    // Send individual Telegram notification for this delivery
    const message =
      `🆕 <b>ШИНЭ ЗАХИАЛГА — #${d.delivery_number}</b>\n\n` +
      `📍 Хаяг: ${d.delivery_address || 'Тодорхойгүй'}\n` +
      `👤 Хүлээн авагч: ${d.customer_name || '—'}\n` +
      `📞 Утас: ${d.customer_phone || '—'}`

    const currentMeta = (d.metadata || {}) as Record<string, unknown>
    const msgId = await sendToDriverWithLog(
      supabase,
      body.driver_id,
      store.id,
      message,
      orderAssignedKeyboard(d.id),
    ).catch(err => { console.error('[Telegram] Driver notification failed:', err); return null })

    if (msgId) {
      // Clear batch_ids so confirm_received treats this as a single delivery (not a batch)
      await supabase
        .from('deliveries')
        .update({ metadata: { ...currentMeta, telegram_message_id: msgId, batch_ids: null } })
        .eq('id', d.id)
    }
  }))

  // Update driver status
  await supabase
    .from('delivery_drivers')
    .update({ status: 'on_delivery', updated_at: now })
    .eq('id', body.driver_id)

  return NextResponse.json({ assigned: deliveries.length, driver_id: body.driver_id })
}
