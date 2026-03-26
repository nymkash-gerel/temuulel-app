/**
 * OrderCollectionAgent — Multi-step order state machine.
 *
 * Handles the order collection flow: variant -> name -> address -> phone -> confirming.
 * Extracted from processAIChat lines 160-316 + helper functions.
 *
 * This agent manages the most complex conversation flow in the system,
 * collecting order details step-by-step and creating the final order.
 *
 * All 13 helper functions + the full switch/case state machine are included.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentContext, AgentResult, TriageResult } from './types'
import { emptyResult } from './types'
import { getDraftItems, getDraftTotal, type OrderDraft, type CartItem, type StoredProduct } from '@/lib/conversation-state'
import { normalizeText, formatPrice, searchProducts } from '@/lib/chat-ai'
import { calculateDeliveryFee } from '@/lib/delivery-fee-calculator'
import { dispatchNotification } from '@/lib/notifications'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DELIVERY_FEE = 5000

/** Order intent — prefix stems + exact words for Mongolian verb forms */
const ORDER_WORD_STEMS = ['захиал', 'авъ', 'авь', 'авя']  // авяа/avyaa included via авя
const ORDER_EXACT_WORDS = ['авна', 'авах', 'авйа', 'ави', 'авмаар', 'авуу', 'авуй']

/** Address keywords that must be present for a message to be considered an address */
const ADDRESS_KEYWORDS = [
  // ── Cyrillic ────────────────────────────────────────────────────────────
  'дүүрэг', 'хороо', 'байр', 'тоот', 'гудамж', 'хороолол', 'дэнж',
  'өргөн чөлөө', 'нутгийн', 'баянгол', 'сүхбаатар', 'чингэлтэй',
  'хан-уул', 'баянзүрх', 'сонгинохайрхан', 'налайх', 'багануур',
  'багахангай', 'орон сууц', 'гэр хороолол', 'сум', 'аймаг',
  // ── Latin transliterations (very common in Messenger / web widget) ─────
  'horoo', 'khoroo', 'bair', 'toot', 'duureg', 'gudamj', 'khoroolol',
  // District abbreviations
  'bzd',  // Баянзүрх дүүрэг
  'bbd',  // Баянгол дүүрэг
  'sbd',  // Сүхбаатар дүүрэг
  'chd',  // Чингэлтэй дүүрэг
  'sgd',  // Сонгинохайрхан дүүрэг
  'hhd',  // Хан-Уул дүүрэг
  // District names in Latin
  'bayanzurkh', 'bayangol', 'sukhbaatar', 'chingeltei',
  'songino', 'khan-uul', 'han-uul', 'nalaikha',
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VariantRow {
  id: string
  size: string | null
  color: string | null
  price: number | null
  stock_quantity: number | null
}

/** Order step types matching the conversation state machine. */
export type OrderStep = 'variant' | 'info' | 'name' | 'address' | 'phone' | 'confirming'

// ---------------------------------------------------------------------------
// Helper functions (13 total)
// ---------------------------------------------------------------------------

/** 1. Detect affirmative responses: тийм, за, ok */
function isAffirmative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['тийм', 'за', 'зүгээр', 'болно', 'тийм ээ', 'зөв', 'ok', 'ок', 'yes', 'tiim', 'tiim ee', 'za', 'bolno']
  return words.some((w) => {
    const nw = normalizeText(w)
    return n === nw || n.startsWith(nw + ' ')
  })
}

/** 2. Detect negative responses: үгүй, болихгүй, цуцлах */
function isNegative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['үгүй', 'болихгүй', 'цуцлах', 'цуцал', 'хүсэхгүй', 'нет', 'no', 'ugui', 'bolihgui']
  return words.some((w) => {
    const nw = normalizeText(w)
    return n === nw || n.startsWith(nw + ' ')
  })
}

/** 3. Extract 8-digit phone number from message */
function extractPhone(msg: string): string | null {
  // Match standalone 8-digit number (not adjacent to other digits).
  // Don't strip whitespace first — that merges address numbers with phone,
  // e.g. "36a 96 91250305" → "9691250305" → wrong phone "96912503".
  const standalone = msg.match(/(?<!\d)\d{8}(?!\d)/)
  if (standalone) return standalone[0]

  // Fallback: phone with spaces between groups, e.g. "9125 0305" or "91 25 03 05"
  const spaced = msg.match(/(?<!\d)(\d{2,4}[\s-]\d{2,4}[\s-]?\d{0,4})(?!\d)/)
  if (spaced) {
    const digits = spaced[1].replace(/[\s-]/g, '')
    if (digits.length === 8) return digits
  }

  return null
}

/** 4. Extract address from a message. Removes phone number if found. */
function extractAddress(msg: string, phone: string | null): string | null {
  let text = msg.trim()
  // Remove phone digits from text
  if (phone) {
    text = text.replace(new RegExp(phone.split('').join('\\s*')), '').trim()
  }
  // Remove common prefixes like "утас:", "утас нь", "дугаар:"
  text = text.replace(/утас\s*(нь|:)?\s*/gi, '').replace(/дугаар\s*:?\s*/gi, '').trim()
  // Clean up punctuation at edges
  text = text.replace(/^[,;:\s]+|[,;:\s]+$/g, '').trim()
  // Must contain at least one address keyword AND be substantial (10+ chars)
  const lower = text.toLowerCase()
  const hasAddressKeyword = ADDRESS_KEYWORDS.some(kw => lower.includes(kw))
  return (text.length >= 10 && hasAddressKeyword) ? text : null
}

/**
 * 5. Parse multiple number selections from a message.
 * "1 болон 5" -> [1, 5], "1, 5" -> [1, 5], "1-3" -> [1, 2, 3], "1 5" -> [1, 5]
 */
function parseMultiSelect(msg: string): number[] {
  const normalized = normalizeText(msg).trim()
  // Remove common connectors
  const cleaned = normalized.replace(/болон|ба|бас|ба\s+бас|,/gi, ' ')

  const numbers: number[] = []
  // Match ranges like "1-3"
  const rangeMatch = cleaned.match(/(\d+)\s*-\s*(\d+)/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10)
    const end = parseInt(rangeMatch[2], 10)
    if (start <= end && end - start < 20) {
      for (let i = start; i <= end; i++) numbers.push(i)
      return numbers
    }
  }

  // Match individual numbers
  const numMatches = cleaned.match(/\d+/g)
  if (numMatches) {
    for (const n of numMatches) {
      const num = parseInt(n, 10)
      if (num > 0 && num <= 100 && !numbers.includes(num)) numbers.push(num)
    }
  }
  return numbers
}

/**
 * 6. Resolve multiple variants from message — for multi-select.
 * Returns array of matched variants (may be 0, 1, or many).
 */
function resolveVariantsFromMessage(msg: string, variants: VariantRow[]): VariantRow[] {
  if (variants.length === 0) return []

  const selections = parseMultiSelect(msg)
  if (selections.length > 1) {
    // Multi-select by number
    const results: VariantRow[] = []
    for (const num of selections) {
      const idx = num - 1
      if (idx >= 0 && idx < variants.length) results.push(variants[idx])
    }
    return results
  }

  // Fallback to single-select
  const single = resolveVariantFromMessage(msg, variants)
  return single ? [single] : []
}

/** 7. Resolve a single variant from message text */
function resolveVariantFromMessage(msg: string, variants: VariantRow[]): VariantRow | null {
  if (variants.length === 0) return null
  const normalized = normalizeText(msg).trim()

  // Number selection: "1", "2"
  const numMatch = normalized.match(/^(\d+)/)
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1
    if (idx >= 0 && idx < variants.length) return variants[idx]
  }

  // Size/color keyword match — prefer both matching over either alone
  const words = normalized.split(/\s+/)
  // Size must match a whole word (prevents "L" matching inside "XL" / "2XL")
  const msgMatchesSize = (v: VariantRow) => !!v.size && words.includes(normalizeText(v.size))
  const msgMatchesColor = (v: VariantRow) => !!v.color && normalized.includes(normalizeText(v.color))

  // 1. Best: variant where both size AND color appear in message
  const bothMatch = variants.find(v => msgMatchesSize(v) && msgMatchesColor(v))
  if (bothMatch) return bothMatch

  // 2. Size-only match (e.g. "L авна" when no color mentioned)
  const sizeOnly = variants.find(v => msgMatchesSize(v))
  if (sizeOnly) return sizeOnly

  // 3. Color-only match
  const colorOnly = variants.find(v => msgMatchesColor(v))
  if (colorOnly) return colorOnly

  // Fuzzy color match: "цаганас" contains "цагаан" prefix
  for (const v of variants) {
    if (v.color) {
      const normColor = normalizeText(v.color)
      // Check if any word in the message starts with the color name (3+ chars)
      if (normColor.length >= 3) {
        if (words.some((w) => w.startsWith(normColor) || normColor.startsWith(w) && w.length >= 3)) {
          return v
        }
      }
    }
  }

  return null
}

/**
 * 8. Build a summary message showing ALL order details before confirmation.
 * Supports multi-item cart.
 */
function buildOrderSummary(draft: OrderDraft): string {
  const items = getDraftItems(draft)
  const productTotal = getDraftTotal(draft)
  const feeResult = draft.address ? calculateDeliveryFee(draft.address) : null
  const isIntercity = feeResult?.type === 'intercity'
  const deliveryFee = isIntercity ? 0 : (feeResult?.fee ?? DEFAULT_DELIVERY_FEE)
  const grandTotal = productTotal + deliveryFee

  const lines = ['📋 Захиалгын мэдээлэл:\n']

  if (items.length > 1) {
    lines.push('🛒 Сагс:')
    items.forEach((item, i) => {
      const label = item.variant_label ? ` (${item.variant_label})` : ''
      lines.push(`  ${i + 1}. ${item.product_name}${label} x${item.quantity} — ${formatPrice(item.unit_price * item.quantity)}`)
    })
    lines.push(`\n💰 Бараа: ${formatPrice(productTotal)}`)
  } else if (items.length === 1) {
    const item = items[0]
    lines.push(`📦 ${item.product_name}`)
    if (item.variant_label) lines.push(`   Хувилбар: ${item.variant_label}`)
    lines.push(`   Тоо: ${item.quantity} ширхэг`)
    lines.push(`   💰 Бараа: ${formatPrice(productTotal)}`)
  }

  if (isIntercity) {
    lines.push(`🚌 Хүргэлт: Автобус / шуудан`)
    lines.push(`   ⚠️ Тээврийн үнэ хүлээн авахдаа төлнө (жин, хэмжээнээс хамаарна)`)
    lines.push(`💰 Нийт (барааны үнэ): ${formatPrice(grandTotal)}`)
  } else {
    lines.push(`🚚 Хүргэлт: ${formatPrice(deliveryFee)}`)
    lines.push(`💰 Нийт: ${formatPrice(grandTotal)}`)
  }

  if (draft.address) lines.push(`📍 Хаяг: ${draft.address}`)
  if (draft.phone) lines.push(`📱 Утас: ${draft.phone}`)
  lines.push('\nЗахиалгаа баталгаажуулах уу? (Тийм/Үгүй)')
  return lines.join('\n')
}

/**
 * 9. Build a message asking for missing info (address and/or phone).
 */
function buildInfoRequest(draft: OrderDraft): string {
  const items = getDraftItems(draft)
  const missing: string[] = []
  if (!draft.address) missing.push('хүргэлтийн хаяг (дүүрэг, хороо, байр, тоот)')
  if (!draft.phone) missing.push('утасны дугаар (8 оронтой)')

  let header: string
  if (items.length > 1) {
    header = `🛒 ${items.length} бараа сагсанд`
  } else {
    const item = items[0]
    header = `📦 ${item?.product_name || draft.product_name}${item?.variant_label ? ` (${item.variant_label})` : ''} — ${formatPrice(item?.unit_price || draft.unit_price || 0)}`
  }
  return `${header}\n\nЗахиалга үүсгэхийн тулд дараах мэдээлэл хэрэгтэй:\n• ${missing.join('\n• ')}\n\nБичнэ үү:`
}

/**
 * 10. Start a new order draft for a product. Fetches variants and resolves
 * any variant/address/phone info from the customer message.
 * If customer has order history, pre-fills name/address/phone and skips to confirming.
 */
async function startOrderDraft(
  supabase: SupabaseClient,
  product: StoredProduct,
  customerMessage: string,
  storeId?: string,
  customerId?: string | null,
): Promise<{ draft: OrderDraft; responseText: string }> {
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, size, color, price, stock_quantity')
    .eq('product_id', product.id)
    .gt('stock_quantity', 0)

  const inStock = variants ?? []

  let draft: OrderDraft

  if (inStock.length > 1) {
    // Try to auto-select variant(s) from message
    const preselectedMulti = resolveVariantsFromMessage(customerMessage, inStock)
    if (preselectedMulti.length > 0) {
      const items: CartItem[] = preselectedMulti.map(v => ({
        product_id: product.id,
        product_name: product.name,
        variant_id: v.id,
        variant_label: [v.size, v.color].filter(Boolean).join('/'),
        unit_price: v.price ?? product.base_price,
        quantity: 1,
      }))
      draft = {
        items,
        product_id: product.id,
        product_name: product.name,
        variant_id: items[0].variant_id,
        variant_label: items[0].variant_label,
        unit_price: items[0].unit_price,
        quantity: 1,
        step: 'name',
      }
    } else {
      draft = {
        items: [{ product_id: product.id, product_name: product.name, unit_price: product.base_price, quantity: 1 }],
        product_id: product.id,
        product_name: product.name,
        unit_price: product.base_price,
        quantity: 1,
        step: 'variant',
      }
      const variantList = inStock.map((v, i) => {
        const parts: string[] = []
        if (v.size) parts.push(v.size)
        if (v.color) parts.push(v.color)
        parts.push(formatPrice(v.price ?? product.base_price))
        return `${i + 1}. ${parts.join(' / ')}`
      }).join('\n')
      return {
        draft,
        responseText: `📦 ${product.name} захиалга\n\nАль хувилбарыг сонгох вэ?\n${variantList}\n\nОлон сонголт: "1 болон 5" гэх мэтээр бичнэ үү:`,
      }
    }
  } else {
    // 0 or 1 variant — auto-select
    const variant = inStock[0]
    const label = variant ? [variant.size, variant.color].filter(Boolean).join('/') : undefined
    const item: CartItem = {
      product_id: product.id,
      product_name: product.name,
      variant_id: variant?.id,
      variant_label: label || undefined,
      unit_price: variant?.price ?? product.base_price,
      quantity: 1,
    }
    draft = {
      items: [item],
      product_id: product.id,
      product_name: product.name,
      variant_id: variant?.id,
      variant_label: label || undefined,
      unit_price: variant?.price ?? product.base_price,
      quantity: 1,
      step: 'name',
    }
  }

  // Check customer history — if returning customer, pre-fill and skip to confirming
  if (storeId && customerId) {
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('shipping_address, notes')
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .not('shipping_address', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', customerId)
      .single()

    if (lastOrder?.shipping_address && customer?.name && customer?.phone) {
      // Returning customer — offer to use previous info
      draft.customer_name = customer.name
      draft.address = lastOrder.shipping_address
      draft.phone = customer.phone
      draft.step = 'confirming'
      const draftItems = getDraftItems(draft)
      const itemsSummary = draftItems.length > 1
        ? `🛒 ${draftItems.length} бараа — ${formatPrice(getDraftTotal(draft))}`
        : `📦 ${product.name} — ${formatPrice(draftItems[0]?.unit_price || draft.unit_price || 0)}`
      return {
        draft,
        responseText: `${itemsSummary}\n\n` +
          `Өмнөх мэдээллээр захиалах уу?\n` +
          `👤 ${customer.name}\n📍 ${lastOrder.shipping_address}\n📱 ${customer.phone}\n\n` +
          `Тийм бол "Тийм", өөрчлөх бол шинэ мэдээллээ бичнэ үү.`,
      }
    }
  }

  // New customer — start with name collection
  const startItems = getDraftItems(draft)
  const startSummary = startItems.length > 1
    ? `🛒 ${startItems.length} бараа — ${formatPrice(getDraftTotal(draft))}`
    : `📦 ${product.name} — ${formatPrice(startItems[0]?.unit_price || draft.unit_price || 0)}`
  return { draft, responseText: `${startSummary}\n\nНэрээ бичнэ үү:` }
}

/**
 * 11. Create order from chat — inserts into orders + order_items + deliveries tables
 * and dispatches notification.
 */
async function createOrderFromChat(
  supabase: SupabaseClient,
  storeId: string,
  customerId: string | null,
  draft: OrderDraft
): Promise<{ order_number: string; total_amount: number; delivery_fee: number } | null> {
  const orderNumber = `ORD-${Date.now()}`
  const items = getDraftItems(draft)
  const productTotal = getDraftTotal(draft)

  // Calculate delivery fee from address
  const feeResult = draft.address ? calculateDeliveryFee(draft.address) : null
  const isIntercity = feeResult?.type === 'intercity'
  const deliveryFee = isIntercity ? 0 : (feeResult?.fee ?? DEFAULT_DELIVERY_FEE)
  const totalAmount = productTotal + deliveryFee

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: storeId,
      customer_id: customerId || null,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      shipping_amount: deliveryFee,
      payment_status: 'pending',
      shipping_address: draft.address || null,
      order_type: 'delivery',
      notes: isIntercity
        ? `Messenger захиалга | Утас: ${draft.phone || ''} | Автобус/шуудангаар хүргэх`
        : `Messenger захиалга | Утас: ${draft.phone || ''}`,
    })
    .select('id, order_number, total_amount')
    .single()

  if (orderError || !newOrder) {
    console.error('[Order] Failed to create:', orderError)
    return null
  }

  // Create order item + delivery record in parallel
  const deliveryNumber = `DEL-${Date.now()}`

  // Use customer name from draft (collected during order flow), fallback to DB
  let customerName: string | null = draft.customer_name || null
  if (!customerName && customerId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single()
    customerName = cust?.name ?? null
  }

  // Insert all cart items as order_items
  const orderItemRows = items.map(item => ({
    order_id: newOrder.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    variant_label: item.variant_label || null,
  }))

  await Promise.all([
    supabase.from('order_items').insert(orderItemRows),
    supabase.from('deliveries').insert({
      store_id: storeId,
      order_id: newOrder.id,
      delivery_number: deliveryNumber,
      status: 'pending',
      delivery_type: isIntercity ? 'intercity_post' : 'own_driver',
      delivery_address: draft.address || 'Хаяг тодорхойгүй',
      customer_name: customerName,
      customer_phone: draft.phone || null,
      delivery_fee: deliveryFee,
    }),
  ])

  dispatchNotification(storeId, 'new_order', {
    order_id: newOrder.id,
    order_number: newOrder.order_number,
    total_amount: newOrder.total_amount,
    payment_method: null,
  })

  return { order_number: newOrder.order_number, total_amount: totalAmount, delivery_fee: deliveryFee }
}

/** 12. Detect if the user is asking a question about a product mid-order */
function isProductQuestion(msg: string): boolean {
  const n = normalizeText(msg).toLowerCase()
  const questionWords = ['ямар', 'юу', 'ямар өнгө', 'өнгө', 'хэдэн', 'яагаад', 'хэрхэн', 'байна уу', 'bn', 'bnu', 'baina uu',
    'харуул', 'үзүүл', 'харуулна уу', 'үзүүлнэ үү']  // imperative photo/info requests
  const productInfoWords = ['өнгө', 'унгу', 'хэмжээ', 'размер', 'хувилбар', 'нөөц', 'байна', 'бн', 'bn', 'ungu', 'size', 'color', 'variant', 'stock', 'ямар',
    'зураг', 'фото', 'photo', 'pic', 'зургаа', 'zurag', 'зургийг',  // photo/image
    'материал', 'чанар', 'дэлгэрэнгүй']                              // detail requests
  const hasQuestion = questionWords.some(w => n.includes(w)) || msg.includes('?')
  const hasProductTopic = productInfoWords.some(w => n.includes(w))
  return hasQuestion && hasProductTopic
}

/** 13. Detect order intent in message */
function hasOrderIntent(msg: string): boolean {
  const words = normalizeText(msg).trim().split(/\s+/)
  // Mongolian negation suffixes: -гүй, -хгүй, -аагүй, etc. mean "did NOT"
  const NEGATION_SUFFIXES = ['гүй', 'хгүй', 'ахгүй', 'охгүй', 'ээгүй', 'оогүй', 'аагүй']
  return words.some((w) => {
    // Skip negated words: захиалаагүй = did NOT order, авахгүй = will NOT buy
    if (NEGATION_SUFFIXES.some((neg) => w.endsWith(neg))) return false
    return ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
      || ORDER_EXACT_WORDS.some((ew) => w === normalizeText(ew))
  })
}

// ---------------------------------------------------------------------------
// OrderCollectionAgent class
// ---------------------------------------------------------------------------

/**
 * OrderCollectionAgent handles the multi-step order flow.
 *
 * Each step collects one piece of information:
 * 1. variant — select size/color if product has variants
 * 2. name — collect customer name
 * 3. address — collect delivery address
 * 4. phone — collect phone number
 * 5. confirming — show summary, confirm or cancel
 */
export class OrderCollectionAgent {
  readonly name = 'order-collection'

  /**
   * Check if this agent should handle the current message.
   * Returns true if there's an active order draft with a step.
   */
  canHandle(ctx: AgentContext, followUpType: string | null): boolean {
    return followUpType === 'order_step_input' && ctx.state.order_draft !== null
  }

  /**
   * Handle an order collection step — full state machine.
   */
  async handle(ctx: AgentContext, triage: TriageResult): Promise<AgentResult> {
    const draft = ctx.state.order_draft
    if (!draft) {
      return emptyResult('order_collection', 'Захиалга эхлүүлэхийн тулд бараа сонгоно уу.')
    }

    const { supabase, message: customerMessage, storeId, customerId } = ctx
    let responseText: string
    let intent = 'order_collection'
    let orderDraft: OrderDraft | null = draft

    switch (draft.step) {
      case 'variant': {
        // Use product_id from items[0] or legacy field
        const selectingProductId = draft.items?.[0]?.product_id || draft.product_id
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, size, color, price, stock_quantity')
          .eq('product_id', selectingProductId)
          .gt('stock_quantity', 0)

        const resolvedMulti = resolveVariantsFromMessage(customerMessage, variants ?? [])
        if (resolvedMulti.length > 0) {
          // Build cart items from selected variants
          const productName = draft.items?.[0]?.product_name || draft.product_name || ''
          const basePrice = draft.items?.[0]?.unit_price || draft.unit_price || 0
          const newItems: CartItem[] = resolvedMulti.map(v => ({
            product_id: selectingProductId!,
            product_name: productName,
            variant_id: v.id,
            variant_label: [v.size, v.color].filter(Boolean).join('/'),
            unit_price: v.price ?? basePrice,
            quantity: 1,
          }))

          draft.items = newItems
          // Also set legacy fields from first item for backward compat
          draft.variant_id = newItems[0].variant_id
          draft.variant_label = newItems[0].variant_label
          draft.unit_price = newItems[0].unit_price

          // Move to name step
          draft.step = 'name'
          orderDraft = draft
          responseText = 'Нэрээ бичнэ үү:'
        } else {
          orderDraft = draft
          responseText = 'Аль хувилбарыг сонгохоо дугаараар бичнэ үү:'
        }
        break
      }

      case 'info':
      case 'name': {
        // Step: collect customer name
        // Any non-empty text that isn't a phone/address is treated as name
        const namePhone = extractPhone(customerMessage)
        const nameAddr = extractAddress(customerMessage, namePhone)
        if (!namePhone && !nameAddr && customerMessage.trim().length >= 2) {
          draft.customer_name = customerMessage.trim()
          draft.step = 'address'
          orderDraft = draft
          responseText = `${draft.customer_name}, хүргэлтийн хаягаа бичнэ үү (дүүрэг, хороо, байр):`
        } else if (nameAddr) {
          // Customer skipped name and sent address directly — accept it
          draft.address = nameAddr
          draft.step = 'phone'
          orderDraft = draft
          responseText = 'Утасны дугаараа бичнэ үү:'
        } else {
          orderDraft = draft
          responseText = 'Нэрээ бичнэ үү:'
        }
        break
      }

      case 'address': {
        // Step: collect delivery address
        const addrPhone = extractPhone(customerMessage)
        const addr = extractAddress(customerMessage, addrPhone)
        if (addr) {
          draft.address = addr
          draft.step = 'phone'
          orderDraft = draft
          responseText = 'Утасны дугаараа бичнэ үү:'
        } else {
          orderDraft = draft
          responseText = 'Хүргэлтийн хаягаа бичнэ үү (дүүрэг, хороо, байр):'
        }
        break
      }

      case 'phone': {
        // Step: collect phone number (ONLY after address)
        const phone = extractPhone(customerMessage)
        if (phone) {
          draft.phone = phone
          draft.step = 'confirming'
          orderDraft = draft
          responseText = buildOrderSummary(draft)
        } else {
          orderDraft = draft
          responseText = '8 оронтой утасны дугаараа бичнэ үү:'
        }
        break
      }

      case 'confirming': {
        // If the customer is clearly complaining mid-order, acknowledge it
        // and keep the draft alive so they can confirm/cancel later.
        const isComplaint = /yaagaad|uulaad|uurlasan|udaan|mongoo|butsaaj|munguu|гомдол|(?<![а-яөүё])муу(?![а-яөүё])|буцаа|яагаад|уурла|удаан/i.test(customerMessage)
        if (isComplaint && !isAffirmative(customerMessage) && !isNegative(customerMessage)) {
          orderDraft = draft
          intent = 'complaint'
          responseText = 'Уучлаарай, таньд тохиромжгүй байдалд хүрсэнд харамсаж байна. Захиалгаа үргэлжлүүлэх үү? (Тийм/Үгүй)'
          break
        }
        if (isAffirmative(customerMessage)) {
          const order = await createOrderFromChat(supabase, storeId, customerId, draft)
          orderDraft = null
          if (order) {
            const confirmItems = getDraftItems(draft)
            const confirmTotal = getDraftTotal(draft)
            const isIntercityOrder = order.delivery_fee === 0 && draft.address
              ? calculateDeliveryFee(draft.address).type === 'intercity'
              : false

            // Build items list for confirmation message
            let itemsText: string
            if (confirmItems.length > 1) {
              itemsText = confirmItems.map(item => {
                const label = item.variant_label ? ` (${item.variant_label})` : ''
                return `📦 ${item.product_name}${label} x${item.quantity}`
              }).join('\n')
            } else {
              const item = confirmItems[0]
              itemsText = `📦 ${item.product_name}${item.variant_label ? ` (${item.variant_label})` : ''} x${item.quantity}`
            }

            if (isIntercityOrder) {
              responseText = `✅ Захиалга амжилттай!\n\n📋 Захиалгын дугаар: ${order.order_number}\n${itemsText}\n💰 Бараа: ${formatPrice(confirmTotal)}\n🚌 Хүргэлт: Автобус / шуудан\n   ⚠️ Тээврийн үнэ хүлээн авахдаа төлнө\n📍 Хаяг: ${draft.address}\n📱 Утас: ${draft.phone}\n\nАсуулт байвал дэлгүүртэй холбогдоно уу. Баярлалаа! 🙏`
            } else {
              responseText = `✅ Захиалга амжилттай!\n\n📋 Захиалгын дугаар: ${order.order_number}\n${itemsText}\n💰 Бараа: ${formatPrice(confirmTotal)}\n🚚 Хүргэлт: ${formatPrice(order.delivery_fee)}\n💰 Нийт: ${formatPrice(order.total_amount)}\n📍 Хаяг: ${draft.address}\n📱 Утас: ${draft.phone}\n\nЖолооч тантай холбогдоно. Утсаа нээлттэй байлгаарай 📞 Баярлалаа!`
            }
            intent = 'order_created'
          } else {
            responseText = '⚠️ Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.'
          }
        } else if (isNegative(customerMessage)) {
          orderDraft = null
          responseText = '❌ Захиалга цуцлагдлаа. Өөр асуух зүйл байвал бичнэ үү!'
        } else {
          // Not clear yes/no — remind them
          orderDraft = draft
          responseText = 'Захиалгаа баталгаажуулах уу? (Тийм/Үгүй)'
        }
        break
      }

      default:
        orderDraft = null
        responseText = 'Захиалгын алхам алдаатай байна. Дахин оролдоно уу.'
    }

    return {
      response: responseText,
      intent,
      products: [],
      metadata: { products_found: 0, orders_found: 0 },
      orderStep: (orderDraft?.step as OrderStep) ?? null,
      stateUpdates: { order_draft: orderDraft },
    }
  }

  /**
   * Handle order intent — start a new order draft from a product the user wants to buy.
   */
  async handleOrderIntent(ctx: AgentContext, product: StoredProduct): Promise<AgentResult> {
    const result = await startOrderDraft(ctx.supabase, product, ctx.message, ctx.storeId, ctx.customerId)
    return {
      response: result.responseText,
      intent: 'order_collection',
      products: [],
      metadata: { products_found: 0, orders_found: 0 },
      orderStep: (result.draft.step as OrderStep) ?? null,
      stateUpdates: { order_draft: result.draft },
    }
  }

  /**
   * Handle number reference / select_single — start draft from selected product.
   */
  async handleNumberReference(ctx: AgentContext, product: StoredProduct): Promise<AgentResult> {
    const result = await startOrderDraft(
      ctx.supabase,
      { id: product.id, name: product.name, base_price: product.base_price },
      ctx.message, ctx.storeId, ctx.customerId,
    )

    // Fetch full product data for cards
    const detailProducts = await searchProducts(ctx.supabase, product.name, ctx.storeId, { maxProducts: 1, originalQuery: product.name })
    const productCards = detailProducts.length > 0
      ? detailProducts.map(p => ({
          name: p.name,
          base_price: p.base_price,
          description: (p as { description?: string }).description || '',
          images: (p as { images?: string[] }).images || [],
        }))
      : []

    return {
      response: result.responseText,
      intent: 'order_collection',
      products: productCards,
      metadata: { products_found: productCards.length, orders_found: 0 },
      orderStep: (result.draft.step as OrderStep) ?? null,
      stateUpdates: { order_draft: result.draft },
    }
  }

  /**
   * Handle order cancellation — clear draft.
   */
  handleOrderCancel(): AgentResult {
    return {
      response: '❌ Захиалга цуцлагдлаа. Өөр асуух зүйл байвал бичнэ үү!',
      intent: 'general',
      products: [],
      metadata: { products_found: 0, orders_found: 0 },
      orderStep: null,
      stateUpdates: { order_draft: null },
    }
  }
}
