import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendTextMessage, sendQuickReplies } from '@/lib/messenger'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * GET /api/cron/reactivate-delayed
 *
 * Vercel Cron handler — runs daily at 08:00 UTC (16:00 Mongolia).
 * Finds deliveries with status='delayed' whose estimated_delivery_time has passed,
 * transitions them back to 'pending', messages the customer to reconfirm, and notifies staff.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // Find delayed deliveries whose estimated time has passed
  const { data: delayedDeliveries, error: fetchErr } = await supabase
    .from('deliveries')
    .select('id, delivery_number, store_id, driver_id, order_id, estimated_delivery_time, customer_name, customer_phone, delivery_address')
    .eq('status', 'delayed')
    .not('estimated_delivery_time', 'is', null)
    .lte('estimated_delivery_time', now)

  if (fetchErr) {
    console.error('[cron/reactivate-delayed] Fetch error:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!delayedDeliveries || delayedDeliveries.length === 0) {
    return NextResponse.json({ ok: true, reactivated: 0 })
  }

  let reactivatedCount = 0

  for (const delivery of delayedDeliveries) {
    const del = delivery as Record<string, unknown>
    const deliveryId = del.id as string
    const storeId = del.store_id as string
    const orderId = del.order_id as string | null
    const deliveryNumber = del.delivery_number as string
    const customerName = del.customer_name as string | null

    // Reactivate: set status back to 'pending', clear driver assignment
    const { error: updateErr } = await supabase
      .from('deliveries')
      .update({
        status: 'pending',
        driver_id: null,
        notes: `Хойшлуулсан хугацаа дууслаа — дахин хүргэлтэнд бэлэн`,
        updated_at: now,
      })
      .eq('id', deliveryId)

    if (updateErr) {
      console.error(`[cron/reactivate-delayed] Update failed for ${deliveryId}:`, updateErr)
      continue
    }

    // Log the status change
    await supabase.from('delivery_status_log').insert({
      delivery_id: deliveryId,
      status: 'pending',
      changed_by: 'system/cron',
      notes: 'Хойшлуулсан хугацаа дууслаа — автоматаар идэвхжүүлэв',
    }).then(null, () => {})

    // Update order notes
    if (orderId) {
      await supabase.from('orders')
        .update({ notes: `🔔 Хойшлуулсан хугацаа дууслаа — дахин хүргэлтэнд бэлэн` })
        .eq('id', orderId)
    }

    // Dashboard notification
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: 'delivery_assigned',
      title: `🔔 Хойшлуулсан хүргэлт бэлэн боллоо`,
      body: `#${deliveryNumber} — хойшлуулсан хугацаа дууслаа. Жолооч оноож хүргүүлнэ үү.`,
      metadata: { delivery_id: deliveryId, reason: 'delayed_reactivated' },
    }).then(null, () => {})

    // --- Telegram notification to staff ---
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (botToken) {
      const tgMsg =
        `🔔 <b>ХОЙШЛУУЛСАН ХҮРГЭЛТ БЭЛЭН</b>\n\n` +
        `🆔 #${deliveryNumber}\n` +
        `👤 ${customerName || '—'}\n` +
        `📍 ${(del.delivery_address as string) || '—'}\n\n` +
        `Хойшлуулсан хугацаа дууслаа. Жолооч оноож хүргүүлнэ үү.`

      const chatIds: string[] = []
      const { data: staff } = await supabase
        .from('staff').select('telegram_chat_id').eq('store_id', storeId).not('telegram_chat_id', 'is', null)
      for (const s of (staff || []) as Array<{ telegram_chat_id: string }>) {
        if (s.telegram_chat_id && !chatIds.includes(s.telegram_chat_id)) chatIds.push(s.telegram_chat_id)
      }
      const { data: members } = await supabase
        .from('store_members').select('telegram_chat_id, notification_preferences').eq('store_id', storeId).not('telegram_chat_id', 'is', null)
      for (const m of (members || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
        const prefs = m.notification_preferences || {}
        if (m.telegram_chat_id && prefs.delivery !== false && !chatIds.includes(m.telegram_chat_id)) {
          chatIds.push(m.telegram_chat_id)
        }
      }
      for (const cid of chatIds) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cid, text: tgMsg, parse_mode: 'HTML' }),
        }).catch(() => {})
      }
    }

    // --- Message customer on Messenger to reconfirm ---
    if (orderId) {
      try {
        // Find customer via order
        const { data: order } = await supabase
          .from('orders').select('customer_id').eq('id', orderId).single()

        if (order?.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id, messenger_id, instagram_id, name')
            .eq('id', order.customer_id)
            .single()

          const senderId = customer?.messenger_id || customer?.instagram_id
          if (senderId) {
            // Get page token
            const { data: store } = await supabase
              .from('stores').select('facebook_page_access_token').eq('id', storeId).single()
            const pageToken = store?.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN

            if (pageToken) {
              const name = customer?.name || customerName || ''
              const msg = `Сайн байна уу${name ? `, ${name}` : ''}! Таны #${deliveryNumber} захиалгыг дахин хүргэхэд бэлэн боллоо. Хэзээ тохирох вэ?`

              const quickReplies = [
                { title: 'Өнөөдөр', payload: `REDELIVERY_TODAY:${deliveryId}` },
                { title: 'Маргааш', payload: `REDELIVERY_TOMORROW:${deliveryId}` },
                { title: 'Энэ 7 хоногт', payload: `REDELIVERY_WEEK:${deliveryId}` },
                { title: 'Цуцлах', payload: `REDELIVERY_CANCEL:${deliveryId}` },
              ]

              const res = await sendQuickReplies(senderId, msg, quickReplies, pageToken)
              if (!res) {
                // Fallback to plain text if outside 24h window
                await sendTextMessage(senderId, msg, pageToken)
              }

              // Save to conversation
              const { data: conv } = await supabase
                .from('conversations')
                .select('id')
                .eq('store_id', storeId)
                .eq('customer_id', order.customer_id)
                .neq('status', 'closed')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

              if (conv) {
                await supabase.from('messages').insert({
                  conversation_id: conv.id,
                  content: msg,
                  is_from_customer: false,
                  is_ai_response: true,
                  metadata: { type: 'redelivery_confirmation', delivery_id: deliveryId },
                })
                await supabase.from('conversations').update({ updated_at: now }).eq('id', conv.id)
              }

              console.log(`[cron/reactivate-delayed] Messaged customer for ${deliveryNumber}`)
            }
          }
        }
      } catch (err) {
        console.error(`[cron/reactivate-delayed] Customer message failed for ${deliveryNumber}:`, err)
      }
    }

    reactivatedCount++
  }

  console.log(`[cron/reactivate-delayed] Reactivated ${reactivatedCount}/${delayedDeliveries.length} delayed deliveries`)
  return NextResponse.json({ ok: true, reactivated: reactivatedCount })
}
