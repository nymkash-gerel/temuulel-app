/**
 * Callback query (inline button) handler for the driver Telegram bot.
 * Handles all inline button taps from drivers.
 */

import {
  tgSend,
  tgAnswerCallback,
  tgRemoveButtons,
  tgEdit,
  enRouteKeyboard,
  delayKeyboard,
  issueKeyboard,
  orderAssignedKeyboard,
  intercityTransportKeyboard,
  intercityConfirmKeyboard,
  intercityPaymentKeyboard,
  intercityCustomerMessage,
  paymentKeyboard,
  paymentOptionsKeyboard,
  handoffReadyKeyboard,
  sendToDriver,
  DRIVER_PROACTIVE_MESSAGES,
  // Batch assignment flow keyboards
  batchReadyKeyboard,
  deliveryDenyKeyboard,
  denyReasonKeyboard,
  batchConfirmKeyboard,
  type IntercityWizard,
  type TgInlineKeyboard,
} from '@/lib/driver-telegram'
import { assignDriver, DEFAULT_DELIVERY_SETTINGS } from '@/lib/ai/delivery-assigner'
import { isQPayConfigured, createQPayInvoice } from '@/lib/qpay'
import type { TgCallbackQuery } from './driver-utils'
import { mergedDeliveryMeta, getStaffMemberChatIds, getDeliveryHeader } from './driver-utils'

/** Handle inline button taps from drivers */
export async function handleCallbackQuery(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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

  // Actions that trigger terminal state — remove buttons from the ORIGINAL delivery card
  const terminalActions = [
    'reject', 'reject_handoff',
    'arrived_at_store',
    'accept_handoff',
  ]
  if (messageId && terminalActions.includes(action)) {
    await tgRemoveButtons(chatId, messageId)
  }

  switch (action) {
    case 'arrived_at_store': {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'picked_up' }).eq('id', deliveryId)
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      await tgSend(chatId,
        `✅ <b>Авлаа гэж бүртгэгдлээ.</b>\n\nХаягруу явна уу. Хүргэсэн үедээ доорх товчийг дарна уу.`,
        { replyMarkup: enRouteKeyboard(deliveryId) }
      )
      break
    }

    case 'confirm_received': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: confirmedDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, metadata')
        .eq('id', deliveryId)
        .single()

      if (!confirmedDelivery) {
        await tgAnswerCallback(cb.id, '❌ Хүргэлт олдсонгүй')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'picked_up', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      await tgAnswerCallback(cb.id, '✅ Хүлээж авлаа!')

      if (messageId) {
        const updatedText =
          `✅ <b>ЗАХИАЛГА — #${confirmedDelivery.delivery_number}</b>\n\n` +
          `📍 Хаяг: ${confirmedDelivery.delivery_address || 'Тодорхойгүй'}\n` +
          `👤 Хүлээн авагч: ${confirmedDelivery.customer_name || '—'}\n` +
          `📞 Утас: ${confirmedDelivery.customer_phone || '—'}\n\n` +
          `✅ Хүлээж авлаа — Хаягруу явна уу!`
        await tgEdit(chatId, messageId, updatedText, { replyMarkup: enRouteKeyboard(deliveryId) })
      }
      break
    }

    case 'deny_delivery': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deniedDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, store_id, metadata')
        .eq('id', deliveryId)
        .single()

      if (!deniedDelivery) {
        await tgAnswerCallback(cb.id, '❌ Олдсонгүй')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'pending', driver_id: null, updated_at: new Date().toISOString() })
        .eq('id', deliveryId)

      await tgAnswerCallback(cb.id, 'Татгалзлаа')
      await tgSend(chatId, `↩️ <b>#${deniedDelivery.delivery_number}</b> — Татгалзлаа.\nДэлгүүрт мэдэгдлээ.`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: deniedDelivery.store_id,
        type: 'delivery_driver_denied',
        title: '❌ Жолооч татгалзлаа',
        body: `${driver.name} жолооч #${deniedDelivery.delivery_number} хүргэлтийг татгалзлаа.`,
        data: { delivery_id: deliveryId },
      }).then(null, () => {})

      if (messageId) {
        await tgRemoveButtons(chatId, messageId)
      }
      break
    }

    case 'delivered': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deliveryInfo } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_fee, delivery_number, delivery_address, customer_name, customer_phone')
        .eq('id', deliveryId)
        .single()

      if (!deliveryInfo) {
        await tgAnswerCallback(cb.id, '❌ Хүргэлт олдсонгүй')
        break
      }

      let totalAmount = 0
      const deliveryFee = deliveryInfo.delivery_fee || 0
      if (deliveryInfo.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orderData } = await (supabase as any)
          .from('orders')
          .select('total_amount')
          .eq('id', deliveryInfo.order_id)
          .single()
        totalAmount = orderData?.total_amount || 0
      }

      const grandTotal = totalAmount + deliveryFee
      const formattedOrder = totalAmount ? new Intl.NumberFormat('mn-MN').format(totalAmount) : '0'
      const formattedDelivery = deliveryFee ? new Intl.NumberFormat('mn-MN').format(deliveryFee) : '0'
      const formattedTotal = new Intl.NumberFormat('mn-MN').format(grandTotal)

      await tgAnswerCallback(cb.id, '💰 Төлбөрийн мэдээлэл')

      if (messageId) {
        await tgEdit(chatId, messageId,
          `💰 <b>Төлбөрийн мэдээлэл — #${deliveryInfo.delivery_number}</b>\n\n` +
          (deliveryInfo.delivery_address ? `📍 ${deliveryInfo.delivery_address}\n` : '') +
          (deliveryInfo.customer_name ? `👤 ${deliveryInfo.customer_name}` : '') +
          (deliveryInfo.customer_phone ? ` · <code>${deliveryInfo.customer_phone}</code>` : '') +
          `\n\nЗахиалгын дүн: ${formattedOrder}₮\n` +
          `Хүргэлтийн үнэ: ${formattedDelivery}₮\n` +
          `<b>Нийт: ${formattedTotal}₮</b>\n\n` +
          `Төлбөрийн байдлыг сонгоно уу:`,
          { replyMarkup: paymentOptionsKeyboard(deliveryId, grandTotal) }
        )
      }
      break
    }

    case 'payment_full': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fullPayDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_number, delivery_fee, delivery_address, customer_name, customer_phone, store_id')
        .eq('id', deliveryId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delivered', actual_delivery_time: new Date().toISOString() })
        .eq('id', deliveryId)

      let paidAmount = 0
      let orderTotal = 0
      if (fullPayDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orderData } = await (supabase as any)
          .from('orders')
          .select('total_amount')
          .eq('id', fullPayDelivery.order_id)
          .single()
        orderTotal = orderData?.total_amount || 0
        paidAmount = orderTotal + (fullPayDelivery.delivery_fee || 0)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({ payment_status: 'paid' })
          .eq('id', fullPayDelivery.order_id)
      }

      const fmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n)
      const deliveryFee = fullPayDelivery?.delivery_fee || 0
      await tgAnswerCallback(cb.id, '✅ Бүртгэгдлээ!')
      if (messageId) {
        const successText = fullPayDelivery
          ? `💰 <b>Төлбөрийн мэдээлэл — #${fullPayDelivery.delivery_number}</b>\n\n` +
            (fullPayDelivery.delivery_address ? `📍 ${fullPayDelivery.delivery_address}\n` : '') +
            (fullPayDelivery.customer_name ? `👤 ${fullPayDelivery.customer_name}` : '') +
            (fullPayDelivery.customer_phone ? ` · <code>${fullPayDelivery.customer_phone}</code>` : '') +
            `\n\nЗахиалгын дүн: ${fmt(orderTotal)}₮\n` +
            `Хүргэлтийн үнэ: ${fmt(deliveryFee)}₮\n` +
            `Нийт: ${fmt(paidAmount)}₮\n\n` +
            `✅ <b>Бүрэн төлбөр амжилттай бүртгэгдлээ. Баярлалаа, ${driver.name}!</b>`
          : `✅ <b>Бүрэн төлбөр амжилттай бүртгэгдлээ. Баярлалаа, ${driver.name}!</b>`
        await tgEdit(chatId, messageId, successText, { replyMarkup: { inline_keyboard: [] } })
      }

      if (fullPayDelivery?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: fullPayDelivery.store_id,
          type: 'delivery_completed',
          title: `✅ Хүргэлт амжилттай`,
          body: `#${fullPayDelivery.delivery_number} хүргэгдэж, ${fmt(paidAmount)}₮ авлаа.`,
          data: { delivery_id: deliveryId, amount: paidAmount },
        }).then(null, () => {})
      }
      break
    }

    case 'payment_custom': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .single()

      const existingMeta = (customDriver?.metadata ?? {}) as Record<string, unknown>
      const newMeta = {
        ...existingMeta,
        awaiting_custom_payment: { deliveryId, step: 'amount', messageId: messageId ?? null },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers')
        .update({ metadata: newMeta })
        .eq('telegram_chat_id', chatId)

      const custPayHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${custPayHeader}💸 <b>Хэдэн төгрөг авсан бэ?</b>\n\nТоо оруулна уу (жишээ: 25000)`,
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
      break
    }

    case 'payment_delayed': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: delayedPayDelivery } = await (supabase as any)
        .from('deliveries')
        .select('id, order_id, delivery_number, delivery_address, customer_name, customer_phone, delivery_fee, store_id')
        .eq('id', deliveryId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({
          status: 'delivered',
          actual_delivery_time: new Date().toISOString(),
          metadata: await mergedDeliveryMeta(supabase, deliveryId, { payment_followup: true }),
        })
        .eq('id', deliveryId)

      let delayedOrderTotal = 0
      let delayedOrderNumber = ''
      let delayedCustomerId = ''
      if (delayedPayDelivery?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: delayedOrderData } = await (supabase as any).from('orders').select('total_amount, order_number, customer_id').eq('id', delayedPayDelivery.order_id).single()
        delayedOrderTotal = delayedOrderData?.total_amount || 0
        delayedOrderNumber = delayedOrderData?.order_number || ''
        delayedCustomerId = delayedOrderData?.customer_id || ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders')
          .update({
            payment_status: 'pending',
            notes: 'Жолооч: хүргэгдсэн боловч төлбөр аваагүй',
          })
          .eq('id', delayedPayDelivery.order_id)
      }

      const delayedFmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n)
      const delayedFee = delayedPayDelivery?.delivery_fee || 0
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        const delayedText = delayedPayDelivery
          ? `💰 <b>Төлбөрийн мэдээлэл — #${delayedPayDelivery.delivery_number}</b>\n\n` +
            (delayedPayDelivery.delivery_address ? `📍 ${delayedPayDelivery.delivery_address}\n` : '') +
            (delayedPayDelivery.customer_name ? `👤 ${delayedPayDelivery.customer_name}` : '') +
            (delayedPayDelivery.customer_phone ? ` · <code>${delayedPayDelivery.customer_phone}</code>` : '') +
            `\n\nЗахиалгын дүн: ${delayedFmt(delayedOrderTotal)}₮\n` +
            `Хүргэлтийн үнэ: ${delayedFmt(delayedFee)}₮\n` +
            `Нийт: ${delayedFmt(delayedOrderTotal + delayedFee)}₮\n\n` +
            `🕐 <b>Хүргэгдсэн — төлбөр аваагүй.</b>\nДэлгүүрт мэдэгдлээ. Харилцагч руу төлбөрийн сануулга явууллаа.`
          : `🕐 <b>Хүргэгдсэн — төлбөр аваагүй.</b>\nДэлгүүрт мэдэгдлээ. Харилцагч руу төлбөрийн сануулга явууллаа.`
        await tgEdit(chatId, messageId, delayedText, { replyMarkup: { inline_keyboard: [] } })
      }

      if (delayedPayDelivery?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: delayedPayDelivery.store_id,
          type: 'payment_pending',
          title: `⚠️ Төлбөр аваагүй`,
          body: `#${delayedPayDelivery.delivery_number} хүргэгдсэн боловч төлбөр аваагүй — харилцагчтай холбогдоно уу.`,
          data: { delivery_id: deliveryId, payment_followup: true },
        }).then(null, () => {})
      }

      // Send first payment reminder to customer immediately
      if (delayedCustomerId && delayedPayDelivery?.store_id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: custConversation } = await (supabase as any)
            .from('conversations')
            .select('id')
            .eq('customer_id', delayedCustomerId)
            .eq('store_id', delayedPayDelivery.store_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (custConversation) {
            const totalWithFee = delayedOrderTotal + delayedFee
            const fmtTotal = delayedFmt(totalWithFee)

            let paymentLinkText = ''
            if (isQPayConfigured() && delayedPayDelivery.order_id && delayedOrderNumber) {
              try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com'
                const invoice = await createQPayInvoice({
                  orderNumber: delayedOrderNumber,
                  amount: totalWithFee,
                  description: `Захиалга #${delayedOrderNumber} — төлбөр`,
                  callbackUrl: `${baseUrl}/api/payments/callback?order_id=${delayedPayDelivery.order_id}`,
                })
                paymentLinkText = `\n\n🔗 Төлбөр хийх: ${invoice.qPay_shortUrl}`

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from('orders')
                  .update({
                    notes: JSON.stringify({
                      qpay_invoice_id: invoice.invoice_id,
                      qpay_short_url: invoice.qPay_shortUrl,
                    }),
                  })
                  .eq('id', delayedPayDelivery.order_id)
              } catch (qpayErr) {
                console.error('[DriverBot] QPay invoice for payment reminder failed:', qpayErr)
              }
            }

            const reminderMsg =
              `💳 Сайн байна уу! Таны #${delayedOrderNumber || delayedPayDelivery.delivery_number} захиалга хүргэгдсэн боловч төлбөр хүлээгдэж байна.\n\n` +
              `Төлөх дүн: ${fmtTotal}₮\n` +
              `Төлбөрөө хийнэ үү. Асуудал байвал бидэнтэй холбогдоорой.` +
              paymentLinkText

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('messages').insert({
              conversation_id: custConversation.id,
              content: reminderMsg,
              is_from_customer: false,
              is_ai_response: true,
              metadata: { type: 'payment_reminder', reminder_count: 1, delivery_id: deliveryId },
            })
          }
        } catch (custMsgErr) {
          console.error('[DriverBot] Payment reminder to customer failed:', custMsgErr)
        }
      }
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
      if (messageId) {
        await tgEdit(chatId, messageId,
          `✅ <b>Төлбөр авсан гэж бүртгэгдлээ.</b>\n\nБаярлалаа, ${driver.name}!`,
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
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
      if (messageId) {
        const phone = pendingDelivery?.customer_phone
        await tgEdit(chatId, messageId,
          `⏳ <b>Дараа төлнө гэж бүртгэгдлээ.</b>\n\nДэлгүүрт мэдэгдлээ.` +
          (phone ? `\n📞 Харилцагч: <code>${phone}</code>` : ''),
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
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
      const unreachableHeader = await getDeliveryHeader(supabase, deliveryId)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: delData } = await (supabase as any)
        .from('deliveries')
        .select('order_id, store_id, delivery_number, metadata')
        .eq('id', deliveryId)
        .single()

      const unreachableCount = ((delData?.metadata as Record<string, unknown>)?.unreachable_count as number || 0) + 1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({
        status: 'delayed',
        notes: 'Харилцагч утас авсангүй',
        metadata: { ...(delData?.metadata || {}), unreachable_count: unreachableCount },
      }).eq('id', deliveryId)

      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${unreachableHeader}📵 <b>Утас авсангүй — бүртгэгдлээ.</b>\n\n5 минут хүлээнэ. Хариу ирэхгүй бол дараагийн руу явна.\n\nБусад хүргэлтийг үргэлжлүүлнэ үү:`,
          { replyMarkup: enRouteKeyboard(deliveryId) }
        )
      }

      if (delData?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: orderRow } = await (supabase as any)
          .from('orders')
          .select('conversation_id')
          .eq('id', delData.order_id)
          .single()

        const convId = (orderRow as { conversation_id?: string } | null)?.conversation_id
        if (convId) {
          await supabase.from('messages').insert({
            conversation_id: convId,
            role: 'assistant',
            content: `📞 Жолооч тан руу залгасан боловч холбогдож чадсангүй.\n\n5 минутын дотор хариу өгнө үү! Хариу ирэхгүй бол барааг дэлгүүр рүү буцаана.`,
          })
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', convId)
        }
      }

      try {
        const { Client: QStashClient } = await import('@upstash/qstash')
        const qstashToken = process.env.QSTASH_TOKEN
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        if (qstashToken && appUrl) {
          const qstash = new QStashClient({ token: qstashToken })
          await qstash.publishJSON({
            url: `${appUrl.startsWith('http') ? appUrl : `https://${appUrl}`}/api/deliveries/unreachable-timeout`,
            body: { delivery_id: deliveryId, store_id: delData?.store_id },
            delay: 300,
            retries: 1,
          })
        }
      } catch (err) {
        console.error('[QStash] Failed to schedule unreachable timeout:', err)
      }

      break
    }

    case 'delay': {
      const delayHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${delayHeader}⏰ <b>Хэзээ хүргэх боломжтой вэ?</b>\nДоорхоос сонгоно уу:`,
          { replyMarkup: delayKeyboard(deliveryId) }
        )
      }
      break
    }

    case 'delay_time': {
      const dtParts = data.split(':')
      const delayChoice = dtParts[1]
      const dtDeliveryId = dtParts[2]

      if (delayChoice === 'custom') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: drvMeta } = await (supabase as any).from('delivery_drivers').select('metadata').eq('telegram_chat_id', chatId).single()
        const newMeta = { ...(drvMeta?.metadata ?? {}), awaiting_delay_time: dtDeliveryId, awaiting_delay_message_id: messageId ?? null }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers').update({ metadata: newMeta }).eq('telegram_chat_id', chatId)
        await tgAnswerCallback(cb.id)
        const dtCustomHeader = await getDeliveryHeader(supabase, dtDeliveryId)
        if (messageId) {
          await tgEdit(chatId, messageId,
            `${dtCustomHeader}✏️ <b>Хүргэх цагийг бичнэ үү.</b>\n\nЖишээ нь:\n• "Өнөөдөр 18:00"\n• "Маргааш 10-11 цаг"\n• "Гаригт 14:00"`,
            { replyMarkup: { inline_keyboard: [] } }
          )
        }
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
        etaLabel = 'Энэ амралтын өдрүүдэд'
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delayed', estimated_delivery_time: etaIso || null, notes: `Хоцрох: ${etaLabel}` })
        .eq('id', dtDeliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: delayedDel } = await (supabase as any)
        .from('deliveries')
        .select('delivery_number, store_id, order_id')
        .eq('id', dtDeliveryId)
        .single()

      const dtHeader = await getDeliveryHeader(supabase, dtDeliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${dtHeader}⏰ <b>ХОЙШЛУУЛСАН</b>\n📅 Шинэ хугацаа: ${etaLabel}`,
          { replyMarkup: enRouteKeyboard(dtDeliveryId) }
        )
      }
      if (delayedDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: delayedDel.store_id, type: 'delivery_delayed',
          title: '⏰ Хүргэлт хоцорлоо',
          body: `${driver.name} — #${delayedDel.delivery_number}: ${etaLabel} хүргэнэ.`,
          data: { delivery_id: dtDeliveryId, eta: etaIso },
        }).then(null, () => {})

        if (delayedDel.order_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: dtOrd } = await (supabase as any).from('orders').select('notes').eq('id', delayedDel.order_id).single()
          const dtExisting = (dtOrd?.notes as string) || ''
          const dtNote = `⏰ Хойшлуулсан: ${etaLabel}`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('orders')
            .update({ notes: dtExisting ? `${dtExisting}\n${dtNote}` : dtNote })
            .eq('id', delayedDel.order_id)
        }

        const dtBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (dtBotToken) {
          const dtTgMsg =
            `⏰ <b>ХҮРГЭЛТ ХОЙШЛУУЛСАН</b>\n\n` +
            `🆔 #${delayedDel.delivery_number}\n` +
            `🚚 Жолооч: ${driver.name}\n` +
            `📅 Шинэ хугацаа: ${etaLabel}\n`
          const dtChatIds = await getStaffMemberChatIds(supabase, delayedDel.store_id)
          for (const cid of dtChatIds) {
            await fetch(`https://api.telegram.org/bot${dtBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cid, text: dtTgMsg, parse_mode: 'HTML' }),
            }).catch(() => {})
          }
        }
      }
      break
    }

    case 'issue': {
      const issueHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId, `${issueHeader}⚠️ <b>Ямар асуудал гарсан бэ?</b>`, { replyMarkup: issueKeyboard(deliveryId) })
      }
      break
    }

    case 'wrong_product': {
      const wpHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({
          status: 'failed',
          notes: 'Буруу бараа — зураг хүлээж байна',
          metadata: await mergedDeliveryMeta(supabase, deliveryId, { awaiting_wrong_photo: true }),
        })
        .eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('delivery_drivers')
        .update({ metadata: { ...((driver as Record<string, unknown>).metadata as Record<string, unknown> ?? {}), awaiting_wrong_photo: deliveryId } })
        .eq('id', driver.id)
      if (messageId) await tgEdit(chatId, messageId, `${wpHeader}📦 <b>БУРУУ БАРАА</b>\n📸 Буруу барааны зургийг илгээнэ үү.`, { replyMarkup: { inline_keyboard: [] } })
      break
    }

    case 'wrong_returned': {
      const wrHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: wrDel } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, store_id, metadata')
        .eq('id', deliveryId)
        .single()

      if (wrDel) {
        const existingMeta = (wrDel.metadata ?? {}) as Record<string, unknown>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('deliveries')
          .update({
            notes: 'Буруу бараа — агуулахад буцааж өгсөн',
            metadata: { ...existingMeta, wrong_item_returned: true, wrong_item_returned_at: new Date().toISOString() },
          })
          .eq('id', deliveryId)

        await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
        if (messageId) await tgEdit(chatId, messageId, `${wrHeader}📦 <b>БУЦААЖ ӨГСӨН</b>\nБаярлалаа! Дэлгүүрт мэдэгдлээ.`, { replyMarkup: { inline_keyboard: [] } })

        const storeBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (storeBotToken) {
          const allChatIds: string[] = []

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: storeStaff } = await (supabase as any)
            .from('staff')
            .select('telegram_chat_id')
            .eq('store_id', wrDel.store_id)
            .not('telegram_chat_id', 'is', null)
          for (const s of (storeStaff || []) as Array<{ telegram_chat_id: string }>) {
            if (s.telegram_chat_id && !allChatIds.includes(s.telegram_chat_id)) allChatIds.push(s.telegram_chat_id)
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: storeMembers } = await (supabase as any)
            .from('store_members')
            .select('telegram_chat_id, notification_preferences')
            .eq('store_id', wrDel.store_id)
            .not('telegram_chat_id', 'is', null)
          for (const m of (storeMembers || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
            const prefs = m.notification_preferences || {}
            if (m.telegram_chat_id && prefs.delivery !== false && !allChatIds.includes(m.telegram_chat_id)) {
              allChatIds.push(m.telegram_chat_id)
            }
          }

          const returnMsg =
            `📦 <b>БУРУУ БАРАА БУЦААГДЛАА</b>\n\n` +
            `🆔 Хүргэлт: #${wrDel.delivery_number}\n` +
            `👤 Жолооч: ${(driver as Record<string, unknown>).name}\n\n` +
            `Жолооч буруу барааг агуулахад буцааж өгсөн.\n` +
            `⚠️ <b>Хүлээн авч, ямар бараа буруу илгээсэнийг тэмдэглэнэ үү.</b>\n\n` +
            `Dashboard → Захиалга → Хүргэлт #${wrDel.delivery_number}`

          for (const sChatId of allChatIds) {
            try {
              await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: sChatId, text: returnMsg, parse_mode: 'HTML' }),
              })
            } catch (tgErr) {
              console.error(`[DriverBot] Wrong return notify failed for ${sChatId}:`, tgErr)
            }
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: wrDel.store_id, type: 'delivery_failed',
          title: '📦 Буруу бараа буцаагдлаа',
          body: `${(driver as Record<string, unknown>).name} — #${wrDel.delivery_number}: буруу барааг агуулахад буцааж өгсөн. Хүлээн авч тэмдэглэнэ үү.`,
          data: { delivery_id: deliveryId, reason: 'wrong_product_returned' },
        }).then(null, () => {})
      } else {
        await tgAnswerCallback(cb.id, 'Хүргэлт олдсонгүй')
      }
      break
    }

    case 'damaged': {
      const dmHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Гэмтсэн бараа' }).eq('id', deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: dmDel } = await (supabase as any).from('deliveries').select('delivery_number, store_id, order_id, customer_name, customer_phone, delivery_address').eq('id', deliveryId).single()
      if (dmDel?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders').update({ payment_status: 'failed' }).eq('id', dmDel.order_id)
      }
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) await tgEdit(chatId, messageId, `${dmHeader}💔 <b>ГЭМТСЭН БАРАА</b>\nЗураг авч, агуулахад буцааж өгнө үү.`, { replyMarkup: { inline_keyboard: [] } })
      if (dmDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: dmDel.store_id, type: 'delivery_failed', title: '💔 Гэмтсэн бараа', body: `${driver.name} — #${dmDel.delivery_number}: гэмтсэн бараа.`, data: { delivery_id: deliveryId, reason: "damaged" } }).then(null, () => {})

        console.log('[DriverBot] Damaged item — notifying staff for store:', dmDel.store_id)
        const dmBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (dmBotToken) {
          const dmMsg =
            `💔 <b>ГЭМТСЭН БАРАА</b>\n\n` +
            `🆔 Хүргэлт: #${dmDel.delivery_number}\n` +
            `👤 ${dmDel.customer_name || '—'}` + (dmDel.customer_phone ? ` · <code>${dmDel.customer_phone}</code>` : '') + `\n` +
            `📍 ${dmDel.delivery_address || '—'}\n\n` +
            `🚚 Жолооч: ${(driver as Record<string, unknown>).name}\n` +
            `⚠️ Зураг авч, агуулахад буцааж өгнө.`
          const dmChatIds = await getStaffMemberChatIds(supabase, dmDel.store_id)
          for (const cid of dmChatIds) {
            await fetch(`https://api.telegram.org/bot${dmBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cid, text: dmMsg, parse_mode: 'HTML' }),
            }).catch(() => {})
          }
        }
      }
      break
    }

    case 'no_payment': {
      const npHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('deliveries').update({ status: 'failed', notes: 'Харилцагч мөнгө өгсөнгүй' }).eq('id', deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: npDel } = await (supabase as any).from('deliveries').select('delivery_number, store_id, order_id, customer_name, customer_phone, delivery_address').eq('id', deliveryId).single()
      if (npDel?.order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('orders').update({ payment_status: 'failed' }).eq('id', npDel.order_id)
      }
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) await tgEdit(chatId, messageId, `${npHeader}💰 <b>МӨНГӨ ӨГСӨНГҮЙ</b>\nДэлгүүрт мэдэгдлээ.`, { replyMarkup: { inline_keyboard: [] } })
      if (npDel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({ store_id: npDel.store_id, type: 'delivery_failed', title: '💰 Мөнгө өгсөнгүй', body: `${driver.name} — #${npDel.delivery_number}: харилцагч мөнгө өгсөнгүй.`, data: { delivery_id: deliveryId, reason: "no_payment" } }).then(null, () => {})

        console.log('[DriverBot] No payment — notifying staff for store:', npDel.store_id)
        const npBotToken = process.env.TELEGRAM_BOT_TOKEN
        if (npBotToken) {
          const npMsg =
            `💰 <b>МӨНГӨ ӨГСӨНГҮЙ</b>\n\n` +
            `🆔 Хүргэлт: #${npDel.delivery_number}\n` +
            `👤 ${npDel.customer_name || '—'}` + (npDel.customer_phone ? ` · <code>${npDel.customer_phone}</code>` : '') + `\n` +
            `📍 ${npDel.delivery_address || '—'}\n\n` +
            `🚚 Жолооч: ${(driver as Record<string, unknown>).name}\n` +
            `⚠️ Харилцагч төлбөр төлөөгүй.`
          const npChatIds = await getStaffMemberChatIds(supabase, npDel.store_id)
          for (const cid of npChatIds) {
            await fetch(`https://api.telegram.org/bot${npBotToken}/sendMessage`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: cid, text: npMsg, parse_mode: 'HTML' }),
            }).catch(() => {})
          }
        }
      }
      break
    }

    case 'confirm_cod': {
      const codHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${codHeader}💳 <b>Төлбөрийн байдал?</b>\n\nХарилцагч мөнгийг өгсөн эсэхийг сонгоно уу.`,
          { replyMarkup: paymentKeyboard(deliveryId) }
        )
      }
      break
    }

    case 'customer_info': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: infoDelivery } = await (supabase as any)
        .from('deliveries')
        .select('customer_name, customer_phone, delivery_address, delivery_number')
        .eq('id', deliveryId)
        .single()
      if (!infoDelivery) {
        await tgAnswerCallback(cb.id, '❓ Мэдээлэл олдсонгүй', true)
        break
      }
      const infoText = `#${infoDelivery.delivery_number}\n` +
        `👤 ${infoDelivery.customer_name || '—'}\n` +
        `📞 ${infoDelivery.customer_phone || '—'}\n` +
        `📍 ${infoDelivery.delivery_address || '—'}`
      await tgAnswerCallback(cb.id, infoText, true)
      break
    }

    case 'receiver_complaint': {
      const complaintHeader = await getDeliveryHeader(supabase, deliveryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deliveries')
        .update({ status: 'delayed', notes: 'Хүлээн авагч гомдол мэдэгдлээ' })
        .eq('id', deliveryId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${complaintHeader}💬 <b>Гомдол бүртгэгдлээ.</b>\n\n` +
          `Дэлгүүрийн менежерт мэдэгдлээ. Удахгүй холбогдох болно.\n` +
          `Барааг хэвийнээр хүргэх эсэхийг хүлээгээрэй.`,
          { replyMarkup: enRouteKeyboard(deliveryId) }
        )
      }
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
          data: { delivery_id: deliveryId, reason: 'receiver_complaint' },
        }).then(null, () => {})
      }
      break
    }

    case 'reject': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rejectedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'pending', driver_id: null })
        .eq('id', deliveryId)
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, store_id, order_id')
        .single()

      await tgAnswerCallback(cb.id, 'Татгалзлаа')
      await tgSend(chatId, `↩️ Татгалзлаа. Баярлалаа — дэлгүүр өөр жолооч томилно.`)

      if (rejectedDelivery) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: otherDrivers } = await (supabase as any)
            .from('delivery_drivers')
            .select('id, name, vehicle_type, current_location, delivery_zones')
            .eq('store_id', rejectedDelivery.store_id)
            .neq('id', driver.id)
            .in('status', ['active', 'on_delivery'])

          if (otherDrivers && otherDrivers.length > 0) {
            const candidates = await Promise.all(otherDrivers.map(async (d: Record<string, unknown>) => {
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from('deliveries')
                .update({ status: 'assigned', driver_id: result.recommended_driver_id })
                .eq('id', deliveryId)

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any).from('notifications').insert({
                store_id: rejectedDelivery.store_id,
                type: 'delivery_unassigned',
                title: `Хүргэлт томилогдоогүй — #${rejectedDelivery.delivery_number}`,
                message: `${driver.name} татгалзсан. Боломжтой жолооч байхгүй байна.`,
                data: { delivery_id: deliveryId },
              }).then(null, () => {})
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
      await tgAnswerCallback(cb.id, '📋 Мэдээлэл оруулна уу')
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({
          status: 'in_transit',
          estimated_delivery_time: wiz3.eta,
          metadata: await mergedDeliveryMeta(supabase, deliveryId, { intercity_handoff: handoff }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', wiz3.delivery_id)
        .select('id, order_id, delivery_number, store_id')
        .single()

      const clearedMeta = { ...(driverRow3.metadata as object || {}) }
      delete (clearedMeta as Record<string, unknown>).intercity_wizard
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('id', driverRow3.id)

      if (updatedDelivery?.order_id) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: order } = await (supabase as any)
            .from('orders')
            .select('order_number, customer_id')
            .eq('id', updatedDelivery.order_id)
            .single()

          if (order?.customer_id) {
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

    // ── Handoff accept/reject ────────────────────────────────────────────────

    case 'accept_handoff': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: acceptedDelivery } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'picked_up', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .select('id, delivery_number, delivery_address, customer_name, customer_phone, store_id')
        .single()

      await tgAnswerCallback(cb.id, '✅ Хүлээж авлаа!')

      await tgSend(chatId,
        `🚚 <b>Амжилт хүргэе!</b>\n\n` +
        `📦 Захиалга: #${acceptedDelivery?.delivery_number || ''}\n` +
        (acceptedDelivery?.customer_name ? `👤 ${acceptedDelivery.customer_name}\n` : '') +
        `📍 Хаяг: ${acceptedDelivery?.delivery_address || 'Тодорхойгүй'}\n` +
        (acceptedDelivery?.customer_phone ? `📞 <code>${acceptedDelivery.customer_phone}</code>\n` : ''),
        { replyMarkup: enRouteKeyboard(deliveryId) }
      )
      break
    }

    case 'reject_handoff': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rejectedHandoff } = await (supabase as any)
        .from('deliveries')
        .update({ status: 'assigned', updated_at: new Date().toISOString() })
        .eq('id', deliveryId)
        .select('id, delivery_number, store_id, driver_id')
        .single()

      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `❌ <b>Бүртгэгдлээ.</b>\n\nМенежертэй холбогдоно уу.`)

      if (rejectedHandoff?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: rejectedHandoff.store_id,
          type: 'handoff_rejected',
          title: `❌ Жолооч татгалзлаа`,
          body: `${driver.name} #${rejectedHandoff.delivery_number} барааг хүлээж авахаас татгалзлаа.`,
          data: { delivery_id: deliveryId, driver_id: rejectedHandoff.driver_id },
        }).then(null, () => {})
      }
      break
    }

    // ── Batch assignment flow ────────────────────────────────────────────

    case 'batch_ready': {
      const batchKey = deliveryId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, name, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

      if (!batchDriver) {
        await tgAnswerCallback(cb.id, '❌ Жолооч олдсонгүй')
        break
      }

      const bMeta = batchDriver.metadata as Record<string, unknown> | null
      const pendingBatch = bMeta?.pending_batch as { batchKey: string; deliveryIds: string[]; storeId?: string } | undefined
      if (!pendingBatch || pendingBatch.batchKey !== batchKey) {
        await tgAnswerCallback(cb.id, '❌ Хуучин мэдэгдэл')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchDeliveries } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number, delivery_address, customer_name, customer_phone')
        .in('id', pendingBatch.deliveryIds)
        .eq('driver_id', batchDriver.id)
        .eq('status', 'assigned')

      if (!batchDeliveries || batchDeliveries.length === 0) {
        await tgAnswerCallback(cb.id, 'Захиалга байхгүй')
        await tgSend(chatId, '📭 Хуваарилагдсан захиалга байхгүй байна.')
        break
      }

      if (messageId) await tgRemoveButtons(chatId, messageId)
      await tgAnswerCallback(cb.id, `${batchDeliveries.length} хүргэлт`)

      for (const d of batchDeliveries as { id: string; delivery_number: string; delivery_address: string; customer_name: string | null; customer_phone: string | null }[]) {
        await tgSend(chatId,
          `📋 <b>#${d.delivery_number}</b>\n📍 ${d.delivery_address}\n👤 ${d.customer_name || '—'}${d.customer_phone ? ` · <code>${d.customer_phone}</code>` : ''}`,
          { replyMarkup: deliveryDenyKeyboard(d.id) }
        )
      }

      await tgSend(chatId,
        `✅ Татгалзах гэснийг дарна уу. Үлдсэнийг автоматаар зөвшөөрнө.`,
        { replyMarkup: batchConfirmKeyboard(batchKey) }
      )
      break
    }

    case 'deny': {
      await tgAnswerCallback(cb.id)
      await tgSend(chatId, '❌ Татгалзах шалтгааныг сонгоно уу:', { replyMarkup: denyReasonKeyboard(deliveryId) })
      break
    }

    case 'deny_reason': {
      const drParts = data.split(':')
      const drReason = drParts[1]
      const drDeliveryId = drParts[2]
      if (!drReason || !drDeliveryId) {
        await tgAnswerCallback(cb.id, '❌ Алдаа')
        break
      }

      const DENY_LABELS: Record<string, string> = {
        area: 'Бүсэд биш',
        far: 'Хэт алс',
        heavy: 'Хэт их ачаа',
        busy: 'Цаг гаргахгүй',
        other: 'Бусад',
      }
      const reasonLabel = DENY_LABELS[drReason] ?? drReason

      if (drReason === 'other') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: otherDriver } = await (supabase as any)
          .from('delivery_drivers')
          .select('id, metadata')
          .eq('telegram_chat_id', chatId)
          .single()

        if (otherDriver) {
          const nm = { ...(otherDriver.metadata ?? {}), awaiting_deny_reason: { deliveryId: drDeliveryId } }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('delivery_drivers').update({ metadata: nm }).eq('id', otherDriver.id)
        }

        if (messageId) await tgRemoveButtons(chatId, messageId)
        await tgAnswerCallback(cb.id)
        await tgSend(chatId, '✏️ <b>Татгалзах шалтгааныг бичнэ үү:</b>')
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: deniedDel } = await (supabase as any)
        .from('deliveries')
        .update({
          status: 'pending',
          driver_id: null,
          denial_info: {
            driver_id: driver.id,
            driver_name: driver.name,
            reason: drReason,
            reason_label: reasonLabel,
            denied_at: new Date().toISOString(),
          },
        })
        .eq('id', drDeliveryId)
        .select('delivery_number, store_id')
        .single()

      if (messageId) await tgRemoveButtons(chatId, messageId)
      await tgAnswerCallback(cb.id, 'Бүртгэгдлээ')
      await tgSend(chatId, `↩️ <b>#${deniedDel?.delivery_number}</b> — татгалзлаа (${reasonLabel}). Менежерт мэдэгдлээ.`)

      if (deniedDel?.store_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notifications').insert({
          store_id: deniedDel.store_id,
          type: 'delivery_denied',
          title: '❌ Жолооч татгалзлаа',
          body: `${driver.name} #${deniedDel.delivery_number} татгалзлаа: ${reasonLabel}`,
          data: { delivery_id: drDeliveryId, reason: drReason },
        }).then(null, () => {})
      }
      break
    }

    case 'batch_confirm': {
      const confirmBatchKey = deliveryId
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cbDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, name, metadata')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

      if (!cbDriver) {
        await tgAnswerCallback(cb.id, '❌ Алдаа')
        break
      }

      const cbMeta = cbDriver.metadata as Record<string, unknown> | null
      const cbBatch = cbMeta?.pending_batch as { batchKey: string; deliveryIds: string[] } | undefined

      const deliveryIds = cbBatch?.deliveryIds ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: remaining } = await (supabase as any)
        .from('deliveries')
        .select('id, delivery_number')
        .in('id', deliveryIds)
        .eq('driver_id', cbDriver.id)
        .eq('status', 'assigned')

      if (messageId) await tgRemoveButtons(chatId, messageId)

      const clearedMeta = { ...cbMeta }
      delete clearedMeta.pending_batch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('id', cbDriver.id)

      if (!remaining || remaining.length === 0) {
        await tgAnswerCallback(cb.id, 'Бүгдийг татгалзлаа')
        await tgSend(chatId, '📭 Бүх хүргэлтийг татгалзлаа. Менежерт мэдэгдлээ.')
      } else {
        await tgAnswerCallback(cb.id, `✅ ${remaining.length} баталлаа!`)
        await tgSend(chatId,
          `✅ <b>${remaining.length} хүргэлт баталлаа!</b>\n\n` +
          `Дэлгүүр рүү очиж барааг хүлээж аваарай.\n` +
          `Мэдэгдэл ирнэ.`
        )
      }
      break
    }

    // ── Customer Refusal ─────────────────────────────────────────────────

    case 'customer_refused': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: refusalDriver } = await (supabase as any)
        .from('delivery_drivers')
        .select('id, metadata')
        .eq('telegram_chat_id', chatId)
        .single()

      if (refusalDriver) {
        const existingMeta = (refusalDriver.metadata ?? {}) as Record<string, unknown>
        const newMeta = {
          ...existingMeta,
          awaiting_refusal_reason: { deliveryId, messageId: messageId ?? null },
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('delivery_drivers')
          .update({ metadata: newMeta })
          .eq('telegram_chat_id', chatId)
      }

      const refusalHeader = await getDeliveryHeader(supabase, deliveryId)
      await tgAnswerCallback(cb.id)
      if (messageId) {
        await tgEdit(chatId, messageId,
          `${refusalHeader}🚫 <b>Татгалзсан шалтгааныг бичнэ үү:</b>`,
          { replyMarkup: { inline_keyboard: [] } }
        )
      }
      break
    }

    default:
      await tgAnswerCallback(cb.id, '❓ Тодорхойгүй үйлдэл')
  }
}
