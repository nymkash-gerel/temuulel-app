/**
 * POST /api/telegram/driver
 *
 * Telegram webhook endpoint for the driver bot.
 * Set this as the webhook URL in BotFather:
 *   POST https://api.telegram.org/bot{TOKEN}/setWebhook
 *   { "url": "https://your-domain.vercel.app/api/telegram/driver" }
 *
 * Handles:
 *   - /start command → driver onboarding (link Telegram to driver account)
 *   - /orders        → list active deliveries
 *   - /help          → command list
 *   - Phone number messages → link by phone
 *   - Photo messages → delivery proof (auto-marks delivery as confirmed)
 *   - Natural language → driver intent engine (delivered, picked up, etc.)
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  tgSend,
  tgAnswerCallback,
  tgRemoveButtons,
  enRouteKeyboard,
  delayKeyboard,
  issueKeyboard,
  orderAssignedKeyboard,
  intercityKeyboard,
  intercityTransportKeyboard,
  intercityConfirmKeyboard,
  intercityPaymentKeyboard,
  intercityCustomerMessage,
  paymentKeyboard,
  sendToDriver,
  DRIVER_BOT_WELCOME,
  DRIVER_BOT_LINKED,
  DRIVER_BOT_NOT_FOUND,
  DRIVER_BOT_ALREADY_LINKED,
  DRIVER_PROACTIVE_MESSAGES,
  type IntercityWizard,
  type TgInlineKeyboard,
} from '@/lib/driver-telegram'
import { processDriverMessage } from '@/lib/driver-chat-engine'
import { assignDriver, DEFAULT_DELIVERY_SETTINGS } from '@/lib/ai/delivery-assigner'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key)
}

/** Telegram update shape (only fields we use) */
interface TgPhotoSize {
  file_id: string
  file_unique_id: string
  width: number
  height: number
  file_size?: number
}

interface TgMessage {
  message_id: number
  from: { id: number; first_name: string; username?: string }
  chat: { id: number; type: string }
  text?: string
  contact?: { phone_number: string; user_id?: number }
  /** Array of photo sizes (smallest → largest). Last element is highest quality. */
  photo?: TgPhotoSize[]
  caption?: string
}

interface TgCallbackQuery {
  id: string
  from: { id: number; first_name: string }
  message?: TgMessage
  data?: string
}

interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: TgCallbackQuery
}

/** Handle inline button taps from drivers */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCallbackQuery(
  supabase: any,
  cb: TgCallbackQuery
): Promise<void> {
  const chatId = cb.message?.chat.id ?? cb.from.id
  const messageId = cb.message?.message_id
  const data = cb.data ?? ''
  const [action, deliveryId] = data.split(':')

  if (!deliveryId) {
    await tgAnswerCallback(cb.id, '❌ Алдаа гарлаа')
    return
  }

  // Look up driver by chat_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!driver) {
    await tgAnswerCallback(cb.id, '❌ Жолооч олдсонгүй')
    return
  }

  // Remove buttons from original message
  if (messageId) await tgRemoveButtons(chatId, messageId)

  switch (action) {
    case 'arrived_at_store': {
      // Driver tapped "🏪 Дэлгүүрт ирлээ"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'at_store', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      await tgAnswerCallback(cb.id, '🏪 Бүртгэгдлээ!')
      await tgSend(chatId,
        `🏪 <b>Дэлгүүрт ирсэн гэж бүртгэгдлээ.</b>\n\n` +
        `Дэлгүүрийн менежер барааг таньд өгсний дараа "Бараа өгсөн" дарна.\n` +
        `Та хүлээх шаардлагатай — Telegram-д мэдэгдэл ирнэ.`
      )
      break
    }

    case 'picked_up': {
      // Legacy callback (old messages sent before arrived_at_store flow) — still works
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'picked_up' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      await tgSend(chatId,
        `✅ <b>Авлаа гэж бүртгэгдлээ.</b>\n\nХаягруу явна уу. Хүргэсэн үедээ доорх товчийг дарна уу.`,
        { replyMarkup: enRouteKeyboard(deliveryId) }
      )
      break
    }

    case 'delivered': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deliveredRow } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .select('id, customer_phone, customer_name')
        .single()

      await tgAnswerCallback(cb.id, '🎉 Амжилттай!')

      const phoneInfo = deliveredRow?.customer_phone
        ? `\n📞 Харилцагчийн утас: <code>${deliveredRow.customer_phone}</code>`
        : ''
      const customerInfo = deliveredRow?.customer_name
        ? ` — ${deliveredRow.customer_name}` : ''

      await tgSend(chatId,
        `🎉 <b>Хүргэлт амжилттай!</b>${customerInfo}${phoneInfo}\n\n` +
        `💳 <b>Төлбөрийн байдал ямар байна?</b>`,
        { replyMarkup: paymentKeyboard(deliveryId) }
      )
      break
    }

    case 'payment_received': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: paidDelivery } = await (supabase as any)
        .from('deliveries')
        .select('order_id')
        .eq('id', deliveryId)
        .single()
      if (paidDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', paidDelivery.order_id)
      }
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      await tgSend(chatId, `✅ <b>Төлбөр авсан гэж бүртгэгдлээ.</b>\n\nБаярлалаа, ${driver.name}!`)
      break
    }

    case 'payment_pending': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingDelivery } = await (supabase as any)
        .from('deliveries')
        .select('order_id, customer_phone, store_id')
        .eq('id', deliveryId)
        .single()

      if (pendingDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'pending', notes: 'Жолооч: дараа төлнө гэсэн' })
          .eq('id', pendingDelivery.order_id)
      }
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      const phone = pendingDelivery?.customer_phone
      await tgSend(chatId,
        `⏳ <b>Дараа төлнө гэж бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдлээ.` +
        (phone ? `\n📞 Хэрэв харилцагчтай холбогдох шаардлагатай бол: <code>${phone}</code>` : '')
      )
      break
    }

    case 'payment_declined': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: declinedDelivery } = await (supabase as any)
        .from('deliveries')
        .select('order_id, customer_phone, customer_name, store_id')
        .eq('id', deliveryId)
        .single()

      if (declinedDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'failed', notes: 'Жолооч: харилцагч төлбөр татгалзав' })
          .eq('id', declinedDelivery.order_id)
      }
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      const declinedPhone = declinedDelivery?.customer_phone
      await tgSend(chatId,
        `❌ <b>Татгалзав гэж бүртгэгдлээ.</b>\n\nДэлгүүрт яаралтай мэдэгдлээ.` +
        (declinedPhone ? `\n📞 Харилцагч: <code>${declinedPhone}</code> — ${declinedDelivery?.customer_name || ''}` : '')
      )
      break
    }

    case 'unreachable': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'delayed', notes: 'Харилцагч утас авсангүй' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `📵 <b>Бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдлээ. Удахгүй зааварчилгаа ирнэ.`)
      break
    }

    case 'delay': {
      // Show time-choice menu instead of immediately setting delayed
      await tgAnswerCallback(cb.id)
      await tgSend(chatId,
        `⏰ <b>Хэзээ хүргэх боломжтой вэ?</b>\nДоорхоос сонгоно уу:`,
        { replyMarkup: delayKeyboard(deliveryId) }
      )
      break
    }

    case 'delay_time': {
      // callback_data format: delay_time:<choice>:<deliveryId>
      const dtParts = data.split(':')
      const delayChoice = dtParts[1]     // today | tomorrow | week | custom
      const dtDeliveryId = dtParts[2]    // actual delivery UUID

      if (delayChoice === 'custom') {
        // Save awaiting state in driver metadata — next text will be the custom time
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: drvMeta } = await (supabase as any).from('delivery_drivers').select('metadata').eq('telegram_chat_id', chatId).single()
        const newMeta = { ...(drvMeta?.metadata ?? {}), awaiting_delay_time: dtDeliveryId }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({ metadata: newMeta }).eq('telegram_chat_id', chatId)
        await tgAnswerCallback(cb.id)
        await tgSend(chatId, `✏️ <b>Хүргэх цагийг бичнэ үү.</b>\n\nЖишээ нь:\n• "Өнөөдөр 18:00"\n• "Маргааш 10-11 цаг"\n• "Гаригт 14:00"`)
        break
      }

      const now = new Date()
      let etaLabel = ''
      let etaIso = ''
      if (delayChoice === 'today') {
        now.setHours(now.getHours() + 3)
        etaIso = now.toISOString()
        etaLabel = 'Өнөөдөр дараа (~3 цаг)'
      } else if (delayChoice === 'tomorrow') {
        now.setDate(now.getDate() + 1)
        now.setHours(12, 0, 0, 0)
        etaIso = now.toISOString()
        etaLabel = 'Маргааш'
      } else if (delayChoice === 'week') {
        const daysToSat = (6 - now.getDay() + 7) % 7 || 7
        now.setDate(now.getDate() + daysToSat)
        now.setHours(12, 0, 0, 0)
        etaIso = now.toISOString()
        etaLabel = 'Энэ долоо хоногт'
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: delayedDel } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'delayed', estimated_delivery_time: etaIso || null })
        .eq('id', dtDeliveryId)
        .select('delivery_number, store_id')
        .single()

      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId,
        `⏰ <b>Хоцрох тухай бүртгэгдлээ.</b>\n\n📅 Шинэ хугацаа: ${etaLabel}\nДэлгүүрт мэдэгдлээ.`,
        { replyMarkup: enRouteKeyboard(dtDeliveryId) }
      )
      if (delayedDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: delayedDel.store_id, type: 'delivery_delayed',
          title: '⏰ Хүргэлт хоцорлоо',
          body: `${driver.name} — #${delayedDel.delivery_number}: ${etaLabel} хүргэнэ.`,
          metadata: { delivery_id: dtDeliveryId, eta: etaIso },
        }).catch(() => {})
      }
      break
    }

    case 'issue': {
      await tgAnswerCallback(cb.id)
      await tgSend(chatId, `⚠️ <b>Ямар асуудал гарсан бэ?</b>`, { replyMarkup: issueKeyboard(deliveryId) })
      break
    }

    case 'wrong_product': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: wpDel } = await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Буруу бараа' }).eq('id', deliveryId).select('delivery_number, store_id').single()
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `📦 <b>Буруу бараа гэж бүртгэгдлээ.</b>\n\nБарааг агуулахад буцааж өгнө үү.`)
      if (wpDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: wpDel.store_id, type: 'delivery_failed', title: '📦 Буруу бараа', body: `${driver.name} — #${wpDel.delivery_number}: буруу бараа.`, metadata: { delivery_id: deliveryId, reason: 'wrong_product' } }).catch(() => {})
      }
      break
    }

    case 'damaged': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dmDel } = await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Гэмтсэн бараа' }).eq('id', deliveryId).select('delivery_number, store_id').single()
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `💔 <b>Гэмтсэн бараа гэж бүртгэгдлээ.</b>\n\nЗураг авч, агуулахад буцааж өгнө үү.`)
      if (dmDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: dmDel.store_id, type: 'delivery_failed', title: '💔 Гэмтсэн бараа', body: `${driver.name} — #${dmDel.delivery_number}: гэмтсэн бараа. Зураг авсан.`, metadata: { delivery_id: deliveryId, reason: 'damaged' } }).catch(() => {})
      }
      break
    }

    case 'no_payment': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: npDel } = await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Харилцагч мөнгө өгсөнгүй' }).eq('id', deliveryId).select('delivery_number, store_id').single()
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `💰 <b>Мөнгө өгсөнгүй гэж бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдэллээ.`)
      if (npDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: npDel.store_id, type: 'delivery_failed', title: '💰 Мөнгө өгсөнгүй', body: `${driver.name} — #${npDel.delivery_number}: харилцагч мөнгө өгсөнгүй.`, metadata: { delivery_id: deliveryId, reason: 'no_payment' } }).catch(() => {})
      }
      break
    }

    case 'confirm_cod': {
      // Driver confirms COD payment collected — show payment keyboard
      await tgAnswerCallback(cb.id)
      await tgSend(chatId,
        `💳 <b>Төлбөрийн байдал?</b>\n\nХарилцагч мөнгийг өгсөн эсэхийг сонгоно уу.`,
        { replyMarkup: paymentKeyboard(deliveryId) }
      )
      break
    }

    case 'customer_info': {
      // Show customer contact details so driver can call directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: infoDelivery } = await (supabase as any)
        .from('deliveries')
        .select('customer_name, customer_phone, delivery_address, delivery_number')
        .eq('id', deliveryId)
        .single()
      await tgAnswerCallback(cb.id)
      if (!infoDelivery) {
        await tgSend(chatId, `❓ Захиалгын мэдээлэл олдсонгүй.`)
        break
      }
      await tgSend(chatId,
        `📋 <b>Харилцагчийн мэдээлэл — #${infoDelivery.delivery_number}</b>\n\n` +
        `👤 Нэр: ${infoDelivery.customer_name || '—'}\n` +
        `📞 Утас: ${infoDelivery.customer_phone ? `<code>${infoDelivery.customer_phone}</code>` : '—'}\n` +
        `📍 Хаяг: ${infoDelivery.delivery_address || '—'}`
      )
      break
    }

    case 'receiver_complaint': {
      // Receiver has a complaint — mark delayed, notify store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delayed', notes: 'Хүлээн авагч гомдол мэдэгдлээ' })
        .eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId,
        `💬 <b>Гомдол бүртгэгдлээ.</b>\n\n` +
        `Дэлгүүрийн менежерт мэдэгдлээ. Удахгүй холбогдох болно.\n` +
        `Барааг хэвийнээр хүргэх эсэхийг хүлээгээрэй.`
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: complaintDelivery } = await (supabase as any)
        .from('deliveries')
        .select('delivery_number, store_id')
        .eq('id', deliveryId)
        .single()
      if (complaintDelivery) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: complaintDelivery.store_id,
          type: 'delivery_delayed',
          title: 'Хүлээн авагч гомдол мэдэгдлээ',
          body: `${driver.name} — Захиалга #${complaintDelivery.delivery_number}: хүлээн авагч гомдол мэдэгдлээ. Холбогдоно уу.`,
          metadata: { delivery_id: deliveryId, reason: 'receiver_complaint' },
        }).catch(() => {})
      }
      break
    }

    case 'reject': {
      // Reset delivery to pending
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rejectedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'pending', driver_id: null })
        .eq('id', deliveryId)
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, store_id, order_id')
        .single()

      await tgAnswerCallback(cb.id, 'Татгалзлаа')
      await tgSend(chatId, `↩️ Татгалзлаа. Баярлалаа — дэлгүүр өөр жолооч томилно.`)

      // Auto-reassign: find next available driver
      if (rejectedDelivery) {
        try {
          // Get other available drivers (excluding the rejecting driver)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: otherDrivers } = await (supabase as any)
            .from('delivery_drivers')
            .select('id, name, vehicle_type, current_location, delivery_zones')
            .eq('store_id', rejectedDelivery.store_id)
            .neq('id', driver.id)
            .in('status', ['active', 'on_delivery'])

          if (otherDrivers && otherDrivers.length > 0) {
            // Build candidates
            const candidates = await Promise.all(otherDrivers.map(async (d: any) => {
              const { count } = await supabase
                .from('deliveries')
                .select('id', { count: 'exact', head: true })
                .eq('driver_id', d.id)
                .in('status', ['assigned', 'picked_up', 'in_transit'])
              return {
                id: d.id, name: d.name,
                location: d.current_location,
                active_delivery_count: count || 0,
                vehicle_type: d.vehicle_type,
                completion_rate: 100,
                delivery_zones: d.delivery_zones || [],
              }
            }))

            const result = await assignDriver(
              { address: rejectedDelivery.delivery_address },
              candidates,
              { ...DEFAULT_DELIVERY_SETTINGS, assignment_mode: 'auto' }
            )

            if (result.recommended_driver_id) {
              // Assign new driver
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from('deliveries')
                .update({ status: 'assigned', driver_id: result.recommended_driver_id })
                .eq('id', deliveryId)

              // Notify new driver via Telegram
              await sendToDriver(
                supabase,
                result.recommended_driver_id,
                DRIVER_PROACTIVE_MESSAGES.orderAssigned({
                  orderNumber: rejectedDelivery.delivery_number,
                  deliveryAddress: rejectedDelivery.delivery_address,
                  customerName: rejectedDelivery.customer_name,
                  customerPhone: rejectedDelivery.customer_phone,
                }),
                orderAssignedKeyboard(deliveryId)
              )
              console.log(`[DriverBot] Auto-reassigned ${deliveryId} to ${result.recommended_driver_id}`)
            } else {
              // No driver available — log for store owner
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('notifications').insert({
                store_id: rejectedDelivery.store_id,
                type: 'delivery_unassigned',
                title: `Хүргэлт томилогдоогүй — #${rejectedDelivery.delivery_number}`,
                message: `${driver.name} татгалзсан. Боломжтой жолооч байхгүй байна.`,
                metadata: { delivery_id: deliveryId },
              }).catch(() => {})
              console.log(`[DriverBot] No available driver for ${deliveryId} after rejection`)
            }
          }
        } catch (err) {
          console.error('[DriverBot] Auto-reassign failed:', err)
        }
      }
      break
    }

    // ── Intercity wizard ─────────────────────────────────────────────────

    case 'intercity_start': {
      // Driver tapped "🚌 Тээвэрт өгсөн" — start wizard
      await tgAnswerCallback(cb.id, '📋 Мэдээлэл оруулна уу')
      // Save wizard state to driver metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow) { await tgAnswerCallback(cb.id, '❌ Жолооч олдсонгүй'); break }

      const wizard: IntercityWizard = { delivery_id: deliveryId, step: 'transport_type' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...(driverRow.metadata as object || {}), intercity_wizard: wizard },
      }).eq('id', driverRow.id)

      await tgSend(chatId,
        `🚌 <b>Хотоор хоорондын тээвэр</b>\n\nТээврийн төрлийг сонгоно уу:`,
        { replyMarkup: intercityTransportKeyboard(deliveryId) }
      )
      break
    }

    case 'intercity_type': {
      // action = 'intercity_type', deliveryId = 'bus' or 'private', third part = actual id
      // callback_data format: intercity_type:bus:deliveryId
      const parts = data.split(':')
      const transport = parts[1] as 'bus' | 'private'
      const actualDeliveryId = parts[2]
      if (!transport || !actualDeliveryId) { await tgAnswerCallback(cb.id, '❌ Алдаа'); break }

      await tgAnswerCallback(cb.id, transport === 'bus' ? '🚌 Автобус' : '🚗 Хувийн жолооч')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow2 } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow2) break

      const wizard2: IntercityWizard = {
        delivery_id: actualDeliveryId,
        step: 'phone',
        transport,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...(driverRow2.metadata as object || {}), intercity_wizard: wizard2 },
      }).eq('id', driverRow2.id)

      const label = transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
      await tgSend(chatId,
        `${label} сонгогдлоо.\n\n📞 <b>Жолоочийн утасны дугаар</b> оруулна уу:\n(жишээ: 99112233)`
      )
      break
    }

    case 'intercity_pay_yes':
    case 'intercity_pay_no': {
      const paymentCollected = action === 'intercity_pay_yes'
      await tgAnswerCallback(cb.id, paymentCollected ? '✅ Баталгаажлаа' : '📋 Бүртгэгдлээ')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ipDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!ipDriver) break

      const ipMeta = ipDriver.metadata as Record<string, unknown> | null
      const ipWiz = ipMeta?.intercity_wizard as IntercityWizard | undefined
      if (!ipWiz) break

      const updatedWiz: IntercityWizard = { ...ipWiz, step: 'confirm', payment_collected: paymentCollected }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...ipMeta, intercity_wizard: updatedWiz },
      }).eq('id', ipDriver.id)

      // Show summary for confirmation
      const tLabel = ipWiz.transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
      const payLabel = paymentCollected ? '✅ Урьдчилж авсан' : '⏳ Дараа авна'
      await tgSend(chatId,
        `💳 Төлбөр: <b>${payLabel}</b> ✅\n\n` +
        `──────────────────\n` +
        `📋 <b>Дараах мэдээлэл үнэн зөв үү?</b>\n\n` +
        `${tLabel}\n` +
        `📞 Жолоочийн утас: <b>${ipWiz.phone}</b>\n` +
        `🚗 Машины дугаар: <b>${ipWiz.license}</b>\n` +
        `⏰ Ирэх хугацаа: <b>${ipWiz.eta}</b>\n` +
        `💳 Төлбөр: <b>${payLabel}</b>`,
        { replyMarkup: intercityConfirmKeyboard(ipWiz.delivery_id) }
      )
      break
    }

    case 'intercity_confirm': {
      // Confirm — save to DB + send customer message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow3 } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow3) { await tgAnswerCallback(cb.id, '❌ Алдаа'); break }

      const meta3 = driverRow3.metadata as Record<string, unknown> | null
      const wiz3 = meta3?.intercity_wizard as IntercityWizard | undefined
      if (!wiz3 || wiz3.step !== 'confirm' || !wiz3.transport || !wiz3.phone || !wiz3.license || !wiz3.eta) {
        await tgAnswerCallback(cb.id, '❌ Мэдээлэл дутуу — дахин оролдоно уу')
        break
      }

      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')

      const handoff = {
        transport: wiz3.transport,
        phone: wiz3.phone,
        license: wiz3.license,
        eta: wiz3.eta,
        payment_collected: wiz3.payment_collected ?? false,
        dispatched_at: new Date().toISOString(),
      }

      // Update delivery status + store handoff in metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({
          status: 'in_transit',
          estimated_delivery_time: wiz3.eta,
          metadata: { intercity_handoff: handoff },
          updated_at: new Date().toISOString(),
        })
        .eq('id', wiz3.delivery_id)
        .select('id, order_id, delivery_number, store_id')
        .single()

      // Clear wizard state from driver
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clearedMeta = { ...(driverRow3.metadata as object || {}) }
      delete (clearedMeta as Record<string, unknown>).intercity_wizard
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('id', driverRow3.id)

      // Send customer notification via messages table
      if (updatedDelivery?.order_id) {
        try {
          // Get order number
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: order } = await (supabase as any)
            .from('orders')
            .select('order_number, customer_id')
            .eq('id', updatedDelivery.order_id)
            .single()

          if (order?.customer_id) {
            // Find the most recent conversation for this customer + store
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: conversation } = await (supabase as any)
              .from('conversations')
              .select('id')
              .eq('customer_id', order.customer_id)
              .eq('store_id', updatedDelivery.store_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (conversation) {
              const customerMsg = intercityCustomerMessage(order.order_number, handoff)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('messages').insert({
                conversation_id: conversation.id,
                content: customerMsg,
                is_from_customer: false,
                is_ai_response: false,
                metadata: { type: 'intercity_dispatch', handoff },
              })
            }
          }
        } catch (notifyErr) {
          console.error('[DriverBot] Customer notify failed:', notifyErr)
        }
      }

      // Confirm to driver
      const transportLabel = wiz3.transport === 'bus' ? '🚌 Хотын автобус' : '🚗 Хувийн жолооч'
      const paymentLabel = wiz3.payment_collected ? '✅ Авсан' : '⏳ Дараа'
      await tgSend(chatId,
        `✅ <b>Амжилттай бүртгэгдлээ!</b>\n\n` +
        `📦 Захиалга: #${updatedDelivery?.delivery_number || wiz3.delivery_id}\n` +
        `${transportLabel}\n` +
        `📞 Жолоочийн утас: ${wiz3.phone}\n` +
        `🚗 Машины дугаар: ${wiz3.license}\n` +
        `⏰ Ирэх хугацаа: ${wiz3.eta}\n` +
        `💳 Төлбөр: ${paymentLabel}\n\n` +
        `Харилцагч руу мэдэгдэл явуулсан. Баярлалаа!`
      )
      break
    }

    case 'intercity_retry': {
      // Reset wizard back to transport_type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driverRow4 } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()
      if (!driverRow4) { await tgAnswerCallback(cb.id, '❌ Алдаа'); break }

      const meta4 = driverRow4.metadata as Record<string, unknown> | null
      const wiz4 = meta4?.intercity_wizard as IntercityWizard | undefined
      const retryDeliveryId = wiz4?.delivery_id || deliveryId

      const freshWizard: IntercityWizard = { delivery_id: retryDeliveryId, step: 'transport_type' }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...(driverRow4.metadata as object || {}), intercity_wizard: freshWizard },
      }).eq('id', driverRow4.id)

      await tgAnswerCallback(cb.id, '🔄 Дахин оруулна уу')
      await tgSend(chatId,
        `🔄 <b>Дахин оруулна уу.</b>\n\nТээврийн төрлийг сонгоно уу:`,
        { replyMarkup: intercityTransportKeyboard(retryDeliveryId) }
      )
      break
    }

    default:
      await tgAnswerCallback(cb.id, '❓ Тодорхойгүй үйлдэл')
  }
}

/** Clean a phone number to 8 digits (Mongolian mobile) */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^976/, '').slice(-8)
}

/** Check if a string looks like a Mongolian phone number (any common format) */
function looksLikePhone(text: string): boolean {
  const digits = text.replace(/\D/g, '')
  // 8 digits (local), 11 digits (976 + 8), 12 digits (+976 + 8)
  return digits.length === 8 || digits.length === 11 || digits.length === 12
}

export async function POST(request: NextRequest) {
  // Verify request is from Telegram (optional secret header)
  const secret = process.env.DRIVER_TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token')
    if (header !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let update: TgUpdate
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true }) // Telegram retries on non-200, always return 200
  }

  const supabase = getSupabase()

  // ── Inline button callback ───────────────────────────────────────────────
  if (update.callback_query) {
    await handleCallbackQuery(supabase, update.callback_query)
    return NextResponse.json({ ok: true })
  }

  const msg = update.message
  if (!msg?.text && !msg?.contact && !msg?.photo) return NextResponse.json({ ok: true })

  const chatId = msg.chat.id
  const text = msg.text?.trim() ?? ''

  // ── /start command ───────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    // Deep-link: /start <driverId> — auto-link without needing phone number
    const param = text.split(' ')[1]?.trim()
    if (param && param.length > 10) {
      // Looks like a UUID-based driver ID — try to link directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: driver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, name, telegram_chat_id')
        .eq('id', param)
        .maybeSingle()

      if (!driver) {
        await tgSend(chatId,
          `❌ Холбоос хүчингүй байна.\n\nДэлгүүрийн менежерээсээ шинэ холбоос авна уу.`
        )
        return NextResponse.json({ ok: true })
      }

      if (driver.telegram_chat_id && driver.telegram_chat_id !== chatId) {
        // Already linked to a different Telegram account
        await tgSend(chatId, DRIVER_BOT_ALREADY_LINKED(driver.name))
        return NextResponse.json({ ok: true })
      }

      // Link this Telegram chat to the driver
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('delivery_drivers')
        .update({
          telegram_chat_id: chatId,
          telegram_linked_at: new Date().toISOString(),
        })
        .eq('id', driver.id)

      await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
      return NextResponse.json({ ok: true })
    }

    // Plain /start with no param → welcome + prompt for phone
    await tgSend(chatId, DRIVER_BOT_WELCOME)
    return NextResponse.json({ ok: true })
  }

  // ── /help command ───────────────────────────────────────────────────────
  if (text === '/help') {
    await tgSend(chatId,
      `🚚 <b>Жолоочийн бот — тушаалууд</b>\n\n` +
      `/orders — Миний идэвхтэй захиалгууд\n` +
      `/help — Тушаалын жагсаалт\n\n` +
      `<b>Статус шинэчлэх:</b>\n` +
      `Товч дарах замаар шинэчилнэ үү (товч тогтоогүй бол доорхийг бичнэ үү):\n` +
      `• "Авлаа" — бараа авсан\n` +
      `• "Хүргэлээ" — хүргэлт дууссан\n` +
      `• "Дэлгүүрт ирлээ" — дэлгүүрт очсон\n` +
      `• "Холбогдохгүй байна" — хэрэглэгч утас аваагүй\n\n` +
      `📸 <b>Хүргэлтийн зургийг илгээвэл автоматаар бүртгэгдэнэ.</b>`
    )
    return NextResponse.json({ ok: true })
  }

  // ── /orders command ──────────────────────────────────────────────────────
  if (text === '/orders') {
    // Look up the driver by Telegram chat ID first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ordersDriver } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name')
      .eq('telegram_chat_id', chatId)
      .maybeSingle()

    if (!ordersDriver) {
      await tgSend(chatId, `❓ Таны акаунт холбогдоогүй байна.\nУтасны дугаараа илгээнэ үү.`)
      return NextResponse.json({ ok: true })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deliveries } = await (supabase as any)
      .from('deliveries')
      .select(`
        id, status, delivery_type, created_at,
        orders!inner(order_number, shipping_address, total_amount),
        customers(name, phone)
      `)
      .eq('driver_id', ordersDriver.id)
      .in('status', ['assigned', 'at_store', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: true })
      .limit(10)

    if (!deliveries || deliveries.length === 0) {
      await tgSend(chatId, `📭 Одоогоор хуваарилагдсан захиалга байхгүй байна.`)
      return NextResponse.json({ ok: true })
    }

    const STATUS_LABEL: Record<string, string> = {
      assigned: '🟡 Хуваарилагдсан',
      at_store: '🏪 Дэлгүүрт хүлээж байна',
      picked_up: '📦 Авсан — хүргэж байна',
      in_transit: '🚚 Замд яваа',
      delayed: '⏰ Хоцорсон',
    }

    // Send a header first
    await tgSend(chatId, `🚚 <b>Таны захиалгууд (${deliveries.length})</b>\nДоорх захиалга тус бүрд шаардлагатай үйлдлийг сонгоно уу:`)

    // Send each delivery as a separate card with action buttons
    for (const d of deliveries as {
      id: string; status: string; delivery_type: string
      delivery_number?: string; customer_name?: string; customer_phone?: string; delivery_address?: string
      orders: { order_number: string; shipping_address: string; total_amount: number } | null
    }[]) {
      const statusLabel = STATUS_LABEL[d.status] ?? d.status
      const orderNum = d.delivery_number ?? d.orders?.order_number ?? d.id.slice(0, 8)
      const address = d.delivery_address ?? d.orders?.shipping_address ?? '—'
      const customer = d.customer_name ?? '—'
      const phone = d.customer_phone ?? ''
      const tag = d.delivery_type === 'intercity_post' ? ' 🚌' : ''

      const cardText =
        `📋 <b>${orderNum}${tag}</b> — ${statusLabel}\n` +
        `👤 ${customer}${phone ? ` · <code>${phone}</code>` : ''}\n` +
        `📍 ${address.slice(0, 80)}${address.length > 80 ? '…' : ''}`

      // Choose keyboard based on current status
      let keyboard: TgInlineKeyboard | undefined
      if (d.status === 'assigned' || d.status === 'at_store') {
        keyboard = orderAssignedKeyboard(d.id)
      } else if (['picked_up', 'in_transit', 'delayed'].includes(d.status)) {
        keyboard = enRouteKeyboard(d.id)
      }

      await tgSend(chatId, cardText, keyboard ? { replyMarkup: keyboard } : undefined)
    }

    return NextResponse.json({ ok: true })
  }

  // ── Early driver lookup — needed to protect wizard from phone-linking handler ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: earlyDriver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, metadata')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  const earlyMeta = earlyDriver?.metadata as Record<string, unknown> | null
  const earlyWizard = earlyMeta?.intercity_wizard as IntercityWizard | undefined
  const hasActiveWizard = !!earlyWizard

  // ── Custom delay time input ───────────────────────────────────────────────
  // Driver typed a custom delivery time after clicking "✏️ Өөр цаг оруулах"
  const awaitingDelayDeliveryId = earlyMeta?.awaiting_delay_time as string | undefined
  if (awaitingDelayDeliveryId && text && !text.startsWith('/')) {
    // Save the custom ETA text as a note + mark delayed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customDelDel } = await (supabase as any)
      .from('deliveries')
      .update({ status: 'delayed', notes: `Хоцрох: ${text}` })
      .eq('id', awaitingDelayDeliveryId)
      .select('delivery_number, store_id')
      .single()

    // Clear the awaiting flag
    const clearedMeta = { ...earlyMeta }
    delete clearedMeta.awaiting_delay_time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

    await tgSend(chatId,
      `⏰ <b>Бүртгэгдлээ.</b>\n\n📅 Шинэ хугацаа: "${text}"\nДэлгүүрт мэдэгдлээ.`,
      { replyMarkup: enRouteKeyboard(awaitingDelayDeliveryId) }
    )
    if (customDelDel) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: customDelDel.store_id, type: 'delivery_delayed',
        title: '⏰ Хүргэлт хоцорлоо',
        body: `${earlyDriver?.name ?? 'Жолооч'} — #${customDelDel.delivery_number}: "${text}" хүргэнэ.`,
        metadata: { delivery_id: awaitingDelayDeliveryId, eta_text: text },
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  }

  // ── Phone number (onboarding) ────────────────────────────────────────────
  // Skip if driver is already linked AND has an active wizard (their text is wizard input)
  if (!hasActiveWizard && (looksLikePhone(text) || msg.contact)) {
    const rawPhone = msg.contact?.phone_number ?? text
    const phone = normalizePhone(rawPhone) // Always 8 digits e.g. "99112233"

    // Look up driver — phones may be stored in any format (8 digits, +976..., 976...)
    // so we match against the last 8 digits using ilike
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: driver, error: lookupError } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name, phone')
      .ilike('phone', `%${phone}`)
      .maybeSingle()

    if (lookupError || !driver) {
      console.log(`[DriverBot] NOT FOUND — phone "${phone}" not in DB`)
      await tgSend(chatId, DRIVER_BOT_NOT_FOUND)
      return NextResponse.json({ ok: true })
    }

    // Save chat_id (also checks if already linked via re-fetch)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('delivery_drivers')
      .update({
        telegram_chat_id: chatId,
        telegram_linked_at: new Date().toISOString(),
      })
      .eq('id', driver.id)

    if (updateError) {
      console.error(`[DriverBot] Update failed: ${updateError.message}`)
      // Column may not exist yet (migration 049 pending) — still send welcome
    }

    await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
    return NextResponse.json({ ok: true })
  }

  // ── Natural language from authenticated driver ───────────────────────────
  // Reuse earlyDriver from above (already fetched by chatId)
  const driver = earlyDriver as { id: string; name?: string; metadata?: unknown } | null

  if (!driver) {
    // Unknown sender — prompt to link first
    await tgSend(
      chatId,
      `❓ Таны акаунт холбогдоогүй байна.\n\nУтасны дугаараа илгээнэ үү (жишээ: 99112233).`
    )
    return NextResponse.json({ ok: true })
  }

  // ── Intercity wizard text-input handler ─────────────────────────────────
  // Reuse earlyMeta / earlyWizard from above
  const driverMetadata = earlyMeta
  const activeWizard = earlyWizard

  if (activeWizard) {
    const wiz = activeWizard

    switch (wiz.step) {
      case 'phone': {
        // Driver sent phone number for the bus/private driver
        const updatedWiz: IntercityWizard = { ...wiz, step: 'license', phone: text }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({
          metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
        }).eq('id', driver.id)

        await tgSend(chatId,
          `📞 Утас: <b>${text}</b> ✅\n\n🚗 <b>Машины дугаар</b> оруулна уу:\n(жишээ: 1234 УНА)`
        )
        return NextResponse.json({ ok: true })
      }

      case 'license': {
        // Driver sent the license plate
        const updatedWiz: IntercityWizard = { ...wiz, step: 'eta', license: text }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({
          metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
        }).eq('id', driver.id)

        await tgSend(chatId,
          `🚗 Дугаар: <b>${text}</b> ✅\n\n⏰ <b>Ойролцоо ирэх хугацаа</b> оруулна уу:\n(жишээ: Маргааш 14:00, Ням гарагт 18:00)`
        )
        return NextResponse.json({ ok: true })
      }

      case 'eta': {
        // Driver sent estimated arrival time → ask about payment
        const updatedWiz: IntercityWizard = { ...wiz, step: 'payment', eta: text }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({
          metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
        }).eq('id', driver.id)

        await tgSend(chatId,
          `⏰ Хугацаа: <b>${text}</b> ✅\n\n` +
          `💳 <b>Барааны төлбөр урьдчилж авсан уу?</b>`,
          { replyMarkup: intercityPaymentKeyboard(wiz.delivery_id) }
        )
        return NextResponse.json({ ok: true })
      }

      case 'payment': {
        // They sent text instead of pressing a button on the payment step
        await tgSend(chatId, `⬆️ Дээрх товчийг дарна уу: ✅ Тийм, авсан эсвэл ❌ Аваагүй / Дараа`)
        return NextResponse.json({ ok: true })
      }

      case 'confirm': {
        // They sent text instead of pressing a button — remind
        await tgSend(chatId,
          `⬆️ Дээрх товчийг дарна уу: ✅ Тийм, илгээ эсвэл 🔄 Дахин оруулах`
        )
        return NextResponse.json({ ok: true })
      }

      default:
        break // transport_type step — they should press button, not type
    }
  }

  // ── Photo proof ─────────────────────────────────────────────────────────
  // Driver sends a photo → store as delivery confirmation.
  // If delivery is in picked_up / in_transit state, auto-mark as delivered.
  if (msg.photo && msg.photo.length > 0) {
    // Largest photo is the last element
    const fileId = msg.photo[msg.photo.length - 1].file_id as string

    // Find most recent active delivery for this driver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeDelivery } = await (supabase as any)
      .from('deliveries')
      .select('id, status, metadata, order_id, orders!inner(order_number, store_id)')
      .eq('driver_id', driver.id)
      .in('status', ['assigned', 'at_store', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeDelivery) {
      await tgSend(chatId,
        `📸 Зураг хүлээн авлаа, гэхдээ идэвхтэй хүргэлт олдсонгүй.\n` +
        `Хэрэв хүргэлт дууссан бол товч дарах эсвэл "Хүргэлээ" гэж бичнэ үү.`
      )
      return NextResponse.json({ ok: true })
    }

    const existingMeta = (activeDelivery.metadata ?? {}) as Record<string, unknown>
    const orderNum = activeDelivery.orders?.order_number ?? activeDelivery.id.slice(0, 8)
    const storeId = activeDelivery.orders?.store_id as string | undefined

    // Save proof photo + timestamp
    const updatedMeta = {
      ...existingMeta,
      proof_photo_file_id: fileId,
      proof_photo_at: new Date().toISOString(),
    }

    // Auto-complete delivery if it was in picked_up or in_transit
    const canComplete = ['picked_up', 'in_transit'].includes(activeDelivery.status)
    const newStatus = canComplete ? 'delivered' : activeDelivery.status

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('deliveries')
      .update({
        status: newStatus,
        metadata: updatedMeta,
        ...(canComplete ? { actual_delivery_time: new Date().toISOString() } : {}),
      })
      .eq('id', activeDelivery.id)

    // If we auto-completed the delivery, also update the order status
    if (canComplete) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', activeDelivery.order_id)
        .catch(() => {}) // non-blocking
    }

    // Write a dashboard notification so the store owner can see the photo
    if (storeId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: storeId,
        type: 'delivery_photo_proof',
        title: `📸 Хүргэлтийн зураг — ${orderNum}`,
        message: canComplete
          ? `Жолооч зураг илгээж хүргэлтийг баталгаажуулав. Захиалга #${orderNum}.`
          : `Жолооч хүргэлтийн зураг илгээв. Захиалга #${orderNum}.`,
        metadata: {
          delivery_id: activeDelivery.id,
          proof_photo_file_id: fileId,
          driver_name: (driver as { id: string; name?: string }).name,
        },
      }).catch(() => {}) // non-blocking — don't fail if notifications table schema differs
    }

    const confirmMsg = canComplete
      ? `✅ Зураг хүлээн авлаа. Захиалга <b>#${orderNum}</b> хүргэгдсэн гэж бүртгэгдлээ. Баярлалаа! 🙏`
      : `📸 Зураг хүлээн авлаа. Захиалга <b>#${orderNum}</b>-д хадгалагдлаа.`

    await tgSend(chatId, confirmMsg)
    return NextResponse.json({ ok: true })
  }

  // Run through the driver intent engine
  const result = await processDriverMessage(supabase, driver.id, text, chatId)

  // For unknown intents, let the message pass through to the dashboard
  // (store owner can reply manually from /dashboard/driver-chat)
  // No auto-reply needed for unknown — silence is fine.
  console.log(`[DriverBot] ${driver.name}: "${text}" → intent: ${result.intent}`)

  return NextResponse.json({ ok: true })
}
