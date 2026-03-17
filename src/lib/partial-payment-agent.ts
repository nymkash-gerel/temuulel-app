/**
 * Partial Payment Resolution Agent
 *
 * When a driver reports partial payment, this agent:
 * 1. Messages the customer to ask why they paid less
 * 2. Evaluates the customer's response using GPT
 * 3. If not justified → creates QPay invoice for remaining amount
 * 4. If justified → records reason, notifies staff
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { jsonCompletion } from '@/lib/ai/openai-client'
import { sendTextMessage, sendQuickReplies, sendButtonMessage } from '@/lib/messenger'
import { createQPayInvoice } from '@/lib/qpay'
import { sendSMS } from '@/lib/sms'

// ---------- Types ----------

interface PartialPaymentResolution {
  status: 'agent_contacted' | 'justified' | 'not_justified' | 'payment_requested' | 'resolved' | 'escalated'
  paid_amount: number
  remaining_amount: number
  total_amount: number
  driver_reason: string
  customer_reason: string | null
  ai_evaluation: AiEvaluation | null
  qpay_invoice_id: string | null
  qpay_short_url: string | null
  contacted_at: string | null
  resolved_at: string | null
  turn_count: number
}

interface AiEvaluation {
  justified: boolean
  category: string
  confidence: number
  reasoning: string
}

interface OrderInfo {
  id: string
  order_number: string
  total_amount: number
  items: Array<{ name: string; quantity: number; price: number }>
  delivery_fee: number
}

// ---------- Constants ----------

const MAX_TURNS = 3

const QUICK_REPLIES = [
  { title: 'Бараа гэмтэлтэй', payload: 'PP_DEFECTIVE' },
  { title: 'Буруу бараа', payload: 'PP_WRONG_ITEM' },
  { title: 'Дутуу бараа', payload: 'PP_MISSING' },
  { title: 'Бусад', payload: 'PP_OTHER' },
]

// ---------- Admin client helper ----------

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------- 1. Initiate — called from driver bot ----------

export async function initiatePartialPaymentResolution(params: {
  deliveryId: string
  orderId: string | null
  storeId: string
  paidAmount: number
  driverReason: string
  customerName: string | null
  customerPhone: string | null
}): Promise<void> {
  const { deliveryId, orderId, storeId, paidAmount, driverReason, customerName, customerPhone } = params
  const supabase = getAdminSupabase()

  if (!orderId) {
    console.log('[PartialPaymentAgent] No order_id, skipping agent')
    return
  }

  // Fetch order info
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, metadata')
    .eq('id', orderId)
    .single()

  if (!order) {
    console.log('[PartialPaymentAgent] Order not found:', orderId)
    return
  }

  const totalAmount = order.total_amount || 0
  const remainingAmount = totalAmount - paidAmount

  if (remainingAmount <= 0) {
    console.log('[PartialPaymentAgent] No remaining amount, skipping')
    return
  }

  // Fetch order items
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_name, quantity, unit_price')
    .eq('order_id', orderId)

  const items = (orderItems || []).map((i: Record<string, unknown>) => ({
    name: i.product_name as string,
    quantity: i.quantity as number,
    price: i.unit_price as number,
  }))

  // Save resolution state
  const resolution: PartialPaymentResolution = {
    status: 'agent_contacted',
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    total_amount: totalAmount,
    driver_reason: driverReason,
    customer_reason: null,
    ai_evaluation: null,
    qpay_invoice_id: null,
    qpay_short_url: null,
    contacted_at: new Date().toISOString(),
    resolved_at: null,
    turn_count: 0,
  }

  const existingMeta = (order.metadata ?? {}) as Record<string, unknown>
  await supabase
    .from('orders')
    .update({ metadata: { ...existingMeta, partial_payment_resolution: resolution } })
    .eq('id', orderId)

  // Find the customer
  const { data: customer } = await supabase
    .from('customers')
    .select('id, messenger_id, instagram_id, channel, phone')
    .eq('store_id', storeId)
    .or(`phone.eq.${customerPhone},name.eq.${customerName}`)
    .limit(1)
    .maybeSingle()

  // Also try via the order's customer_id
  let customerId = customer?.id
  let messengerId = customer?.messenger_id
  let instagramId = customer?.instagram_id
  let custPhone = customer?.phone || customerPhone

  if (!customerId) {
    const { data: orderCust } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', orderId)
      .single()

    if (orderCust?.customer_id) {
      const { data: c } = await supabase
        .from('customers')
        .select('id, messenger_id, instagram_id, channel, phone')
        .eq('id', orderCust.customer_id)
        .single()
      if (c) {
        customerId = c.id
        messengerId = c.messenger_id
        instagramId = c.instagram_id
        custPhone = c.phone || customerPhone
      }
    }
  }

  // Get store page token
  const { data: store } = await supabase
    .from('stores')
    .select('facebook_page_access_token')
    .eq('id', storeId)
    .single()

  const pageToken = store?.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN

  const fmtTotal = new Intl.NumberFormat('mn-MN').format(totalAmount)
  const fmtPaid = new Intl.NumberFormat('mn-MN').format(paidAmount)
  const fmtRemaining = new Intl.NumberFormat('mn-MN').format(remainingAmount)

  const itemsList = items.map(i => `  • ${i.name} x${i.quantity} — ${new Intl.NumberFormat('mn-MN').format(i.price)}₮`).join('\n')

  const message = `Сайн байна уу${customerName ? `, ${customerName}` : ''}!\n\n` +
    `Таны #${order.order_number} захиалга:\n${itemsList || '  (бараа мэдээлэл олдсонгүй)'}\n\n` +
    `Нийт дүн: ${fmtTotal}₮\n` +
    `Жолоочид төлсөн: ${fmtPaid}₮\n` +
    `Үлдэгдэл: ${fmtRemaining}₮\n\n` +
    `Дутуу төлбөрийн шалтгааныг тодруулна уу?`

  let messageSent = false

  // Try Messenger first
  const senderId = messengerId || instagramId
  if (senderId && pageToken) {
    try {
      const res = await sendQuickReplies(senderId, message, QUICK_REPLIES, pageToken)
      if (res) {
        messageSent = true
        console.log('[PartialPaymentAgent] Sent via Messenger to', senderId)

        // Save to conversation
        if (customerId) {
          const { data: conv } = await supabase
            .from('conversations')
            .select('id')
            .eq('store_id', storeId)
            .eq('customer_id', customerId)
            .neq('status', 'closed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (conv) {
            await supabase.from('messages').insert({
              conversation_id: conv.id,
              content: message,
              is_from_customer: false,
              is_ai_response: true,
              metadata: { type: 'partial_payment_agent', delivery_id: deliveryId, order_id: orderId },
            })
          }
        }
      }
    } catch (err) {
      console.error('[PartialPaymentAgent] Messenger send failed:', err)
    }
  }

  // Fallback to SMS
  if (!messageSent && custPhone) {
    const smsMsg = `Таны #${order.order_number} захиалгын ${fmtRemaining}₮ үлдэгдэл байна. Шалтгааныг тодруулахыг хүсье.`
    try {
      await sendSMS(custPhone, smsMsg)
      console.log('[PartialPaymentAgent] Sent via SMS to', custPhone)
    } catch (err) {
      console.error('[PartialPaymentAgent] SMS failed:', err)
    }
  }

  if (!messageSent && !custPhone) {
    console.log('[PartialPaymentAgent] No channel to reach customer, escalating')
    await supabase
      .from('orders')
      .update({
        metadata: {
          ...existingMeta,
          partial_payment_resolution: { ...resolution, status: 'escalated' },
        },
      })
      .eq('id', orderId)
  }
}

// ---------- 2. Handle customer reply — called from Messenger webhook ----------

export async function handlePartialPaymentReply(params: {
  supabase: SupabaseClient
  orderId: string
  storeId: string
  customerId: string
  customerMessage: string
  quickReplyPayload?: string | null
  senderId: string
  pageToken: string
  conversationId: string
}): Promise<{ handled: boolean; response?: string }> {
  const { supabase, orderId, storeId, customerId, customerMessage, quickReplyPayload, senderId, pageToken, conversationId } = params

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, metadata')
    .eq('id', orderId)
    .single()

  if (!order) return { handled: false }

  const meta = (order.metadata ?? {}) as Record<string, unknown>
  const resolution = meta.partial_payment_resolution as PartialPaymentResolution | undefined
  if (!resolution || resolution.status === 'resolved' || resolution.status === 'escalated') {
    return { handled: false }
  }

  // Map quick reply to reason
  let reason = customerMessage
  if (quickReplyPayload === 'PP_DEFECTIVE') reason = 'Бараа гэмтэлтэй байсан'
  else if (quickReplyPayload === 'PP_WRONG_ITEM') reason = 'Буруу бараа ирсэн'
  else if (quickReplyPayload === 'PP_MISSING') reason = 'Захиалгын бараа дутуу'
  else if (quickReplyPayload === 'PP_OTHER') reason = customerMessage // use their actual message

  // Fetch order items for AI context
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_name, quantity, unit_price')
    .eq('order_id', orderId)

  const itemsList = (orderItems || [])
    .map((i: Record<string, unknown>) => `${i.product_name} x${i.quantity} (${i.unit_price}₮)`)
    .join(', ')

  // Evaluate with GPT
  const evaluation = await evaluateCustomerReason({
    orderNumber: order.order_number,
    totalAmount: resolution.total_amount,
    paidAmount: resolution.paid_amount,
    remainingAmount: resolution.remaining_amount,
    driverReason: resolution.driver_reason,
    customerReason: reason,
    orderItems: itemsList,
  })

  const turnCount = (resolution.turn_count || 0) + 1

  // Update resolution state
  const updatedResolution: PartialPaymentResolution = {
    ...resolution,
    customer_reason: reason,
    ai_evaluation: evaluation,
    turn_count: turnCount,
  }

  if (evaluation.justified) {
    // Customer reason is valid — notify staff
    updatedResolution.status = 'justified'
    updatedResolution.resolved_at = new Date().toISOString()

    await supabase
      .from('orders')
      .update({ metadata: { ...meta, partial_payment_resolution: updatedResolution } })
      .eq('id', orderId)

    const response = `Таны шалтгааныг хүлээн авлаа (${evaluation.category}). Манай ажилтан тантай холбогдоно. Баярлалаа!`

    // Save AI message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: response,
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'partial_payment_agent', evaluation },
    })

    await sendTextMessage(senderId, response, pageToken)

    // Notify staff
    await notifyStaffResolution(supabase, storeId, order.order_number, resolution, evaluation, reason)

    return { handled: true, response }
  } else {
    // Not justified — request payment
    if (turnCount >= MAX_TURNS || evaluation.confidence > 0.7) {
      // Final: send QPay invoice
      updatedResolution.status = 'payment_requested'

      let qpayUrl = ''
      try {
        const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel-app.vercel.app'}/api/qpay/callback`
        const invoice = await createQPayInvoice({
          orderNumber: `${order.order_number}-REM`,
          amount: resolution.remaining_amount,
          description: `#${order.order_number} үлдэгдэл төлбөр`,
          callbackUrl,
        })
        updatedResolution.qpay_invoice_id = invoice.invoice_id
        updatedResolution.qpay_short_url = invoice.qPay_shortUrl
        qpayUrl = invoice.qPay_shortUrl
      } catch (qpayErr) {
        console.error('[PartialPaymentAgent] QPay invoice failed:', qpayErr)
      }

      await supabase
        .from('orders')
        .update({ metadata: { ...meta, partial_payment_resolution: updatedResolution } })
        .eq('id', orderId)

      const fmtRemaining = new Intl.NumberFormat('mn-MN').format(resolution.remaining_amount)
      let response: string

      if (qpayUrl) {
        response = `Таны шалтгааныг шалгалаа. Харамсалтай нь ${fmtRemaining}₮ үлдэгдэл төлбөрийг төлөх шаардлагатай байна.\n\nТөлбөр хийх:`
        // Send button with QPay link
        await sendButtonMessage(senderId, response, [{ title: `${fmtRemaining}₮ төлөх`, url: qpayUrl }], pageToken)
      } else {
        response = `Таны шалтгааныг шалгалаа. ${fmtRemaining}₮ үлдэгдэл төлбөр байна. Манай ажилтан тантай холбогдоно.`
        await sendTextMessage(senderId, response, pageToken)
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: response,
        is_from_customer: false,
        is_ai_response: true,
        metadata: { type: 'partial_payment_agent', evaluation, qpay_url: qpayUrl },
      })

      // Notify staff
      await notifyStaffResolution(supabase, storeId, order.order_number, resolution, evaluation, reason)

      return { handled: true, response }
    } else {
      // Ask for more details
      updatedResolution.status = 'agent_contacted'

      await supabase
        .from('orders')
        .update({ metadata: { ...meta, partial_payment_resolution: updatedResolution } })
        .eq('id', orderId)

      const response = `Таны хариултыг ойлголоо. Нарийвчилж тайлбарлана уу — яагаад бүтэн дүнг төлөөгүй вэ?`
      await sendTextMessage(senderId, response, pageToken)

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: response,
        is_from_customer: false,
        is_ai_response: true,
        metadata: { type: 'partial_payment_agent', turn: turnCount },
      })

      return { handled: true, response }
    }
  }
}

// ---------- 3. Check if a conversation has active partial payment ----------

export async function findActivePartialPayment(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
): Promise<{ orderId: string } | null> {
  // Find orders with active partial payment resolution for this customer
  const { data: orders } = await supabase
    .from('orders')
    .select('id, metadata')
    .eq('store_id', storeId)
    .eq('customer_id', customerId)
    .eq('payment_status', 'partial')
    .order('created_at', { ascending: false })
    .limit(3)

  for (const order of (orders || [])) {
    const meta = (order.metadata ?? {}) as Record<string, unknown>
    const resolution = meta.partial_payment_resolution as PartialPaymentResolution | undefined
    if (resolution && ['agent_contacted', 'not_justified'].includes(resolution.status)) {
      return { orderId: order.id }
    }
  }

  return null
}

// ---------- 4. GPT evaluation ----------

async function evaluateCustomerReason(params: {
  orderNumber: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  driverReason: string
  customerReason: string
  orderItems: string
}): Promise<AiEvaluation> {
  const systemPrompt = `You are a payment dispute resolution agent for a Mongolian delivery business.

Given order details and a customer's reason for paying less than the full amount, evaluate whether the reason is justified.

JUSTIFIED reasons (customer should NOT be charged remaining amount):
- Product was defective/damaged
- Wrong product was delivered
- Items were missing from the order
- Product quality was significantly below expectation
- Delivery was extremely late causing real harm

NOT JUSTIFIED reasons (customer SHOULD pay remaining amount):
- Customer doesn't want to pay delivery fee (it was agreed upon)
- Customer thinks price is too high (it was agreed upon)
- Customer forgot to bring money / doesn't have money now
- Customer changed their mind about some items after receiving
- Vague or no real reason given

Return JSON with:
- justified: boolean
- category: short category name (in Mongolian, e.g., "Гэмтэлтэй бараа", "Шалтгаан тодорхойгүй")
- confidence: 0-1 how confident you are
- reasoning: 1 sentence explanation (in Mongolian)`

  const userContent = `Захиалга: #${params.orderNumber}
Бараа: ${params.orderItems || 'мэдээлэл байхгүй'}
Нийт дүн: ${params.totalAmount}₮
Төлсөн: ${params.paidAmount}₮
Үлдэгдэл: ${params.remainingAmount}₮
Жолоочийн тэмдэглэл: ${params.driverReason}
Харилцагчийн хариулт: ${params.customerReason}`

  try {
    const result = await jsonCompletion<AiEvaluation>({
      systemPrompt,
      userContent,
      maxTokens: 200,
      temperature: 0.1,
    })
    return result.data
  } catch (err) {
    console.error('[PartialPaymentAgent] GPT evaluation failed:', err)
    // Default: uncertain, escalate
    return {
      justified: false,
      category: 'Шалгах шаардлагатай',
      confidence: 0.3,
      reasoning: 'AI үнэлгээ амжилтгүй — ажилтан шалгана.',
    }
  }
}

// ---------- 5. Staff notification ----------

async function notifyStaffResolution(
  supabase: SupabaseClient,
  storeId: string,
  orderNumber: string,
  resolution: PartialPaymentResolution,
  evaluation: AiEvaluation,
  customerReason: string,
): Promise<void> {
  const fmtPaid = new Intl.NumberFormat('mn-MN').format(resolution.paid_amount)
  const fmtRemaining = new Intl.NumberFormat('mn-MN').format(resolution.remaining_amount)
  const fmtTotal = new Intl.NumberFormat('mn-MN').format(resolution.total_amount)

  const title = evaluation.justified
    ? `✅ Дутуу төлбөр — шалтгаан хүлээн авлаа`
    : `⚠️ Дутуу төлбөр — QPay нэхэмжлэл илгээлээ`

  const body = evaluation.justified
    ? `#${orderNumber}: ${evaluation.category}. ${fmtPaid}₮/${fmtTotal}₮ төлсөн. Харилцагч: "${customerReason}"`
    : `#${orderNumber}: ${fmtRemaining}₮ үлдэгдэл. QPay илгээсэн. Шалтгаан: "${customerReason}" → ${evaluation.category}`

  // Dashboard notification
  await supabase.from('notifications').insert({
    store_id: storeId,
    type: 'partial_payment_resolved',
    title,
    body,
    metadata: { order_number: orderNumber, evaluation, resolution_status: evaluation.justified ? 'justified' : 'payment_requested' },
  }).then(null, () => {})

  // Telegram notification to staff + members
  const storeBotToken = process.env.TELEGRAM_BOT_TOKEN
  if (!storeBotToken) return

  const icon = evaluation.justified ? '✅' : '⚠️'
  const tgMsg =
    `${icon} <b>ДУТУУ ТӨЛБӨР — AI ШИЙДВЭР</b>\n\n` +
    `🆔 Захиалга: #${orderNumber}\n` +
    `💰 Нийт: ${fmtTotal}₮ | Авсан: ${fmtPaid}₮ | Үлдэгдэл: ${fmtRemaining}₮\n\n` +
    `🚚 Жолоочийн тэмдэглэл: ${resolution.driver_reason}\n` +
    `👤 Харилцагчийн хариулт: ${customerReason}\n\n` +
    `🤖 AI үнэлгээ: <b>${evaluation.category}</b>\n` +
    `${evaluation.justified ? '✅ Шалтгаан хүлээн авлаа' : '❌ Шалтгаан хүлээн аваагүй — QPay нэхэмжлэл илгээсэн'}\n` +
    `📝 ${evaluation.reasoning}`

  // Get staff + member chat IDs
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
    await fetch(`https://api.telegram.org/bot${storeBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cid, text: tgMsg, parse_mode: 'HTML' }),
    }).catch(() => {})
  }
}
