import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendTelegramMessage,
  answerCallbackQuery,
  editMessageText,
} from '@/lib/telegram'
import { getSupabase } from '@/lib/supabase/service'

/**
 * POST /api/webhook/telegram
 *
 * Telegram Bot webhook endpoint. Handles:
 * 1. /start STAFF_ID — Auto-link staff member's Telegram account
 * 2. callback_query — Confirm/Reject appointment buttons
 */
const RATE_LIMIT = { limit: 100, windowSeconds: 60 }

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 })
  }

  // Verify Telegram webhook secret token (set via TELEGRAM_WEBHOOK_SECRET env var).
  // Register it with Telegram using: setWebhook?url=...&secret_token=YOUR_SECRET
  // Telegram sends it back in the X-Telegram-Bot-Api-Secret-Token header on every update.
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const incomingToken = request.headers.get('x-telegram-bot-api-secret-token')
    if (incomingToken !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Handle callback queries (inline button taps)
  if (body.callback_query) {
    await handleCallbackQuery(supabase, body.callback_query as CallbackQuery)
    return NextResponse.json({ ok: true })
  }

  // Handle /start command for staff linking
  const message = body.message as TelegramMessage | undefined
  if (message?.text?.startsWith('/start')) {
    await handleStartCommand(supabase, message)
    return NextResponse.json({ ok: true })
  }

  // Ignore other messages
  return NextResponse.json({ ok: true })
}

// Telegram doesn't need CORS but we handle OPTIONS for completeness
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TelegramMessage {
  message_id: number
  chat: { id: number }
  from?: { id: number; first_name?: string }
  text?: string
}

interface CallbackQuery {
  id: string
  from: { id: number }
  message?: {
    message_id: number
    chat: { id: number }
    text?: string
  }
  data?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


/**
 * Handle /start PARAM — Links Telegram to a staff or store member.
 * - /start member_UUID — Link to store_members (team member / owner)
 * - /start UUID — Link to staff table (legacy appointment staff)
 */
async function handleStartCommand(
  supabase: SupabaseClient,
  message: TelegramMessage
) {
  const chatId = String(message.chat.id)
  const text = message.text || ''
  const parts = text.split(' ')
  const param = parts[1]?.trim()

  if (!param) {
    await sendTelegramMessage(chatId, 'Сайн байна уу! Dashboard-аас Telegram холбох линк дарна уу.')
    return
  }

  // Store member linking (team members & owners)
  if (param.startsWith('member_')) {
    const memberId = param.replace('member_', '')

    const { data: member, error } = await supabase
      .from('store_members')
      .select('id, store_id')
      .eq('id', memberId)
      .single()

    if (error || !member) {
      await sendTelegramMessage(chatId, 'Багийн гишүүн олдсонгүй. Линкээ шалгана уу.')
      return
    }

    const { error: updateError } = await supabase
      .from('store_members')
      .update({ telegram_chat_id: chatId })
      .eq('id', memberId)

    if (updateError) {
      console.error('[telegram] Failed to link member:', updateError)
      await sendTelegramMessage(chatId, 'Алдаа гарлаа. Дахин оролдоно уу.')
      return
    }

    const { data: store } = await supabase
      .from('stores')
      .select('name')
      .eq('id', member.store_id)
      .single()

    const name = message.from?.first_name || ''
    await sendTelegramMessage(
      chatId,
      `${name ? name + ', а' : 'А'}мжилттай холбогдлоо! ${store?.name || 'Дэлгүүр'}-н мэдэгдэл авах болно.\n\nDashboard → Тохиргоо → Telegram хэсгээс ямар мэдэгдэл авахаа сонгоно уу.`
    )
    return
  }

  // Legacy: staff table linking
  const { data: staffMember, error } = await supabase
    .from('staff')
    .select('id, name, store_id')
    .eq('id', param)
    .single()

  if (error || !staffMember) {
    await sendTelegramMessage(chatId, 'Олдсонгүй. Линкээ шалгана уу.')
    return
  }

  const { error: updateError } = await supabase
    .from('staff')
    .update({ telegram_chat_id: chatId })
    .eq('id', param)

  if (updateError) {
    console.error('[telegram] Failed to link staff:', updateError)
    await sendTelegramMessage(chatId, 'Алдаа гарлаа. Дахин оролдоно уу.')
    return
  }

  await sendTelegramMessage(
    chatId,
    `Амжилттай холбогдлоо! ${staffMember.name}, та захиалгын мэдэгдэл авах болно.`
  )
}

/**
 * Handle callback query from inline keyboard (Confirm/Reject appointment).
 */
async function handleCallbackQuery(
  supabase: SupabaseClient,
  query: CallbackQuery
) {
  const data = query.data || ''
  const chatId = query.message?.chat?.id ? String(query.message.chat.id) : null
  const messageId = query.message?.message_id

  // Parse callback data: "action:UUID"
  const [action, entityId] = data.split(':')

  if (!entityId || !chatId || !messageId) {
    await answerCallbackQuery(query.id, 'Алдаа гарлаа')
    return
  }

  if (action === 'confirm_appointment') {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'confirmed' })
      .eq('id', entityId)

    if (error) {
      await answerCallbackQuery(query.id, 'Алдаа: ' + error.message)
      return
    }

    await answerCallbackQuery(query.id, 'Баталгаажуулсан!')
    await editMessageText(
      chatId,
      messageId,
      (query.message?.text || '') + '\n\n✅ Баталгаажуулсан'
    )
  } else if (action === 'reject_appointment') {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', entityId)

    if (error) {
      await answerCallbackQuery(query.id, 'Алдаа: ' + error.message)
      return
    }

    await answerCallbackQuery(query.id, 'Цуцлагдсан')
    await editMessageText(
      chatId,
      messageId,
      (query.message?.text || '') + '\n\n❌ Цуцлагдсан'
    )
  } else if (action === 'wrong_product_resend') {
    await handleWrongProductResend(supabase, query, entityId, chatId, messageId)
  } else if (action === 'wrong_product_correct') {
    await handleWrongProductCorrect(supabase, query, entityId, chatId, messageId)
  } else {
    await answerCallbackQuery(query.id, 'Тодорхойгүй үйлдэл')
  }
}

/**
 * Store manager confirms wrong product — prepare correct one and create new delivery for next day.
 */
async function handleWrongProductResend(
  supabase: SupabaseClient,
  query: CallbackQuery,
  deliveryId: string,
  chatId: string,
  messageId: number
) {
  // Fetch original delivery details
  const { data: origDelivery, error: fetchErr } = await supabase
    .from('deliveries')
    .select('id, store_id, order_id, delivery_number, delivery_address, customer_name, customer_phone, delivery_fee, delivery_type, pickup_address, notes')
    .eq('id', deliveryId)
    .single()

  if (fetchErr || !origDelivery) {
    await answerCallbackQuery(query.id, 'Хүргэлт олдсонгүй')
    return
  }

  // Generate new delivery number
  const now = new Date()
  const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const newDeliveryNumber = `DEL-${datePrefix}-${randomSuffix}`

  // Schedule for next day
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0) // Default 10:00 AM next day

  // Create new delivery
  const { data: newDelivery, error: insertErr } = await supabase
    .from('deliveries')
    .insert({
      store_id: (origDelivery as Record<string, unknown>).store_id,
      order_id: (origDelivery as Record<string, unknown>).order_id || null,
      delivery_number: newDeliveryNumber,
      status: 'pending',
      delivery_type: (origDelivery as Record<string, unknown>).delivery_type || 'own_driver',
      delivery_address: (origDelivery as Record<string, unknown>).delivery_address,
      customer_name: (origDelivery as Record<string, unknown>).customer_name,
      customer_phone: (origDelivery as Record<string, unknown>).customer_phone,
      delivery_fee: (origDelivery as Record<string, unknown>).delivery_fee,
      pickup_address: (origDelivery as Record<string, unknown>).pickup_address,
      estimated_delivery_time: tomorrow.toISOString(),
      notes: `Дахин хүргэлт (буруу бараа) — анхны хүргэлт: #${(origDelivery as Record<string, unknown>).delivery_number}`,
      metadata: { resend_from: deliveryId, reason: 'wrong_product' },
    })
    .select('id, delivery_number')
    .single()

  if (insertErr || !newDelivery) {
    await answerCallbackQuery(query.id, 'Шинэ хүргэлт үүсгэхэд алдаа гарлаа')
    console.error('[Telegram] wrong_product_resend insert error:', insertErr)
    return
  }

  // Update original delivery notes
  await supabase
    .from('deliveries')
    .update({ notes: `Буруу бараа — дахин хүргэлт: #${(newDelivery as Record<string, unknown>).delivery_number}` })
    .eq('id', deliveryId)

  // Notify store via dashboard notification
  await supabase
    .from('notifications')
    .insert({
      store_id: (origDelivery as Record<string, unknown>).store_id,
      type: 'delivery_assigned',
      title: `🔄 Дахин хүргэлт үүслээ`,
      body: `#${(newDelivery as Record<string, unknown>).delivery_number} — буруу бараа шалгагдсан. Маргааш хүргэх хүргэлт үүслээ.`,
      metadata: {
        delivery_id: (newDelivery as Record<string, unknown>).id,
        original_delivery_id: deliveryId,
        reason: 'wrong_product_resend',
      },
    })

  // Send customer a follow-up message
  if ((origDelivery as Record<string, unknown>).order_id && (origDelivery as Record<string, unknown>).store_id) {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('id', (origDelivery as Record<string, unknown>).order_id as string)
        .single()

      if (orderData?.customer_id) {
        const { data: conversation } = await supabase
          .from('conversations')
          .select('id')
          .eq('customer_id', (orderData as Record<string, unknown>).customer_id as string)
          .eq('store_id', (origDelivery as Record<string, unknown>).store_id as string)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (conversation) {
          await supabase.from('messages').insert({
            conversation_id: (conversation as Record<string, unknown>).id,
            content: `Таны захиалгын бараа шалгагдаж, зөв бараа бэлдэгдлээ. Маргааш дахин хүргэнэ. Уучлаарай! 🙏`,
            is_from_customer: false,
            is_ai_response: true,
            metadata: { type: 'wrong_product_resend', delivery_id: (newDelivery as Record<string, unknown>).id },
          })
        }
      }
    } catch (err) {
      console.error('[Telegram] wrong_product_resend customer msg error:', err)
    }
  }

  await answerCallbackQuery(query.id, 'Дахин хүргэлт үүслээ!')
  await editMessageText(
    chatId,
    messageId,
    (query.message?.text || '') +
    `\n\n✅ Зөв бараа бэлдлээ\n🔄 Шинэ хүргэлт: #${(newDelivery as Record<string, unknown>).delivery_number}\n📅 Маргааш хүргэнэ`
  )
}

/**
 * Store manager confirms the sent product was actually correct — close the issue.
 */
async function handleWrongProductCorrect(
  supabase: SupabaseClient,
  query: CallbackQuery,
  deliveryId: string,
  chatId: string,
  messageId: number
) {
  // Update delivery — mark as resolved (product was correct after all)
  const { data: delivery, error } = await supabase
    .from('deliveries')
    .update({
      notes: 'Буруу бараа мэдэгдэл — шалгасан, бараа зөв байсан',
      metadata: { wrong_product_resolved: true, resolved_action: 'correct' },
    })
    .eq('id', deliveryId)
    .select('delivery_number, store_id, order_id')
    .single()

  if (error) {
    await answerCallbackQuery(query.id, 'Алдаа: ' + error.message)
    return
  }

  // Notify store dashboard
  if (delivery) {
    await supabase
      .from('notifications')
      .insert({
        store_id: (delivery as Record<string, unknown>).store_id,
        type: 'delivery_completed',
        title: `✅ Бараа зөв байсан`,
        body: `#${(delivery as Record<string, unknown>).delivery_number} — илгээсэн бараа зөв гэж баталлаа.`,
        metadata: { delivery_id: deliveryId, reason: 'wrong_product_correct' },
      })

    // Send customer a detailed clarification message
    if ((delivery as Record<string, unknown>).order_id && (delivery as Record<string, unknown>).store_id) {
      try {
        // Fetch order items to show customer what they actually ordered
        const { data: orderData } = await supabase
          .from('orders')
          .select('customer_id, order_number, order_items(quantity, variant_label, products(name), product_variants(size, color))')
          .eq('id', (delivery as Record<string, unknown>).order_id as string)
          .single()

        if (orderData?.customer_id) {
          // Build product list for the customer
          let itemsList = ''
          const items = (orderData as Record<string, unknown>).order_items as Array<{
            quantity: number; variant_label: string | null
            products: { name: string } | null
            product_variants: { size: string | null; color: string | null } | null
          }> | undefined
          if (items && items.length > 0) {
            itemsList = items.map((item) => {
              const parts = [item.products?.name || 'Бараа']
              if (item.product_variants?.size) parts.push(`размер: ${item.product_variants.size}`)
              if (item.product_variants?.color) parts.push(`өнгө: ${item.product_variants.color}`)
              if (item.variant_label) parts.push(item.variant_label)
              return `• ${parts.join(', ')} x${item.quantity}`
            }).join('\n')
          }

          const { data: conversation } = await supabase
            .from('conversations')
            .select('id')
            .eq('customer_id', (orderData as Record<string, unknown>).customer_id as string)
            .eq('store_id', (delivery as Record<string, unknown>).store_id as string)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (conversation) {
            const clarifyMsg =
              `Таны захиалгын бараа дэлгүүрээс шалгагдлаа.\n\n` +
              `Таны захиалга #${(orderData as Record<string, unknown>).order_number || ''}:\n` +
              `${itemsList || '(мэдээлэл олдсонгүй)'}\n\n` +
              `✅ Дэлгүүр шалгахад илгээсэн бараа таны захиалгын дагуу зөв байсан.\n\n` +
              `Хэрэв та өөр бараа хүлээж байсан бол:\n` +
              `- Магадгүй барааны нэр, размер, өнгө андуурсан байж болох юм\n` +
              `- Захиалга хийхдээ өөр бараа сонгосон байж болзошгүй\n\n` +
              `Асуудал байвал бидэнтэй чатаар холбогдож, ямар бараа хүлээж байсанаа хэлнэ үү. Бид тусалъя! 🙏`

            await supabase.from('messages').insert({
              conversation_id: (conversation as Record<string, unknown>).id,
              content: clarifyMsg,
              is_from_customer: false,
              is_ai_response: true,
              metadata: { type: 'wrong_product_correct', delivery_id: deliveryId },
            })
          }
        }
      } catch (err) {
        console.error('[Telegram] wrong_product_correct customer msg error:', err)
      }
    }
  }

  await answerCallbackQuery(query.id, 'Бүртгэгдлээ')
  await editMessageText(
    chatId,
    messageId,
    (query.message?.text || '') + '\n\n✅ Бараа зөв байсан гэж баталлаа'
  )
}
