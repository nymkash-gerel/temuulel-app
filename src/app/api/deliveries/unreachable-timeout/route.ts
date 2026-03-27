/**
 * POST /api/deliveries/unreachable-timeout
 *
 * Called by QStash after 5 minutes when a customer is unreachable.
 * If delivery is still in "delayed" status (customer hasn't responded),
 * notifies the driver to move on and marks the delivery as failed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendToDriver, DRIVER_PROACTIVE_MESSAGES } from '@/lib/driver-telegram'
import { Receiver } from '@upstash/qstash'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
})

export async function POST(request: NextRequest) {
  // Verify QStash signature (fail-closed: reject if signing keys not configured)
  let body: Record<string, unknown>
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'QStash signing keys not configured' }, { status: 500 })
    }
    // Only allow unauthenticated in development
    body = await request.json()
  } else {
    const signature = request.headers.get('upstash-signature') || ''
    const rawBody = await request.text()
    try {
      await receiver.verify({ signature, body: rawBody })
    } catch {
      return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })
    }
    body = JSON.parse(rawBody)
  }
  const { delivery_id, store_id } = body as { delivery_id: string; store_id: string }

  if (!delivery_id || !store_id) {
    return NextResponse.json({ error: 'Missing delivery_id or store_id' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(url, key)

  // Check if delivery is still delayed (customer didn't respond)
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('id, status, driver_id, order_id, delivery_number, customer_name, delivery_address')
    .eq('id', delivery_id)
    .single()

  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
  }

  // If customer already responded (status changed from delayed), do nothing
  if (delivery.status !== 'delayed') {
    return NextResponse.json({ message: 'Customer already responded, no action needed' })
  }

  // Mark delivery as failed — customer unreachable
  await supabase
    .from('deliveries')
    .update({
      status: 'failed',
      failure_reason: 'Харилцагч утас авсангүй — 5 минутын хугацаа дууслаа',
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery_id)

  // Log status change
  await supabase.from('delivery_status_log').insert({
    delivery_id,
    status: 'failed',
    notes: 'Автомат: Харилцагч 5 минутын дотор хариу өгсөнгүй',
    changed_by: 'system',
  })

  // Notify driver via Telegram — "дараагийн захиалга руу яв"
  if (delivery.driver_id) {
    await sendToDriver(
      supabase,
      delivery.driver_id,
      `📵 <b>Харилцагч хариу өгсөнгүй.</b>\n\n` +
      `📦 ${delivery.delivery_number}\n` +
      `📍 ${delivery.delivery_address}\n\n` +
      `Барааг дэлгүүр рүү буцаана. Дараагийн хүргэлт рүүгээ явна уу! 🚗`,
    ).catch(err => console.error('[Telegram] Unreachable timeout notification failed:', err))
  }

  // Send chat message to customer — "дахин хүргэлт товлох уу?"
  if (delivery.order_id) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('conversation_id')
      .eq('id', delivery.order_id)
      .single() as { data: { conversation_id?: string | null } | null }

    const convId = orderRow?.conversation_id
    if (convId) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: `📵 Жолооч тантай холбогдож чадсангүй.\n\n` +
          `Барааг дэлгүүр рүү буцааж байна. Дахин хүргүүлэхийг хүсвэл ` +
          `"дахин хүргүүлнэ" гэж бичнэ үү 😊`,
      })
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId)
    }
  }

  return NextResponse.json({ message: 'Unreachable timeout handled', delivery_id })
}
