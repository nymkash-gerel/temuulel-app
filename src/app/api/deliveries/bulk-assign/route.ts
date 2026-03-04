/**
 * POST /api/deliveries/bulk-assign
 *
 * Assign multiple deliveries to a single driver in one shot.
 * Sends ONE combined Telegram notification instead of N individual messages.
 *
 * Body: { driver_id: string, delivery_ids: string[] }
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, bulkAssignSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendToDriver } from '@/lib/driver-telegram'

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
    .select('id, delivery_number, delivery_address, customer_name, customer_phone, status')
    .in('id', body.delivery_ids)
    .eq('store_id', store.id)

  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ error: 'No deliveries found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const terminal = ['cancelled', 'failed', 'delivered']

  // Update all deliveries
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
  }))

  // Update driver status
  await supabase
    .from('delivery_drivers')
    .update({ status: 'on_delivery', updated_at: now })
    .eq('id', body.driver_id)

  // Build ONE combined Telegram message and send via admin-client path (bypasses RLS)
  const lines = deliveries
    .map(d =>
      `📦 <b>#${d.delivery_number}</b>\n` +
      `📍 ${d.delivery_address || 'Тодорхойгүй'}\n` +
      `👤 ${d.customer_name || '—'}${d.customer_phone ? ` · <code>${d.customer_phone}</code>` : ''}`
    )
    .join('\n\n')

  const combinedMessage =
    `🚚 <b>ШИНЭ ЗАХИАЛГУУД — ${deliveries.length} хүргэлт</b>\n\n` +
    `${lines}\n\n` +
    `Дэлгэрэнгүй мэдээллийг апп-с харна уу.`

  await sendToDriver(supabase, body.driver_id, combinedMessage)
    .catch(err => console.error('[Telegram] Bulk assign notification failed:', err))

  return NextResponse.json({ assigned: deliveries.length, driver_id: body.driver_id })
}
