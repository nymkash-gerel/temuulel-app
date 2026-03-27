/**
 * Message handlers for the driver Telegram bot.
 * Handles commands, text input (wizard flows, custom payment, etc.), and photo messages.
 */

import {
  tgSend,
  tgEdit,
  enRouteKeyboard,
  orderAssignedKeyboard,
  intercityPaymentKeyboard,
  DRIVER_BOT_WELCOME,
  DRIVER_BOT_LINKED,
  DRIVER_BOT_NOT_FOUND,
  type IntercityWizard,
  type TgInlineKeyboard,
} from '@/lib/driver-telegram'
import { processDriverMessage } from '@/lib/driver-chat-engine'
import { initiatePartialPaymentResolution } from '@/lib/partial-payment-agent'
import type { TgMessage } from './driver-utils'
import {
  mergedDeliveryMeta,
  getStaffMemberChatIds,
  getDeliveryHeader,
  normalizePhone,
  looksLikePhone,
  recordTgHistory,
} from './driver-utils'

/**
 * Handle all non-callback message types from the driver bot.
 * Returns true if the message was handled, false otherwise.
 */
export async function handleMessage(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  msg: TgMessage,
): Promise<void> {
  const chatId = msg.chat.id
  const text = msg.text?.trim() ?? ''

  // ── /start command ───────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    await handleStartCommand(supabase, msg, chatId, text)
    return
  }

  // ── /help command ───────────────────────────────────────────────────────
  if (text === '/help') {
    await handleHelpCommand(chatId)
    return
  }

  // ── /unlink command ──────────────────────────────────────────────────────
  if (text === '/unlink') {
    await handleUnlinkCommand(supabase, chatId)
    return
  }

  // ── /orders command ──────────────────────────────────────────────────────
  if (text === '/orders') {
    await handleOrdersCommand(supabase, chatId)
    return
  }

  // ── /find command ────────────────────────────────────────────────────────
  if (text.startsWith('/find')) {
    await handleFindCommand(supabase, chatId, text)
    return
  }

  // ── Early driver lookup — needed for wizard and other state checks ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: earlyDriver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name, metadata')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  const earlyMeta = earlyDriver?.metadata as Record<string, unknown> | null
  const earlyWizard = earlyMeta?.intercity_wizard as IntercityWizard | undefined
  const hasActiveWizard = !!earlyWizard

  // ── Custom delay time input ───────────────────────────────────────────────
  const awaitingDelayDeliveryId = earlyMeta?.awaiting_delay_time as string | undefined
  const awaitingDelayMsgId = earlyMeta?.awaiting_delay_message_id as number | null | undefined
  if (awaitingDelayDeliveryId && text && !text.startsWith('/')) {
    await handleCustomDelayTime(supabase, chatId, text, earlyDriver, earlyMeta, awaitingDelayDeliveryId, awaitingDelayMsgId)
    return
  }

  // ── Custom deny reason input (batch flow) ────────────────────────────────────
  const awaitingDenyReason = earlyMeta?.awaiting_deny_reason as { deliveryId: string } | undefined
  if (awaitingDenyReason && text && !text.startsWith('/')) {
    await handleCustomDenyReason(supabase, chatId, text, earlyDriver, earlyMeta, awaitingDenyReason)
    return
  }

  // ── Custom payment amount input ─────────────────────────────────────────────
  const awaitingCustomPayment = earlyMeta?.awaiting_custom_payment as { deliveryId: string; step: 'amount' | 'reason'; amount?: number; messageId?: number | null } | undefined
  if (awaitingCustomPayment && text && !text.startsWith('/')) {
    await handleCustomPayment(supabase, chatId, text, earlyDriver, earlyMeta, awaitingCustomPayment)
    return
  }

  // ── Customer refusal reason input ───────────────────────────────────────────
  const awaitingRefusalReason = earlyMeta?.awaiting_refusal_reason as { deliveryId: string; messageId?: number | null } | undefined
  if (awaitingRefusalReason && text && !text.startsWith('/')) {
    await handleRefusalReason(supabase, chatId, text, earlyMeta, awaitingRefusalReason)
    return
  }

  // ── Phone number (onboarding) ────────────────────────────────────────────
  if (!hasActiveWizard && (looksLikePhone(text) || msg.contact)) {
    await handlePhoneLink(supabase, msg, chatId, text)
    return
  }

  // ── Natural language from authenticated driver ───────────────────────────
  const driver = earlyDriver as { id: string; name?: string; metadata?: unknown } | null

  if (!driver) {
    await tgSend(
      chatId,
      `❓ Таны акаунт холбогдоогүй байна.\n\nУтасны дугаараа илгээнэ үү (жишээ: 99112233).`
    )
    return
  }

  // ── Intercity wizard text-input handler ─────────────────────────────────
  const driverMetadata = earlyMeta
  const activeWizard = earlyWizard

  if (activeWizard) {
    const handled = await handleWizardInput(supabase, chatId, text, driver, driverMetadata, activeWizard)
    if (handled) return
  }

  // ── Wrong item photo ────────────────────────────────────────────────────
  const driverMeta = ((driver as Record<string, unknown>).metadata ?? {}) as Record<string, unknown>
  if (msg.photo && msg.photo.length > 0 && driverMeta.awaiting_wrong_photo) {
    await handleWrongItemPhoto(supabase, msg, chatId, driver, driverMeta)
    return
  }

  // ── Photo proof ─────────────────────────────────────────────────────────
  if (msg.photo && msg.photo.length > 0) {
    await handlePhotoProof(supabase, msg, chatId, driver)
    return
  }

  // Run through the driver intent engine
  const result = await processDriverMessage(supabase, driver.id, text, chatId)
  console.log(`[DriverBot] ${driver.name}: "${text}" → intent: ${result.intent}`)
}

// ─── Individual command/flow handlers ─────────────────────────────────────────

async function handleStartCommand(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  msg: TgMessage,
  chatId: number,
  text: string,
): Promise<void> {
  const param = text.split(' ')[1]?.trim()
  if (param && param.length > 10) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: driver } = await (supabase as any)
      .from('delivery_drivers')
      .select('id, name, telegram_chat_id')
      .eq('id', param)
      .maybeSingle()

    if (!driver) {
      await tgSend(chatId, `❌ Холбоос хүчингүй байна.\n\nДэлгүүрийн менежерээсээ шинэ холбоос авна уу.`)
      return
    }

    const linked = await recordTgHistory(supabase, driver.id, chatId, msg.from ?? { id: chatId })
    if (!linked) {
      await tgSend(chatId, '❌ Холбоход алдаа гарлаа. Дахин оролдоно уу.')
      return
    }

    await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
    return
  }

  await tgSend(chatId, DRIVER_BOT_WELCOME)
}

async function handleHelpCommand(chatId: number): Promise<void> {
  await tgSend(chatId,
    `🚚 <b>Жолоочийн бот — тушаалууд</b>\n\n` +
    `/orders — Миний идэвхтэй захиалгууд\n` +
    `/unlink — Энэ аккаунтаас салгах\n` +
    `/help — Тушаалын жагсаалт\n\n` +
    `<b>Статус шинэчлэх:</b>\n` +
    `Товч дарах замаар шинэчилнэ үү (товч тогтоогүй бол доорхийг бичнэ үү):\n` +
    `• "Авлаа" — бараа авсан\n` +
    `• "Хүргэлээ" — хүргэлт дууссан\n` +
    `• "Дэлгүүрт ирлээ" — дэлгүүрт очсон\n` +
    `• "Холбогдохгүй байна" — хэрэглэгч утас аваагүй\n\n` +
    `📸 <b>Хүргэлтийн зургийг илгээвэл автоматаар бүртгэгдэнэ.</b>`
  )
}

async function handleUnlinkCommand(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: unlinkDriver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!unlinkDriver) {
    await tgSend(chatId, `❓ Энэ аккаунт ямар ч жолоочтой холбогдоогүй байна.`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('delivery_drivers')
    .update({ telegram_chat_id: null, telegram_linked_at: null })
    .eq('id', unlinkDriver.id)

  await tgSend(chatId,
    `✅ <b>${unlinkDriver.name}</b> — амжилттай салгалаа.\n\n` +
    `Дахин холбогдохын тулд утасны дугаараа илгээнэ үү.`
  )
}

async function handleOrdersCommand(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersDriver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!ordersDriver) {
    await tgSend(chatId, `❓ Таны акаунт холбогдоогүй байна.\nУтасны дугаараа илгээнэ үү.`)
    return
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
    return
  }

  const STATUS_LABEL: Record<string, string> = {
    assigned: '🟡 Хуваарилагдсан',
    at_store: '🏪 Дэлгүүрт хүлээж байна',
    picked_up: '📦 Авсан — хүргэж байна',
    in_transit: '🚚 Замд яваа',
    delayed: '⏰ Хоцорсон',
  }

  await tgSend(chatId, `🚚 <b>Таны захиалгууд (${deliveries.length})</b>\nДоорх захиалга тус бүрд шаардлагатай үйлдлийг сонгоно уу:`)

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

    let keyboard: TgInlineKeyboard | undefined
    if (d.status === 'assigned' || d.status === 'at_store') {
      keyboard = orderAssignedKeyboard(d.id)
    } else if (['picked_up', 'in_transit', 'delayed'].includes(d.status)) {
      keyboard = enRouteKeyboard(d.id)
    }

    await tgSend(chatId, cardText, keyboard ? { replyMarkup: keyboard } : undefined)
  }
}

async function handleFindCommand(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
  text: string,
): Promise<void> {
  const searchQuery = text.replace(/^\/find\s*/i, '').trim()

  if (!searchQuery) {
    await tgSend(chatId, `❓ <b>Хүргэлтийн дугаар оруулна уу.</b>\n\nЖишээ:\n• /find ORD-12345\n• /find 12345`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: findDriver } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!findDriver) {
    await tgSend(chatId, `❓ Таны акаунт холбогдоогүй байна.\nУтасны дугаараа илгээнэ үү.`)
    return
  }

  const normalizedSearch = searchQuery.replace(/^ORD-?/i, '').replace(/\s/g, '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: foundDeliveries } = await (supabase as any)
    .from('deliveries')
    .select(`
      id, delivery_number, status, delivery_address, customer_name, customer_phone,
      delivery_fee, order_id,
      orders(order_number, total_amount, order_items(quantity, products(name)))
    `)
    .eq('driver_id', findDriver.id)
    .ilike('delivery_number', `%${normalizedSearch}%`)
    .limit(3)

  if (!foundDeliveries || foundDeliveries.length === 0) {
    await tgSend(chatId, `❌ <b>Хүргэлт олдсонгүй:</b> "${searchQuery}"\n\nДугаараа шалгаж дахин оролдоно уу.`)
    return
  }

  const FIND_STATUS_LABEL: Record<string, string> = {
    pending: '⏳ Хүлээгдэж буй',
    assigned: '🟡 Оноосон',
    at_store: '🏪 Дэлгүүрт',
    picked_up: '📦 Авсан',
    in_transit: '🚚 Замд',
    delivered: '✅ Хүргэсэн',
    failed: '❌ Амжилтгүй',
    cancelled: '🚫 Цуцлагдсан',
    delayed: '⚠️ Хоцорсон',
  }

  for (const del of foundDeliveries as {
    id: string
    delivery_number: string
    status: string
    delivery_address: string
    customer_name: string | null
    customer_phone: string | null
    delivery_fee: number | null
    order_id: string | null
    orders: { order_number: string; total_amount: number; order_items: { quantity: number; products: { name: string } | null }[] } | null
  }[]) {
    const statusLabel = FIND_STATUS_LABEL[del.status] || del.status

    let productList = ''
    if (del.orders?.order_items && del.orders.order_items.length > 0) {
      productList = del.orders.order_items
        .map(item => `• ${item.products?.name || 'Бараа'} x${item.quantity}`)
        .join('\n')
    }

    const totalAmount = del.orders?.total_amount || 0
    const deliveryFee = del.delivery_fee || 0
    const grandTotal = totalAmount + deliveryFee

    const cardText =
      `📦 <b>#${del.delivery_number}</b> — ${statusLabel}\n\n` +
      `👤 ${del.customer_name || '—'} | 📞 ${del.customer_phone ? `<code>${del.customer_phone}</code>` : '—'}\n` +
      `📍 ${del.delivery_address || '—'}\n` +
      (productList ? `\n🛍️ <b>Бараа:</b>\n${productList}\n` : '') +
      `\n💰 Нийт: ${new Intl.NumberFormat('mn-MN').format(grandTotal)}₮` +
      (deliveryFee > 0 ? ` (+${new Intl.NumberFormat('mn-MN').format(deliveryFee)}₮ хүргэлт)` : '')

    let keyboard: TgInlineKeyboard | undefined
    if (del.status === 'assigned' || del.status === 'at_store') {
      keyboard = orderAssignedKeyboard(del.id)
    } else if (['picked_up', 'in_transit', 'delayed'].includes(del.status)) {
      keyboard = enRouteKeyboard(del.id)
    }

    await tgSend(chatId, cardText, keyboard ? { replyMarkup: keyboard } : undefined)
  }
}

async function handleCustomDelayTime(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
  text: string,
  earlyDriver: { id: string; name?: string } | null,
  earlyMeta: Record<string, unknown> | null,
  awaitingDelayDeliveryId: string,
  awaitingDelayMsgId: number | null | undefined,
): Promise<void> {
  let customEta = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
  const lowerText = text.toLowerCase()
  if (/маргааш|margaash|tomorrow/i.test(lowerText)) {
    customEta = new Date(Date.now() + 24 * 60 * 60 * 1000)
  } else if (/7 хоног|долоо хоног|1 week|7 honog/i.test(lowerText)) {
    customEta = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  } else if (/(\d+)\s*(?:хоног|honog|өдөр|odor|day)/i.test(lowerText)) {
    const days = parseInt(RegExp.$1, 10)
    if (days > 0 && days <= 30) customEta = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('deliveries')
    .update({ status: 'delayed', notes: `Хоцрох: ${text}`, estimated_delivery_time: customEta.toISOString() })
    .eq('id', awaitingDelayDeliveryId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customDelDel } = await (supabase as any)
    .from('deliveries')
    .select('delivery_number, store_id, order_id')
    .eq('id', awaitingDelayDeliveryId)
    .single()

  const clearedMeta = { ...earlyMeta }
  delete clearedMeta.awaiting_delay_time
  delete clearedMeta.awaiting_delay_message_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

  const customDelayHeader = await getDeliveryHeader(supabase, awaitingDelayDeliveryId)
  if (awaitingDelayMsgId) {
    await tgEdit(chatId, awaitingDelayMsgId,
      `${customDelayHeader}⏰ <b>ХОЙШЛУУЛСАН</b>\n📅 Шинэ хугацаа: "${text}"`,
      { replyMarkup: enRouteKeyboard(awaitingDelayDeliveryId) }
    )
  } else {
    await tgSend(chatId,
      `⏰ <b>Бүртгэгдлээ.</b>\n\n📅 Шинэ хугацаа: "${text}"\nДэлгүүрт мэдэгдлээ.`,
      { replyMarkup: enRouteKeyboard(awaitingDelayDeliveryId) }
    )
  }
  if (customDelDel) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('notifications').insert({
      store_id: customDelDel.store_id, type: 'delivery_delayed',
      title: '⏰ Хүргэлт хоцорлоо',
      body: `${earlyDriver?.name ?? 'Жолооч'} — #${customDelDel.delivery_number}: "${text}" хүргэнэ.`,
      data: { delivery_id: awaitingDelayDeliveryId, eta_text: text },
    }).then(null, () => {})

    if (customDelDel.order_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cdOrd } = await (supabase as any).from('orders').select('notes').eq('id', customDelDel.order_id).single()
      const cdExisting = (cdOrd?.notes as string) || ''
      const cdNote = `⏰ Хойшлуулсан: ${text}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('orders')
        .update({ notes: cdExisting ? `${cdExisting}\n${cdNote}` : cdNote })
        .eq('id', customDelDel.order_id)
    }

    const delayBotToken = process.env.TELEGRAM_BOT_TOKEN
    if (delayBotToken) {
      const delayTgMsg =
        `⏰ <b>ХҮРГЭЛТ ХОЙШЛУУЛСАН</b>\n\n` +
        `🆔 #${customDelDel.delivery_number}\n` +
        `🚚 Жолооч: ${earlyDriver?.name ?? '—'}\n` +
        `📅 Шинэ хугацаа: "${text}"\n`
      const delayChatIds = await getStaffMemberChatIds(supabase, customDelDel.store_id)
      for (const cid of delayChatIds) {
        await fetch(`https://api.telegram.org/bot${delayBotToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: cid, text: delayTgMsg, parse_mode: 'HTML' }),
        }).catch(() => {})
      }
    }
  }
}

async function handleCustomDenyReason(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
  text: string,
  earlyDriver: { id: string; name?: string } | null,
  earlyMeta: Record<string, unknown> | null,
  awaitingDenyReason: { deliveryId: string },
): Promise<void> {
  const drId = awaitingDenyReason.deliveryId

  const clearedM = { ...earlyMeta }
  delete clearedM.awaiting_deny_reason
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('delivery_drivers').update({ metadata: clearedM }).eq('telegram_chat_id', chatId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deniedDelCustom } = await (supabase as any)
    .from('deliveries')
    .update({
      status: 'pending',
      driver_id: null,
      denial_info: {
        driver_id: earlyDriver?.id,
        driver_name: earlyDriver?.name ?? 'Жолооч',
        reason: 'other',
        reason_label: `Бусад: ${text}`,
        denied_at: new Date().toISOString(),
      },
    })
    .eq('id', drId)
    .select('delivery_number, store_id')
    .single()

  if (deniedDelCustom?.store_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('notifications').insert({
      store_id: deniedDelCustom.store_id,
      type: 'delivery_denied',
      title: '❌ Жолооч татгалзлаа',
      body: `${earlyDriver?.name ?? 'Жолооч'} #${deniedDelCustom.delivery_number} татгалзлаа: ${text}`,
      data: { delivery_id: drId },
    }).then(null, () => {})
  }

  await tgSend(chatId, `↩️ Татгалзлаа. Менежерт мэдэгдлээ.`)
}

async function handleCustomPayment(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
  text: string,
  earlyDriver: { id: string; name?: string } | null,
  earlyMeta: Record<string, unknown> | null,
  awaitingCustomPayment: { deliveryId: string; step: 'amount' | 'reason'; amount?: number; messageId?: number | null },
): Promise<void> {
  const custMsgId = awaitingCustomPayment.messageId ?? null
  if (awaitingCustomPayment.step === 'amount') {
    const amount = parseInt(text.replace(/[^\d]/g, ''), 10)
    if (isNaN(amount) || amount <= 0) {
      await tgSend(chatId, `❌ Зөв тоо оруулна уу (жишээ: 25000)`)
      return
    }

    const updatedMeta = {
      ...earlyMeta,
      awaiting_custom_payment: { ...awaitingCustomPayment, step: 'reason', amount },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('delivery_drivers').update({ metadata: updatedMeta }).eq('telegram_chat_id', chatId)

    const custPayHdr = await getDeliveryHeader(supabase, awaitingCustomPayment.deliveryId)
    if (custMsgId) {
      await tgEdit(chatId, custMsgId, `${custPayHdr}💰 Дүн: <b>${new Intl.NumberFormat('mn-MN').format(amount)}₮</b>\n\n📝 <b>Шалтгааныг тайлбарлана уу:</b>`, { replyMarkup: { inline_keyboard: [] } })
    } else {
      await tgSend(chatId, `💰 Дүн: <b>${new Intl.NumberFormat('mn-MN').format(amount)}₮</b>\n\n📝 <b>Шалтгааныг тайлбарлана уу:</b>`)
    }
    return
  }

  if (awaitingCustomPayment.step === 'reason') {
    const reason = text
    const amount = awaitingCustomPayment.amount || 0
    const delId = awaitingCustomPayment.deliveryId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('deliveries')
      .update({
        status: 'delivered',
        actual_delivery_time: new Date().toISOString(),
        metadata: await mergedDeliveryMeta(supabase, delId, { custom_payment: { amount, reason, recorded_at: new Date().toISOString() } }),
      })
      .eq('id', delId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customPayDelivery } = await (supabase as any)
      .from('deliveries')
      .select('id, order_id, delivery_number, store_id, customer_name, customer_phone, delivery_address')
      .eq('id', delId)
      .single()
    console.log('[DriverBot] Custom payment delivery update:', { delId, customPayDelivery: !!customPayDelivery })

    let customPayOrderTotal = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cpDelOrder } = await (supabase as any).from('deliveries').select('order_id').eq('id', delId).single()
    const cpOrderId = customPayDelivery?.order_id || cpDelOrder?.order_id
    if (cpOrderId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cpOrder } = await (supabase as any).from('orders').select('total_amount').eq('id', cpOrderId).single()
      customPayOrderTotal = cpOrder?.total_amount || 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('orders')
        .update({ payment_status: 'partial', notes: `Жолооч: ${amount}₮ авсан. Шалтгаан: ${reason}` })
        .eq('id', cpOrderId)
    }

    const clearedMeta = { ...earlyMeta }
    delete clearedMeta.awaiting_custom_payment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

    const formattedAmount = new Intl.NumberFormat('mn-MN').format(amount)
    const custReasonHdr = await getDeliveryHeader(supabase, delId)
    if (custMsgId) {
      await tgEdit(chatId, custMsgId, `${custReasonHdr}💸 <b>ДУТУУ ТӨЛБӨР</b>\n${formattedAmount}₮ авсан\n📝 Шалтгаан: ${reason}`, { replyMarkup: { inline_keyboard: [] } })
    } else {
      await tgSend(chatId, `✅ <b>Бүртгэгдлээ.</b>\n\n💸 ${formattedAmount}₮ авсан\n📝 Шалтгаан: ${reason}\n\nБаярлалаа!`)
    }

    const cpDelInfo = customPayDelivery
    console.log('[DriverBot] Custom payment notify check:', { delId, hasData: !!cpDelInfo, storeId: cpDelInfo?.store_id })

    if (cpDelInfo?.store_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('notifications').insert({
        store_id: cpDelInfo.store_id,
        type: 'delivery_completed',
        title: `💸 Дутуу төлбөр`,
        body: `#${cpDelInfo.delivery_number} хүргэгдэж, ${formattedAmount}₮ авлаа. Шалтгаан: ${reason}`,
        data: { delivery_id: delId, amount, reason },
      }).then(null, () => {})

      const fmtTotal = new Intl.NumberFormat('mn-MN').format(customPayOrderTotal)
      const fmtDiff = new Intl.NumberFormat('mn-MN').format(customPayOrderTotal - amount)
      const storeBotToken = process.env.TELEGRAM_BOT_TOKEN
      if (storeBotToken) {
        const cpStoreMsg =
          `💸 <b>ДУТУУ ТӨЛБӨР</b>\n\n` +
          `🆔 Хүргэлт: #${cpDelInfo.delivery_number}\n` +
          `👤 Хүлээн авагч: ${cpDelInfo.customer_name || '—'}` +
          (cpDelInfo.customer_phone ? ` · <code>${cpDelInfo.customer_phone}</code>` : '') + `\n` +
          `📍 Хаяг: ${cpDelInfo.delivery_address || '—'}\n\n` +
          `💰 Захиалгын дүн: ${fmtTotal}₮\n` +
          `✅ Авсан: ${formattedAmount}₮\n` +
          `❌ Дутуу: ${fmtDiff}₮\n\n` +
          `📝 Шалтгаан: ${reason}\n\n` +
          `⚠️ Харилцагчтай холбогдож үлдсэн төлбөрийг авна уу.`

        const cpChatIds = await getStaffMemberChatIds(supabase, cpDelInfo.store_id)
        console.log('[DriverBot] Partial payment TG notify:', { storeId: cpDelInfo.store_id, chatIds: cpChatIds })
        for (const sChatId of cpChatIds) {
          const tgRes = await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: sChatId, text: cpStoreMsg, parse_mode: 'HTML' }),
          }).catch((e) => { console.error('[DriverBot] TG send failed:', e); return null })
          if (tgRes) {
            const tgJson = await tgRes.json().catch(() => null)
            console.log('[DriverBot] TG send result:', { chatId: sChatId, ok: tgJson?.ok, error: tgJson?.description })
          }
        }
      }
    }

    const agentOrderId = cpDelInfo?.order_id || cpOrderId
    if (agentOrderId && cpDelInfo?.store_id) {
      try {
        await initiatePartialPaymentResolution({
          deliveryId: delId,
          orderId: agentOrderId,
          storeId: cpDelInfo.store_id,
          paidAmount: amount,
          driverReason: reason,
          customerName: cpDelInfo.customer_name,
          customerPhone: cpDelInfo.customer_phone,
        })
      } catch (err) {
        console.error('[DriverBot] Partial payment agent error:', err)
      }
    }
  }
}

async function handleRefusalReason(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
  text: string,
  earlyMeta: Record<string, unknown> | null,
  awaitingRefusalReason: { deliveryId: string; messageId?: number | null },
): Promise<void> {
  const reason = text
  const delId = awaitingRefusalReason.deliveryId
  const refusalMsgId = awaitingRefusalReason.messageId ?? null

  const clearedMeta = { ...earlyMeta }
  delete clearedMeta.awaiting_refusal_reason
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('delivery_drivers').update({ metadata: clearedMeta }).eq('telegram_chat_id', chatId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refusedDelivery } = await (supabase as any)
    .from('deliveries')
    .update({
      status: 'failed',
      metadata: await mergedDeliveryMeta(supabase, delId, { refusal_reason: reason, customer_refused: true }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', delId)
    .select('id, order_id, delivery_number, store_id')
    .single()

  let orderNumber = ''
  let customerId = ''
  if (refusedDelivery?.order_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderData } = await (supabase as any)
      .from('orders')
      .update({
        status: 'cancelled',
        notes: `Харилцагч хүлээж аваагүй: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', refusedDelivery.order_id)
      .select('order_number, customer_id')
      .single()

    orderNumber = orderData?.order_number || ''
    customerId = orderData?.customer_id || ''
  }

  if (refusedDelivery?.store_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('notifications').insert({
      store_id: refusedDelivery.store_id,
      type: 'delivery_failed',
      title: `🚫 Харилцагч татгалзлаа`,
      body: `#${refusedDelivery.delivery_number} — харилцагч авахаас татгалзлаа. Шалтгаан: ${reason}`,
      data: { delivery_id: delId, reason, customer_refused: true },
    }).then(null, () => {})
  }

  if (customerId && refusedDelivery?.store_id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: conversation } = await (supabase as any)
        .from('conversations')
        .select('id')
        .eq('customer_id', customerId)
        .eq('store_id', refusedDelivery.store_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (conversation) {
        const orderRef = orderNumber ? `#${orderNumber}` : `#${refusedDelivery.delivery_number}`
        const followUpMsg =
          `Таны ${orderRef} захиалга хүргэгдэх гэсэн боловч хүлээж аваагүй байна. ` +
          `Шалтгаан: ${reason}. ` +
          `Дахин хүргүүлэх үү? Хэрэв тийм бол бид удахгүй хүргэлтийг дахин зохион байгуулна.`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('messages').insert({
          conversation_id: conversation.id,
          content: followUpMsg,
          is_from_customer: false,
          is_ai_response: true,
          metadata: { type: 'customer_refusal_followup', delivery_id: delId, reason },
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('deliveries').update({
          metadata: await mergedDeliveryMeta(supabase, delId, { refusal_reason: reason, customer_refused: true, customer_refusal_followup: true }),
        }).eq('id', delId)
      }
    } catch (followUpErr) {
      console.error('[DriverBot] Customer refusal follow-up failed:', followUpErr)
    }
  }

  const refusalHeader = await getDeliveryHeader(supabase, delId)
  if (refusalMsgId) {
    await tgEdit(chatId, refusalMsgId,
      `${refusalHeader}🚫 <b>АВАХААС ТАТГАЛЗСАН</b>\n📝 Шалтгаан: ${reason}\n\nДэлгүүрт мэдэгдлээ.`,
      { replyMarkup: { inline_keyboard: [] } }
    )
  } else {
    await tgSend(chatId, `✅ <b>Бүртгэгдлээ.</b>\n\nХарилцагчид AI агентаар мэдэгдлээ.`)
  }
}

async function handlePhoneLink(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  msg: TgMessage,
  chatId: number,
  text: string,
): Promise<void> {
  const rawPhone = msg.contact?.phone_number ?? text
  const phone = normalizePhone(rawPhone)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: driver, error: lookupError } = await (supabase as any)
    .from('delivery_drivers')
    .select('id, name, phone')
    .ilike('phone', `%${phone}`)
    .maybeSingle()

  if (lookupError || !driver) {
    console.log(`[DriverBot] NOT FOUND — phone "${phone}" not in DB`)
    await tgSend(chatId, DRIVER_BOT_NOT_FOUND)
    return
  }

  const linked = await recordTgHistory(supabase, driver.id, chatId, msg.from ?? { id: chatId })

  if (!linked) {
    await tgSend(chatId, '❌ Холбоход алдаа гарлаа. Дахин оролдоно уу.')
    return
  }

  await tgSend(chatId, DRIVER_BOT_LINKED(driver.name))
}

async function handleWizardInput(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chatId: number,
  text: string,
  driver: { id: string; name?: string; metadata?: unknown },
  driverMetadata: Record<string, unknown> | null,
  wiz: IntercityWizard,
): Promise<boolean> {
  switch (wiz.step) {
    case 'phone': {
      const updatedWiz: IntercityWizard = { ...wiz, step: 'license', phone: text }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
      }).eq('id', driver.id)

      await tgSend(chatId,
        `📞 Утас: <b>${text}</b> ✅\n\n🚗 <b>Машины дугаар</b> оруулна уу:\n(жишээ: 1234 УНА)`
      )
      return true
    }

    case 'license': {
      const updatedWiz: IntercityWizard = { ...wiz, step: 'eta', license: text }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('delivery_drivers').update({
        metadata: { ...driverMetadata, intercity_wizard: updatedWiz },
      }).eq('id', driver.id)

      await tgSend(chatId,
        `🚗 Дугаар: <b>${text}</b> ✅\n\n⏰ <b>Ойролцоо ирэх хугацаа</b> оруулна уу:\n(жишээ: Маргааш 14:00, Ням гарагт 18:00)`
      )
      return true
    }

    case 'eta': {
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
      return true
    }

    case 'payment': {
      await tgSend(chatId, `⬆️ Дээрх товчийг дарна уу: ✅ Тийм, авсан эсвэл ❌ Аваагүй / Дараа`)
      return true
    }

    case 'confirm': {
      await tgSend(chatId, `⬆️ Дээрх товчийг дарна уу: ✅ Тийм, илгээ эсвэл 🔄 Дахин оруулах`)
      return true
    }

    default:
      return false
  }
}

async function handleWrongItemPhoto(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  msg: TgMessage,
  chatId: number,
  driver: { id: string; name?: string; metadata?: unknown },
  driverMeta: Record<string, unknown>,
): Promise<void> {
  const wrongDeliveryId = driverMeta.awaiting_wrong_photo as string
  const fileId = msg.photo![msg.photo!.length - 1].file_id as string

  const { awaiting_wrong_photo: _, ...cleanMeta } = driverMeta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('delivery_drivers')
    .update({ metadata: cleanMeta })
    .eq('id', driver.id)

  let wrongPhotoUrl = ''
  let wrongPhotoBlob: Blob | null = null
  try {
    const driverBotToken = process.env.DRIVER_TELEGRAM_BOT_TOKEN
    if (driverBotToken) {
      const getFileRes = await fetch(`https://api.telegram.org/bot${driverBotToken}/getFile?file_id=${encodeURIComponent(fileId)}`)
      const getFileData = await getFileRes.json() as { ok: boolean; result?: { file_path: string } }
      if (getFileData.ok && getFileData.result?.file_path) {
        const photoUrl = `https://api.telegram.org/file/bot${driverBotToken}/${getFileData.result.file_path}`
        const photoRes = await fetch(photoUrl)
        const arrayBuf = await photoRes.arrayBuffer()
        const photoBuf = Buffer.from(arrayBuf)
        wrongPhotoBlob = new Blob([photoBuf])
        const ext = getFileData.result.file_path.split('.').pop() || 'jpg'
        const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
        const storagePath = `${wrongDeliveryId}/wrong_item_${Date.now()}.${ext}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: uploadErr } = await (supabase as any).storage
          .from('delivery-proofs')
          .upload(storagePath, photoBuf, { contentType, upsert: true })
        if (uploadErr) {
          console.error('[DriverBot] Wrong item photo upload error:', uploadErr)
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: urlData } = (supabase as any).storage.from('delivery-proofs').getPublicUrl(storagePath)
          wrongPhotoUrl = urlData?.publicUrl || ''
          console.log('[DriverBot] Wrong item photo uploaded:', wrongPhotoUrl)
        }
      } else {
        console.error('[DriverBot] getFile failed:', JSON.stringify(getFileData))
      }
    } else {
      console.error('[DriverBot] DRIVER_TELEGRAM_BOT_TOKEN not set')
    }
  } catch (photoErr) {
    console.error('[DriverBot] Wrong item photo upload error:', photoErr)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wpDel } = await (supabase as any)
    .from('deliveries')
    .update({
      notes: 'Буруу бараа — зураг илгээсэн',
      metadata: await mergedDeliveryMeta(supabase, wrongDeliveryId, { awaiting_wrong_photo: false, wrong_item_photo_url: wrongPhotoUrl, wrong_item_photo_file_id: fileId }),
    })
    .eq('id', wrongDeliveryId)
    .select('delivery_number, store_id, order_id, customer_name, customer_phone, delivery_address')
    .single()

  await tgSend(chatId, `📸 Зураг хүлээн авлаа. Дэлгүүрт мэдэгдлээ.\nБарааг агуулахад буцааж өгнө үү.`, {
    replyMarkup: {
      inline_keyboard: [
        [{ text: '📦 Агуулахад буцааж өгсөн', callback_data: `wrong_returned:${wrongDeliveryId}` }],
      ],
    },
  })

  if (wpDel) {
    let orderItemsText = ''
    let customerId = ''
    if (wpDel.order_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orderData } = await (supabase as any)
        .from('orders')
        .select('order_number, customer_id, order_items(quantity, unit_price, variant_label, products(name), product_variants(size, color))')
        .eq('id', wpDel.order_id)
        .single()

      customerId = orderData?.customer_id || ''
      if (orderData?.order_items) {
        orderItemsText = (orderData.order_items as Array<{
          quantity: number; unit_price: number; variant_label: string | null
          products: { name: string } | null
          product_variants: { size: string | null; color: string | null } | null
        }>).map((item) => {
          const name = item.products?.name || 'Бараа'
          const parts = [name]
          if (item.product_variants?.size) parts.push(`Размер: ${item.product_variants.size}`)
          if (item.product_variants?.color) parts.push(`Өнгө: ${item.product_variants.color}`)
          if (item.variant_label) parts.push(item.variant_label)
          return `• ${parts.join(' / ')} x${item.quantity}`
        }).join('\n')
      }
    }

    if (customerId && wpDel.store_id) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: conversation } = await (supabase as any)
          .from('conversations')
          .select('id')
          .eq('customer_id', customerId)
          .eq('store_id', wpDel.store_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (conversation) {
          const confirmMsg =
            `Уучлаарай, таны захиалгад асуудал гарсан байна.\n\n` +
            `📦 Таны захиалсан бараа:\n${orderItemsText || '(мэдээлэл олдсонгүй)'}\n\n` +
            `Та дээрх захиалга зөв эсэхийг баталгаажуулна уу. Бид дэлгүүрт мэдэгдэж, зөв барааг дахин хүргүүлнэ.`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('messages').insert({
            conversation_id: conversation.id,
            content: confirmMsg,
            is_from_customer: false,
            is_ai_response: true,
            metadata: { type: 'wrong_product_confirmation', delivery_id: wrongDeliveryId },
          })
        }
      } catch (customerMsgErr) {
        console.error('[DriverBot] Wrong product customer message failed:', customerMsgErr)
      }
    }

    const storeMsg =
      `📦 <b>БУРУУ БАРАА МЭДЭГДЭЛ</b>\n\n` +
      `🆔 Хүргэлт: #${wpDel.delivery_number}\n` +
      `👤 Хүлээн авагч: ${wpDel.customer_name || '—'}\n` +
      `📞 Утас: ${wpDel.customer_phone || '—'}\n` +
      `📍 Хаяг: ${wpDel.delivery_address || '—'}\n\n` +
      `🛒 <b>Захиалсан бараа:</b>\n${orderItemsText || '(мэдээлэл олдсонгүй)'}\n\n` +
      `⚠️ Жолооч буруу бараа мэдэгдэж, зураг илгээсэн.\n` +
      `Барааг шалгаж, зөв барааг бэлдэнэ үү.`

    const storeKeyboard = {
      inline_keyboard: [
        [{ text: '✅ Зөв бараа бэлдлээ — дахин хүргэх', callback_data: `wrong_product_resend:${wrongDeliveryId}` }],
        [{ text: '❌ Илгээсэн бараа зөв байсан', callback_data: `wrong_product_correct:${wrongDeliveryId}` }],
      ],
    }

    const storeBotToken = process.env.TELEGRAM_BOT_TOKEN
    const allChatIds: string[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storeStaff } = await (supabase as any)
      .from('staff')
      .select('telegram_chat_id')
      .eq('store_id', wpDel.store_id)
      .not('telegram_chat_id', 'is', null)

    for (const s of (storeStaff || []) as Array<{ telegram_chat_id: string }>) {
      if (s.telegram_chat_id && !allChatIds.includes(s.telegram_chat_id)) allChatIds.push(s.telegram_chat_id)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storeMembers } = await (supabase as any)
      .from('store_members')
      .select('telegram_chat_id, notification_preferences')
      .eq('store_id', wpDel.store_id)
      .not('telegram_chat_id', 'is', null)

    for (const m of (storeMembers || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
      const prefs = m.notification_preferences || {}
      const wantsDelivery = prefs.delivery !== false
      if (m.telegram_chat_id && wantsDelivery && !allChatIds.includes(m.telegram_chat_id)) {
        allChatIds.push(m.telegram_chat_id)
      }
    }

    if (storeBotToken && allChatIds.length > 0) {
      for (const sChatId of allChatIds) {
        try {
          if (wrongPhotoBlob) {
            const formData = new FormData()
            formData.append('chat_id', sChatId)
            formData.append('photo', wrongPhotoBlob, 'wrong_item.jpg')
            formData.append('caption', `📦 Буруу бараа — #${wpDel.delivery_number}\n📸 Жолоочийн илгээсэн зураг`)
            formData.append('parse_mode', 'HTML')
            await fetch(`https://api.telegram.org/bot${storeBotToken}/sendPhoto`, {
              method: 'POST',
              body: formData,
            })
          }
          await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: sChatId,
              text: storeMsg,
              parse_mode: 'HTML',
              reply_markup: storeKeyboard,
            }),
          })
        } catch (tgErr) {
          console.error(`[DriverBot] Staff TG notify failed for ${sChatId}:`, tgErr)
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('notifications').insert({
      store_id: wpDel.store_id, type: 'delivery_failed',
      title: '📦 Буруу бараа',
      body: `${(driver as Record<string, unknown>).name} — #${wpDel.delivery_number}: буруу бараа. Зураг илгээсэн.`,
      data: {
        delivery_id: wrongDeliveryId, reason: 'wrong_product',
        wrong_item_photo_url: wrongPhotoUrl,
        order_items: orderItemsText,
      },
    }).then(null, () => {})
  }
}

async function handlePhotoProof(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  msg: TgMessage,
  chatId: number,
  driver: { id: string; name?: string; metadata?: unknown },
): Promise<void> {
  const fileId = msg.photo![msg.photo!.length - 1].file_id as string

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
    return
  }

  const existingMeta = (activeDelivery.metadata ?? {}) as Record<string, unknown>
  const orderNum = activeDelivery.orders?.order_number ?? activeDelivery.id.slice(0, 8)
  const storeId = activeDelivery.orders?.store_id as string | undefined

  const updatedMeta = {
    ...existingMeta,
    proof_photo_file_id: fileId,
    proof_photo_at: new Date().toISOString(),
  }

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

  if (canComplete) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', activeDelivery.order_id)
      .then(null, () => {})
  }

  if (storeId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('notifications').insert({
      store_id: storeId,
      type: 'delivery_photo_proof',
      title: `📸 Хүргэлтийн зураг — ${orderNum}`,
      message: canComplete
        ? `Жолооч зураг илгээж хүргэлтийг баталгаажуулав. Захиалга #${orderNum}.`
        : `Жолооч хүргэлтийн зураг илгээв. Захиалга #${orderNum}.`,
      data: {
        delivery_id: activeDelivery.id,
        proof_photo_file_id: fileId,
        driver_name: (driver as { id: string; name?: string }).name,
      },
    }).then(null, () => {})
  }

  const confirmMsg = canComplete
    ? `✅ Зураг хүлээн авлаа. Захиалга <b>#${orderNum}</b> хүргэгдсэн гэж бүртгэгдлээ. Баярлалаа! 🙏`
    : `📸 Зураг хүлээн авлаа. Захиалга <b>#${orderNum}</b>-д хадгалагдлаа.`

  await tgSend(chatId, confirmMsg)
}
