/**
 * Partial Payment Resolution Agent
 *
 * When a driver reports partial payment, this agent:
 * 1. Messages the customer to ask why they paid less
 * 2. Evaluates the customer's response using GPT
 * 3. If not justified → creates QPay invoice for remaining amount
 * 4. If justified → records reason, notifies staff
 *
 * Resolution state is stored in deliveries.metadata.partial_payment_resolution
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { jsonCompletion } from '@/lib/ai/openai-client'
import { sendTextMessage, sendQuickReplies, sendButtonMessage } from '@/lib/messenger'

// Note: HUMAN_AGENT tag requires Facebook approval; sending without tag works within 24h window
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
  order_id: string | null
}

interface AiEvaluation {
  justified: boolean
  category: string
  confidence: number
  reasoning: string
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

/** Append to order notes instead of overwriting */
async function appendOrderNote(supabase: SupabaseClient, orderId: string, note: string) {
  const { data } = await supabase.from('orders').select('notes').eq('id', orderId).single()
  const existing = (data?.notes as string) || ''
  const newNotes = existing ? `${existing}\n${note}` : note
  await supabase.from('orders').update({ notes: newNotes }).eq('id', orderId)
}

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

  console.log('[PartialPaymentAgent] Starting:', { deliveryId, orderId, storeId, paidAmount, driverReason })

  // Fetch delivery info (for fee and existing metadata)
  const { data: deliveryData } = await supabase
    .from('deliveries')
    .select('delivery_fee, metadata, order_id')
    .eq('id', deliveryId)
    .single()

  const effectiveOrderId = orderId || deliveryData?.order_id
  const deliveryFee = deliveryData?.delivery_fee || 0
  const existingDeliveryMeta = (deliveryData?.metadata ?? {}) as Record<string, unknown>

  // Fetch order info if available
  let orderNumber = 'N/A'
  let orderTotal = 0
  if (effectiveOrderId) {
    const { data: order } = await supabase
      .from('orders')
      .select('order_number, total_amount')
      .eq('id', effectiveOrderId)
      .single()
    if (order) {
      orderNumber = order.order_number
      orderTotal = order.total_amount || 0
    }
  }

  const totalAmount = orderTotal + deliveryFee
  const remainingAmount = totalAmount - paidAmount

  console.log('[PartialPaymentAgent] Amounts:', { orderTotal, deliveryFee, totalAmount, paidAmount, remainingAmount })

  // Always investigate when driver explicitly reported partial payment (even if remaining=0, e.g. delivery fee dispute)

  // Fetch order items with product names
  let items: Array<{ name: string; quantity: number; price: number }> = []
  if (effectiveOrderId) {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, unit_price, products(name)')
      .eq('order_id', effectiveOrderId)

    items = (orderItems || []).map((i: Record<string, unknown>) => {
      const product = i.products as Record<string, unknown> | null
      return {
        name: (product?.name as string) || 'Бараа',
        quantity: i.quantity as number,
        price: i.unit_price as number,
      }
    })
  }

  // Save resolution state in delivery metadata
  const resolution: PartialPaymentResolution = {
    status: 'agent_contacted',
    paid_amount: paidAmount,
    remaining_amount: Math.max(0, remainingAmount),
    total_amount: totalAmount,
    driver_reason: driverReason,
    customer_reason: null,
    ai_evaluation: null,
    qpay_invoice_id: null,
    qpay_short_url: null,
    contacted_at: new Date().toISOString(),
    resolved_at: null,
    turn_count: 0,
    order_id: effectiveOrderId,
  }

  await supabase
    .from('deliveries')
    .update({ metadata: { ...existingDeliveryMeta, partial_payment_resolution: resolution } })
    .eq('id', deliveryId)

  // Find the customer — try order's customer_id first, then phone/name
  let customerId: string | null = null
  let messengerId: string | null = null
  let instagramId: string | null = null
  let custPhone = customerPhone

  // Try 1: order's customer_id
  if (effectiveOrderId) {
    const { data: orderCust } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', effectiveOrderId)
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

  // Try 2: lookup by phone
  if (!customerId && customerPhone) {
    const { data: c } = await supabase
      .from('customers')
      .select('id, messenger_id, instagram_id, channel, phone')
      .eq('store_id', storeId)
      .eq('phone', customerPhone)
      .limit(1)
      .maybeSingle()
    if (c) {
      customerId = c.id
      messengerId = c.messenger_id
      instagramId = c.instagram_id
      custPhone = c.phone || customerPhone
    }
  }

  // Try 3: lookup by name
  if (!customerId && customerName) {
    const { data: c } = await supabase
      .from('customers')
      .select('id, messenger_id, instagram_id, channel, phone')
      .eq('store_id', storeId)
      .eq('name', customerName)
      .limit(1)
      .maybeSingle()
    if (c) {
      customerId = c.id
      messengerId = c.messenger_id
      instagramId = c.instagram_id
      custPhone = c.phone || customerPhone
    }
  }

  console.log('[PartialPaymentAgent] Customer lookup:', { customerId, messengerId, instagramId, custPhone })

  // Get store page token
  const { data: store } = await supabase
    .from('stores')
    .select('facebook_page_access_token')
    .eq('id', storeId)
    .single()

  const pageToken = store?.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN

  const fmtDeliveryFee = deliveryFee > 0 ? new Intl.NumberFormat('mn-MN').format(deliveryFee) : null
  const fmtTotal = new Intl.NumberFormat('mn-MN').format(totalAmount)
  const fmtPaid = new Intl.NumberFormat('mn-MN').format(paidAmount)
  const fmtRemaining = new Intl.NumberFormat('mn-MN').format(Math.max(0, remainingAmount))

  const itemsList = items.map(i => `  • ${i.name} x${i.quantity} — ${new Intl.NumberFormat('mn-MN').format(i.price)}₮`).join('\n')
  const itemsOneLine = items.map(i => `${i.name} x${i.quantity} (${i.price}₮)`).join(', ')

  // Fetch chat history to generate a contextual initial message
  let chatHistory = ''
  if (customerId) {
    try {
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
        const { data: msgs } = await supabase
          .from('messages')
          .select('content, is_from_customer, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (msgs && msgs.length > 0) {
          chatHistory = (msgs as Array<{ content: string; is_from_customer: boolean }>)
            .reverse()
            .map(m => `[${m.is_from_customer ? 'Харилцагч' : 'Дэлгүүр'}]: ${m.content}`)
            .join('\n')
        }
      }
    } catch { /* ignore */ }
  }

  // Generate AI message based on context
  let message: string
  try {
    const aiResult = await jsonCompletion<{ message: string }>({
      systemPrompt: `You are a store assistant messaging a customer on Facebook Messenger after delivery. The customer paid less than the total amount.

Your job: analyze the order details, driver's note, and chat history to understand WHY the customer underpaid, then write a smart contextual message.

EXAMPLES of what to do:
- If remaining = delivery fee and driver said "hurgelt unegui": explain delivery fee applies, politely ask them to pay it via link (or say we'll send payment link)
- If remaining is large and items match: ask what was wrong with the product
- If chat history shows a price was agreed: reference that agreement

RULES:
- Write in Mongolian, natural human tone (like texting a customer)
- 2-4 sentences max
- Be specific — mention the actual amount, reference what they ordered if relevant
- If you can tell from context WHY they underpaid (e.g. delivery fee dispute), address it directly instead of asking
- If chat history has relevant context, reference it
- Return JSON: {"message": "your message here"}`,
      userContent: `Харилцагч: ${customerName || 'Харилцагч'}
Захиалга: #${orderNumber}
Бараа: ${itemsOneLine || 'мэдээлэл байхгүй'}
Хүргэлтийн төлбөр: ${fmtDeliveryFee || '0'}₮
Нийт дүн: ${fmtTotal}₮
Жолоочид төлсөн: ${fmtPaid}₮
Үлдэгдэл: ${fmtRemaining}₮
Жолоочийн тэмдэглэл: "${driverReason}"
${chatHistory ? `\n--- ЧАТ ТҮҮХ ---\n${chatHistory}` : '(чат түүх байхгүй)'}`,
      maxTokens: 300,
      temperature: 0.3,
    })
    message = aiResult.data.message
  } catch (err) {
    console.error('[PartialPaymentAgent] AI message generation failed:', err)
    // Fallback to template
    message = `Сайн байна уу${customerName ? `, ${customerName}` : ''}!\n\n` +
      `Таны #${orderNumber} захиалга:\n${itemsList || '  (бараа мэдээлэл олдсонгүй)'}\n` +
      (fmtDeliveryFee ? `  • Хүргэлтийн төлбөр: ${fmtDeliveryFee}₮\n` : '') +
      `\nНийт дүн: ${fmtTotal}₮\nЖолоочид төлсөн: ${fmtPaid}₮\n` +
      (remainingAmount > 0 ? `Үлдэгдэл: ${fmtRemaining}₮\n` : '') +
      `\nЖолоочийн тэмдэглэл: "${driverReason}"\n\nЭнэ талаар тайлбар өгнө үү?`
  }

  let messageSent = false

  // Try Messenger first
  const senderId = messengerId || instagramId
  if (senderId && pageToken) {
    try {
      console.log('[PartialPaymentAgent] Sending Messenger to:', senderId)
      // Send with quick replies (works within 24h of customer's last message)
      const res = await sendQuickReplies(senderId, message, QUICK_REPLIES, pageToken)
      if (res) {
        messageSent = true
        console.log('[PartialPaymentAgent] Sent via Messenger to', senderId, 'result:', res)

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
              metadata: { type: 'partial_payment_agent', delivery_id: deliveryId, order_id: effectiveOrderId },
            })
            // Bump conversation so it appears at top of chat list
            await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv.id)
          }
        }
      } else {
        console.log('[PartialPaymentAgent] Messenger sendQuickReplies returned null')
      }
    } catch (err) {
      console.error('[PartialPaymentAgent] Messenger send failed:', err)
    }
  } else {
    console.log('[PartialPaymentAgent] No Messenger channel:', { senderId: !!senderId, pageToken: !!pageToken })
  }

  // Fallback to SMS
  if (!messageSent && custPhone) {
    const smsMsg = remainingAmount > 0
      ? `Таны #${orderNumber} захиалгын ${fmtRemaining}₮ үлдэгдэл байна. Шалтгааныг тодруулахыг хүсье.`
      : `Таны #${orderNumber} захиалгын төлбөрийн талаар тодруулахыг хүсье. Жолоочийн тэмдэглэл: "${driverReason}"`
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
      .from('deliveries')
      .update({
        metadata: {
          ...existingDeliveryMeta,
          partial_payment_resolution: { ...resolution, status: 'escalated' },
        },
      })
      .eq('id', deliveryId)
  }
}

// ---------- 2. Handle customer reply — called from Messenger webhook ----------

export async function handlePartialPaymentReply(params: {
  supabase: SupabaseClient
  deliveryId: string
  storeId: string
  customerId: string
  customerMessage: string
  quickReplyPayload?: string | null
  senderId: string
  pageToken: string
  conversationId: string
}): Promise<{ handled: boolean; response?: string }> {
  const { supabase, deliveryId, storeId, customerId, customerMessage, quickReplyPayload, senderId, pageToken, conversationId } = params

  const { data: deliveryData } = await supabase
    .from('deliveries')
    .select('id, metadata, order_id')
    .eq('id', deliveryId)
    .single()

  if (!deliveryData) return { handled: false }

  const meta = (deliveryData.metadata ?? {}) as Record<string, unknown>
  const resolution = meta.partial_payment_resolution as PartialPaymentResolution | undefined
  if (!resolution || resolution.status === 'resolved' || resolution.status === 'escalated') {
    return { handled: false }
  }

  const orderId = resolution.order_id || deliveryData.order_id

  // Get order number for messages
  let orderNumber = 'N/A'
  if (orderId) {
    const { data: order } = await supabase.from('orders').select('order_number').eq('id', orderId).single()
    if (order) orderNumber = order.order_number
  }

  // Map quick reply to reason
  let reason = customerMessage
  if (quickReplyPayload === 'PP_DEFECTIVE') reason = 'Бараа гэмтэлтэй байсан'
  else if (quickReplyPayload === 'PP_WRONG_ITEM') reason = 'Буруу бараа ирсэн'
  else if (quickReplyPayload === 'PP_MISSING') reason = 'Захиалгын бараа дутуу'
  else if (quickReplyPayload === 'PP_OTHER') reason = customerMessage

  // Fetch order items for AI context
  let itemsList = ''
  if (orderId) {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, unit_price, products(name)')
      .eq('order_id', orderId)

    itemsList = (orderItems || [])
      .map((i: Record<string, unknown>) => {
        const product = i.products as Record<string, unknown> | null
        const name = (product?.name as string) || 'Бараа'
        return `${name} x${i.quantity} (${i.unit_price}₮)`
      })
      .join(', ')
  }

  // Fetch chat history for context
  let chatHistory = ''
  try {
    const { data: msgs } = await supabase
      .from('messages')
      .select('content, is_from_customer, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (msgs && msgs.length > 0) {
      chatHistory = (msgs as Array<{ content: string; is_from_customer: boolean; created_at: string }>)
        .reverse()
        .map(m => `[${m.is_from_customer ? 'Харилцагч' : 'Дэлгүүр'}]: ${m.content}`)
        .join('\n')
    }
  } catch { /* ignore */ }

  // Evaluate with GPT
  const evaluation = await evaluateCustomerReason({
    orderNumber,
    totalAmount: resolution.total_amount,
    paidAmount: resolution.paid_amount,
    remainingAmount: resolution.remaining_amount,
    driverReason: resolution.driver_reason,
    customerReason: reason,
    orderItems: itemsList,
    chatHistory,
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
      .from('deliveries')
      .update({ metadata: { ...meta, partial_payment_resolution: updatedResolution } })
      .eq('id', deliveryId)

    const response = `Таны шалтгааныг хүлээн авлаа.\n\n${evaluation.reasoning}\n\nМанай ажилтан тантай холбогдоно. Баярлалаа!`

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: response,
      is_from_customer: false,
      is_ai_response: true,
      metadata: { type: 'partial_payment_agent', evaluation },
    })
    // Bump conversation
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

    await sendTextMessage(senderId, response, pageToken)
    await notifyStaffResolution(supabase, storeId, orderNumber, updatedResolution, evaluation, reason)

    // Update order notes with resolution
    if (orderId) {
      const fmtPaid = new Intl.NumberFormat('mn-MN').format(resolution.paid_amount)
      await appendOrderNote(supabase, orderId, `AI шийдвэр: ✅ ${evaluation.category}. ${fmtPaid}₮ авсан. Шалтгаан: ${reason}`)
    }

    return { handled: true, response }
  } else {
    // Not justified — request payment
    if (turnCount >= MAX_TURNS || evaluation.confidence > 0.7) {
      updatedResolution.status = 'payment_requested'

      let qpayUrl = ''
      if (resolution.remaining_amount > 0) {
        try {
          const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel-app.vercel.app'}/api/qpay/callback`
          const invoice = await createQPayInvoice({
            orderNumber: `${orderNumber}-REM`,
            amount: resolution.remaining_amount,
            description: `#${orderNumber} үлдэгдэл төлбөр`,
            callbackUrl,
          })
          updatedResolution.qpay_invoice_id = invoice.invoice_id
          updatedResolution.qpay_short_url = invoice.qPay_shortUrl
          qpayUrl = invoice.qPay_shortUrl
        } catch (qpayErr) {
          console.error('[PartialPaymentAgent] QPay invoice failed:', qpayErr)
        }
      }

      await supabase
        .from('deliveries')
        .update({ metadata: { ...meta, partial_payment_resolution: updatedResolution } })
        .eq('id', deliveryId)

      const fmtRemaining = new Intl.NumberFormat('mn-MN').format(resolution.remaining_amount)
      let response: string

      if (qpayUrl) {
        response = `${evaluation.reasoning}\n\n${fmtRemaining}₮ үлдэгдэл төлбөрийг төлнө үү:`
        await sendButtonMessage(senderId, response, [{ title: `${fmtRemaining}₮ төлөх`, url: qpayUrl }], pageToken)
      } else {
        response = resolution.remaining_amount > 0
          ? `${evaluation.reasoning}\n\n${fmtRemaining}₮ үлдэгдэл төлбөр байна. Манай ажилтан тантай холбогдоно.`
          : `${evaluation.reasoning}\n\nМанай ажилтан тантай холбогдоно.`
        await sendTextMessage(senderId, response, pageToken)
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: response,
        is_from_customer: false,
        is_ai_response: true,
        metadata: { type: 'partial_payment_agent', evaluation, qpay_url: qpayUrl },
      })
      // Bump conversation
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

      await notifyStaffResolution(supabase, storeId, orderNumber, updatedResolution, evaluation, reason)

      // Update order notes
      if (orderId) {
        const fmtPaid = new Intl.NumberFormat('mn-MN').format(resolution.paid_amount)
        await appendOrderNote(supabase, orderId, `AI шийдвэр: ❌ ${evaluation.category}. ${fmtPaid}₮/${new Intl.NumberFormat('mn-MN').format(resolution.total_amount)}₮. QPay илгээсэн.`)
      }

      return { handled: true, response }
    } else {
      // Ask for more details
      updatedResolution.status = 'agent_contacted'

      await supabase
        .from('deliveries')
        .update({ metadata: { ...meta, partial_payment_resolution: updatedResolution } })
        .eq('id', deliveryId)

      const response = `Таны хариултыг ойлголоо. Нарийвчилж тайлбарлана уу — яагаад бүтэн дүнг төлөөгүй вэ?`
      await sendTextMessage(senderId, response, pageToken)

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        content: response,
        is_from_customer: false,
        is_ai_response: true,
        metadata: { type: 'partial_payment_agent', turn: turnCount },
      })
      // Bump conversation so it appears at top of chat list
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

      return { handled: true, response }
    }
  }
}

// ---------- 3. Check if a conversation has active partial payment ----------

export async function findActivePartialPayment(
  supabase: SupabaseClient,
  customerId: string,
  storeId: string,
): Promise<{ deliveryId: string; orderId: string | null } | null> {
  // Find deliveries with active partial payment resolution for this customer's orders
  // First get order IDs for this customer
  const { data: customerOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('store_id', storeId)
    .eq('customer_id', customerId)
    .eq('payment_status', 'partial')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!customerOrders?.length) return null

  const orderIds = customerOrders.map(o => o.id)

  // Find deliveries for these orders that have active resolution
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('id, order_id, metadata')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
    .limit(10)

  for (const del of (deliveries || [])) {
    const meta = (del.metadata ?? {}) as Record<string, unknown>
    const resolution = meta.partial_payment_resolution as PartialPaymentResolution | undefined
    if (resolution && ['agent_contacted', 'not_justified'].includes(resolution.status)) {
      return { deliveryId: del.id, orderId: del.order_id }
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
  chatHistory?: string
}): Promise<AiEvaluation> {
  const systemPrompt = `You are a payment dispute resolution agent for a Mongolian delivery business.

Given order details, chat history, and a customer's reason for paying less than the full amount, evaluate whether the reason is justified.

Use the CHAT HISTORY to understand context:
- What products the customer originally asked for
- What prices were discussed and agreed upon
- Whether delivery fee was mentioned and agreed
- Any complaints or issues raised before delivery

JUSTIFIED reasons (customer should NOT be charged remaining amount):
- Product was defective/damaged
- Wrong product was delivered
- Items were missing from the order
- Product quality was significantly below expectation
- Delivery was extremely late causing real harm
- Price was different from what was agreed in chat

NOT JUSTIFIED reasons (customer SHOULD pay remaining amount):
- Customer doesn't want to pay delivery fee (if it was agreed upon in chat)
- Customer thinks price is too high (if it was agreed upon in chat)
- Customer forgot to bring money / doesn't have money now
- Customer changed their mind about some items after receiving
- Vague or no real reason given

Return JSON with:
- justified: boolean
- category: short category name (in Mongolian, e.g., "Гэмтэлтэй бараа", "Шалтгаан тодорхойгүй")
- confidence: 0-1 how confident you are
- reasoning: 2-3 sentence explanation (in Mongolian) referencing chat history if relevant`

  const userContent = `Захиалга: #${params.orderNumber}
Бараа: ${params.orderItems || 'мэдээлэл байхгүй'}
Нийт дүн: ${params.totalAmount}₮
Төлсөн: ${params.paidAmount}₮
Үлдэгдэл: ${params.remainingAmount}₮
Жолоочийн тэмдэглэл: ${params.driverReason}
Харилцагчийн хариулт: ${params.customerReason}
${params.chatHistory ? `\n--- ЧАТ ТҮҮХ ---\n${params.chatHistory}` : ''}`

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
    }).catch(err => console.error("[silent-catch]", err))
  }
}
