/**
 * Shared AI chat processing logic.
 *
 * Extracted from /api/chat/ai so the Messenger webhook can call it
 * directly with a service-role Supabase client — avoiding the HTTP
 * round-trip and cookie-based auth issues that break RLS writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCustomerProfile } from './ai/customer-profile'
import { getLatestPurchase, formatPurchaseConfirmation, getExtendedCustomerInfo, formatExtendedProfileForAI, inferPreferencesFromMessage, savePreference, logInteraction } from './ai/customer-intelligence'
import {
  classifyIntent,
  extractSearchTerms,
  searchProducts,
  searchOrders,
  searchAvailableTables,
  checkStoreBusyMode,
  generateAIResponse,
  generateResponse,
  formatPrice,
  fetchRecentMessages,
  type ChatbotSettings,
  type TableMatch,
} from '@/lib/chat-ai'
import {
  readState,
  writeState,
  resolveFollowUp,
  updateState,
  type StoredProduct,
  type OrderDraft,
  type GiftCardDraft,
} from '@/lib/conversation-state'
import { normalizeText } from '@/lib/chat-ai'
import {
  purchaseGiftCard,
  lookupGiftCard,
  redeemGiftCard,
  transferGiftCard,
  extractGiftCardCode,
  parseGiftCardAmount,
  formatGiftCardBalance,
  GIFT_CARD_DENOMINATIONS,
} from '@/lib/gift-card-engine'
import { dispatchNotification } from '@/lib/notifications'
import { isOpenAIConfigured } from '@/lib/ai/openai-client'
import { calculateDeliveryFee } from '@/lib/delivery-fee-calculator'

const DEFAULT_DELIVERY_FEE = 5000

export interface AIProcessingContext {
  conversationId: string
  customerMessage: string
  storeId: string
  storeName: string
  customerId: string | null
  chatbotSettings: ChatbotSettings
}

export interface AIProductCard {
  name: string
  base_price: number
  description: string
  images: string[]
}

export interface AIProcessingResult {
  response: string
  intent: string
  messageId?: string
  products: AIProductCard[]
  metadata: {
    products_found: number
    orders_found: number
  }
  /** Active order draft step — used by webhook to send Quick Replies */
  orderStep?: 'variant' | 'info' | 'confirming' | null
}

/**
 * Process a customer message through the AI pipeline:
 * classify intent → search products/orders → generate response → save to DB.
 *
 * Optimized: parallel DB fetches, fire-and-forget writes where possible.
 */
export async function processAIChat(
  supabase: SupabaseClient,
  ctx: AIProcessingContext
): Promise<AIProcessingResult> {
  const {
    conversationId,
    customerMessage,
    storeId,
    storeName,
    customerId,
    chatbotSettings,
  } = ctx

  // --- Parallel: fetch conversation state + busy mode + customer profile ---
  const [state, busyMode, customerProfile] = await Promise.all([
    readState(supabase, conversationId),
    checkStoreBusyMode(supabase, storeId),
    customerId
      ? buildCustomerProfile(supabase, customerId, storeId).catch(() => null)
      : Promise.resolve(null),
  ])

  // ── Gift card flow intercept ────────────────────────────────────────────
  // Runs BEFORE followUp/order flow so gift card steps take priority.
  const gcResult = await handleGiftCardFlow(supabase, {
    customerMessage,
    storeId,
    customerId,
    state,
    conversationId,
  })
  if (gcResult) {
    // Save updated state and return the gift card response
    await writeState(supabase, conversationId, {
      ...state,
      last_intent: gcResult.intent,
      turn_count: state.turn_count + 1,
      gift_card_draft: gcResult.giftCardDraft,
      pending_gift_card_code: gcResult.pendingGiftCardCode,
    })
    // Save message to DB
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: gcResult.response,
      is_from_customer: false,
    })
    return {
      response: gcResult.response,
      intent: gcResult.intent,
      products: [],
      metadata: { products_found: 0, orders_found: 0 },
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  const followUp = resolveFollowUp(customerMessage, state)

  let intent: string
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  let orders: Awaited<ReturnType<typeof searchOrders>> = []
  let tables: TableMatch[] = []
  let responseText: string
  // If resolveFollowUp returned null but there WAS an order draft, it means
  // the user sent an off-topic message — clear the draft so they can browse freely.
  let orderDraft: OrderDraft | null = (!followUp && state.order_draft) ? null : (state.order_draft ?? null)

  if (followUp) {
    switch (followUp.type) {
      case 'order_step_input': {
        const draft = { ...state.order_draft! }
        intent = 'order_collection'

        switch (draft.step) {
          case 'variant': {
            const { data: variants } = await supabase
              .from('product_variants')
              .select('id, size, color, price, stock_quantity')
              .eq('product_id', draft.product_id)
              .gt('stock_quantity', 0)

            const resolved = resolveVariantFromMessage(customerMessage, variants ?? [])
            if (resolved) {
              const label = [resolved.size, resolved.color].filter(Boolean).join('/')
              draft.variant_id = resolved.id
              draft.variant_label = label
              draft.unit_price = resolved.price ?? draft.unit_price

              // Move to info step — ask for address + phone next
              draft.step = 'info'
              orderDraft = draft
              responseText = buildInfoRequest(draft)
            } else {
              orderDraft = draft
              responseText = 'Аль хувилбарыг сонгохоо дугаараар бичнэ үү:'
            }
            break
          }

          case 'info': {
            // Parse message for address and/or phone
            const phone = extractPhone(customerMessage)
            const addr = extractAddress(customerMessage, phone)

            if (phone && !draft.phone) draft.phone = phone
            if (addr && !draft.address) draft.address = addr

            if (draft.address && draft.phone) {
              // All info collected — show summary
              draft.step = 'confirming'
              orderDraft = draft
              responseText = buildOrderSummary(draft)
            } else {
              orderDraft = draft
              responseText = buildInfoRequest(draft)
            }
            break
          }

          case 'confirming': {
            if (isAffirmative(customerMessage)) {
              const order = await createOrderFromChat(supabase, storeId, customerId, draft)
              orderDraft = null
              if (order) {
                const productTotal = draft.unit_price * draft.quantity
                responseText = `✅ Захиалга амжилттай!\n\n📋 Захиалгын дугаар: ${order.order_number}\n📦 ${draft.product_name}${draft.variant_label ? ` (${draft.variant_label})` : ''} x${draft.quantity}\n💰 Бараа: ${formatPrice(productTotal)}\n🚚 Хүргэлт: ${formatPrice(order.delivery_fee)}\n💰 Нийт: ${formatPrice(order.total_amount)}\n📍 Хаяг: ${draft.address}\n📱 Утас: ${draft.phone}\n\nМенежер тантай холбогдож баталгаажуулна. Баярлалаа!`
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
        break
      }

      case 'order_intent': {
        const result = await startOrderDraft(supabase, followUp.product!, customerMessage)
        intent = 'order_collection'
        orderDraft = result.draft
        responseText = result.responseText
        break
      }

      case 'order_cancel': {
        orderDraft = null
        responseText = '❌ Захиалга цуцлагдлаа. Өөр асуух зүйл байвал бичнэ үү!'
        intent = 'general'
        break
      }

      case 'number_reference':
      case 'select_single': {
        const p = followUp.product!
        intent = 'product_detail'
        // Fetch full product data (with images) for product card
        const [detailProducts] = await Promise.all([
          searchProducts(supabase, p.name, storeId, { maxProducts: 1, originalQuery: p.name }),
        ])
        if (detailProducts.length > 0) {
          products = detailProducts
        }
        responseText = `**${p.name}**\n💰 ${formatPrice(p.base_price)}\n\nЭнэ бүтээгдэхүүнийг захиалмаар байвал бичнэ үү!`
        break
      }
      case 'price_question': {
        intent = 'price_info'
        const priceList = followUp.products!
          .map((p, i) => `${i + 1}. ${p.name} — ${formatPrice(p.base_price)}`)
          .join('\n')
        responseText = `Үнийн мэдээлэл:\n\n${priceList}`
        break
      }
      case 'query_refinement': {
        intent = 'product_search'
        // Parallel: search products + fetch history
        const [refProducts, refHistory] = await Promise.all([
          searchProducts(supabase, followUp.refinedQuery!, storeId, {
            maxProducts: chatbotSettings.max_products,
            originalQuery: followUp.refinedQuery!,
          }),
          isOpenAIConfigured() ? fetchRecentMessages(supabase, conversationId) : Promise.resolve(undefined),
        ])
        products = refProducts
        responseText = await generateAIResponse(
          intent, products, orders, storeName, followUp.refinedQuery!, chatbotSettings, refHistory,
          undefined, undefined, customerProfile
        )
        break
      }
      case 'size_question':
      case 'contextual_question':
      case 'prefer_llm': {
        intent = followUp.type === 'size_question' ? 'size_info'
          : followUp.type === 'contextual_question' ? 'general'
          : classifyIntent(customerMessage)
        const searchTerms = extractSearchTerms(customerMessage)

        // Parallel: search + history fetch based on intent
        const [llmProducts, llmOrders, llmHistory] = await Promise.all([
          (intent === 'product_search' || intent === 'general' || intent === 'size_info')
            ? searchProducts(supabase, searchTerms, storeId, { maxProducts: chatbotSettings.max_products, originalQuery: customerMessage })
            : Promise.resolve([]),
          (intent === 'order_status')
            ? searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
            : Promise.resolve([]),
          isOpenAIConfigured() ? fetchRecentMessages(supabase, conversationId) : Promise.resolve(undefined),
        ])
        products = llmProducts.length > 0 ? llmProducts : products
        orders = llmOrders
        responseText = await generateAIResponse(
          intent, products, orders, storeName, customerMessage, chatbotSettings, llmHistory,
          undefined, undefined, customerProfile
        )
        break
      }
      default:
        intent = 'general'
        responseText = generateResponse(intent, products, orders, storeName, chatbotSettings)
    }
  } else {
    // Normal classification path
    intent = classifyIntent(customerMessage)

    if (busyMode.busy_mode && ['product_search', 'table_reservation', 'menu_availability'].includes(intent)) {
      const waitMsg = busyMode.estimated_wait_minutes
        ? ` Хүлээлтийн хугацаа: ${busyMode.estimated_wait_minutes} минут.`
        : ''
      responseText = busyMode.busy_message
        || `⚠️ Одоогоор захиалга түр хаасан байна.${waitMsg} Тун удахгүй дахин оролдоно уу!`
      intent = 'busy_mode'
    } else {
      const searchTerms = extractSearchTerms(customerMessage)

      // Parallel: all DB fetches + history in one batch
      const [searchedProducts, searchedOrders, searchedTables, history] = await Promise.all([
        (intent === 'product_search' || intent === 'general' || intent === 'menu_availability' || intent === 'allergen_info' || intent === 'size_info')
          ? searchProducts(supabase, searchTerms, storeId, {
              maxProducts: chatbotSettings.max_products,
              originalQuery: customerMessage,
              availableOnly: intent === 'menu_availability',
            })
          : Promise.resolve([]),
        (intent === 'order_status')
          ? searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
          : Promise.resolve([]),
        (intent === 'table_reservation')
          ? searchAvailableTables(supabase, storeId)
          : Promise.resolve([] as TableMatch[]),
        isOpenAIConfigured()
          ? fetchRecentMessages(supabase, conversationId)
          : Promise.resolve(undefined),
      ])

      products = searchedProducts
      orders = searchedOrders
      tables = searchedTables

      // Auto-lookup: if order_status/shipping with no specific order found, fetch customer's recent orders
      if ((intent === 'order_status' || intent === 'shipping') && orders.length === 0 && customerId) {
        const latestPurchase = await getLatestPurchase(supabase, customerId, storeId)
        if (latestPurchase) {
          // Convert to OrderMatch format and use as context
          orders = [{
            id: latestPurchase.order_id,
            order_number: latestPurchase.order_number,
            status: latestPurchase.status,
            total_amount: latestPurchase.total_amount,
            created_at: latestPurchase.created_at,
            tracking_number: null,
          }] as typeof orders
        }
      }

      // Auto-lookup: for return/complaint, fetch latest purchase for confirmation
      let latestPurchaseSummary: string | null = null
      if ((intent === 'return_exchange' || intent === 'complaint') && customerId) {
        const latestPurchase = await getLatestPurchase(supabase, customerId, storeId)
        if (latestPurchase) {
          latestPurchaseSummary = formatPurchaseConfirmation(latestPurchase)
        }
        // Log interaction
        void logInteraction(supabase, customerId, storeId, {
          type: intent === 'return_exchange' ? 'return_request' : 'complaint',
          summary: customerMessage,
        }).catch(() => {})
      }

      // Build extended profile for AI personalization
      let extendedProfile: string | null = null
      if (customerId) {
        try {
          const extInfo = await getExtendedCustomerInfo(supabase, customerId, storeId)
          extendedProfile = formatExtendedProfileForAI(extInfo) || null
        } catch { /* non-critical */ }

        // Infer and save preferences from message (fire-and-forget)
        const inferred = inferPreferencesFromMessage(customerMessage)
        if (inferred.length > 0) {
          void Promise.all(inferred.map(p =>
            savePreference(supabase, customerId, storeId, {
              type: p.type,
              key: p.key,
              value: p.value,
              confidence: 0.5,
              source: 'inferred',
            })
          )).catch(() => {})
        }
      }

      responseText = await generateAIResponse(
        intent, products, orders, storeName, customerMessage, chatbotSettings, history,
        undefined,
        { availableTables: tables, busyMode },
        customerProfile,
        extendedProfile,
        latestPurchaseSummary,
      )

      // If the message contains order intent, start order flow.
      // Skip if already classified as order_status or complaint —
      // "захиалга маань ирэхгүй" is a complaint, not a new order request.
      // Also skip if the message is a recommendation/exploration query —
      // "авмаар байна. Юу санал болгох вэ?" = browsing, not ready-to-buy.
      const RECOMMENDATION_SIGNALS = [
        'санал болг', 'юу авбал', 'юу авах вэ', 'юу захиалах вэ',
        'зөвлө', 'юу санал', 'аль нь дээр', 'юу вэ', 'юу болох',
        'бэлэг', // gift context — almost always exploring, not ready-to-buy
      ]
      const isRecommendationQuery = RECOMMENDATION_SIGNALS.some(
        (sig) => normalizeText(customerMessage).includes(normalizeText(sig))
      )
      if (!isRecommendationQuery && intent !== 'order_status' && intent !== 'complaint' && hasOrderIntent(customerMessage)) {
        // Check if message has meaningful non-order words that identify a product.
        // If message is ONLY order words (e.g. "zahialu"), products from search are
        // likely coincidental matches (description contains "захиал*") — show catalog.
        const msgWords = normalizeText(customerMessage).trim().split(/\s+/)
        const nonOrderWords = msgWords.filter((w) =>
          !ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
          && !ORDER_EXACT_WORDS.some((ew) => w === normalizeText(ew))
        )
        const hasProductIdentifier = nonOrderWords.some((w) => w.length >= 2)

        if (products.length > 0 && hasProductIdentifier) {
          // Message has product-identifying words + products found — start order draft
          const p = products[0]
          const result = await startOrderDraft(supabase, { id: p.id, name: p.name, base_price: p.base_price }, customerMessage)
          orderDraft = result.draft
          responseText = result.responseText
          intent = 'order_collection'
        } else {
          // Pure order words only or no products — show catalog
          const allProducts = await searchProducts(supabase, '', storeId, {
            maxProducts: chatbotSettings.max_products || 5,
            originalQuery: '',
          })
          if (allProducts.length > 0) {
            products = allProducts
            intent = 'product_search'
            const productList = allProducts.map((p, i) =>
              `${i + 1}. **${p.name}** — ${formatPrice(p.base_price)}`
            ).join('\n')
            responseText = `Ямар бүтээгдэхүүн захиалмаар байна?\n\n${productList}\n\nДугаараа бичнэ үү:`
          }
        }
      }
    }
  }

  // Save AI response + update state + update conversation — all in parallel
  let storedProducts: StoredProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    base_price: p.base_price,
  }))

  // Preserve the selected product in state after number_reference/select_single/order_intent.
  // Without this, after selecting "2" from a list, last_products becomes [] and
  // subsequent messages like "тийм" lose all product context.
  if (followUp?.product && storedProducts.length === 0) {
    storedProducts = [followUp.product]
  }

  const nextState = updateState(state, intent, storedProducts, customerMessage)
  nextState.order_draft = orderDraft

  const [savedMessageResult] = await Promise.all([
    supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: responseText,
        is_from_customer: false,
        is_ai_response: true,
        metadata: {
          intent,
          products_found: products.length,
          orders_found: orders.length,
          follow_up: followUp?.type ?? null,
        },
      })
      .select('id, created_at')
      .single(),
    writeState(supabase, conversationId, nextState),
  ])

  return {
    response: responseText,
    intent,
    messageId: savedMessageResult.data?.id,
    products: products.map((p) => ({
      name: p.name,
      base_price: p.base_price,
      description: p.description ?? '',
      images: p.images ?? [],
    })),
    metadata: {
      products_found: products.length,
      orders_found: orders.length,
    },
    orderStep: orderDraft?.step ?? null,
  }
}

// ---------------------------------------------------------------------------
// Order helpers
// ---------------------------------------------------------------------------

interface VariantRow {
  id: string
  size: string | null
  color: string | null
  price: number | null
  stock_quantity: number | null
}

/** Order intent — prefix stems + exact words for Mongolian verb forms */
const ORDER_WORD_STEMS = ['захиал', 'авъ', 'авь']
const ORDER_EXACT_WORDS = ['авна', 'авах', 'авйа', 'ави', 'авмаар']

function hasOrderIntent(msg: string): boolean {
  const words = normalizeText(msg).trim().split(/\s+/)
  return words.some((w) =>
    ORDER_WORD_STEMS.some((stem) => w.startsWith(normalizeText(stem)))
    || ORDER_EXACT_WORDS.some((ew) => w === normalizeText(ew))
  )
}

function isAffirmative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['тийм', 'за', 'зүгээр', 'болно', 'тийм ээ', 'зөв', 'ok', 'ок', 'yes']
  return words.some((w) => n === w || n.startsWith(w + ' '))
}

function isNegative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['үгүй', 'болихгүй', 'цуцлах', 'цуцал', 'хүсэхгүй', 'нет', 'no']
  return words.some((w) => n === w || n.startsWith(w + ' '))
}

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

/**
 * Extract address from a message. Removes phone number if found.
 * Returns null if remaining text is too short to be an address.
 */
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
  // Must be substantial to be an address (at least 5 chars)
  return text.length >= 5 ? text : null
}

function resolveVariantFromMessage(msg: string, variants: VariantRow[]): VariantRow | null {
  if (variants.length === 0) return null
  const normalized = normalizeText(msg).trim()

  // Number selection: "1", "2"
  const numMatch = normalized.match(/^(\d+)/)
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1
    if (idx >= 0 && idx < variants.length) return variants[idx]
  }

  // Size/color keyword match (fuzzy: message contains the variant keyword)
  for (const v of variants) {
    if (v.size && normalized.includes(normalizeText(v.size))) return v
    if (v.color && normalized.includes(normalizeText(v.color))) return v
  }

  // Fuzzy color match: "цаганас" contains "цагаан" prefix
  for (const v of variants) {
    if (v.color) {
      const normColor = normalizeText(v.color)
      // Check if any word in the message starts with the color name (3+ chars)
      if (normColor.length >= 3) {
        const words = normalized.split(/\s+/)
        if (words.some((w) => w.startsWith(normColor) || normColor.startsWith(w) && w.length >= 3)) {
          return v
        }
      }
    }
  }

  return null
}

/**
 * Build a summary message showing ALL order details before confirmation.
 */
function buildOrderSummary(draft: OrderDraft): string {
  const productTotal = draft.unit_price * draft.quantity
  const feeResult = draft.address ? calculateDeliveryFee(draft.address) : null
  const deliveryFee = feeResult?.fee ?? DEFAULT_DELIVERY_FEE
  const grandTotal = productTotal + deliveryFee

  const lines = ['📋 Захиалгын мэдээлэл:\n']
  lines.push(`📦 ${draft.product_name}`)
  if (draft.variant_label) lines.push(`   Хувилбар: ${draft.variant_label}`)
  lines.push(`   Тоо: ${draft.quantity} ширхэг`)
  lines.push(`   💰 Бараа: ${formatPrice(productTotal)}`)
  lines.push(`🚚 Хүргэлт: ${formatPrice(deliveryFee)}`)
  lines.push(`💰 Нийт: ${formatPrice(grandTotal)}`)
  if (draft.address) lines.push(`📍 Хаяг: ${draft.address}`)
  if (draft.phone) lines.push(`📱 Утас: ${draft.phone}`)
  lines.push('\nЗахиалгаа баталгаажуулах уу? (Тийм/Үгүй)')
  return lines.join('\n')
}

/**
 * Build a message asking for missing info (address and/or phone).
 */
function buildInfoRequest(draft: OrderDraft): string {
  const missing: string[] = []
  if (!draft.address) missing.push('хүргэлтийн хаяг (дүүрэг, хороо, байр, тоот)')
  if (!draft.phone) missing.push('утасны дугаар (8 оронтой)')
  return `📦 ${draft.product_name}${draft.variant_label ? ` (${draft.variant_label})` : ''} — ${formatPrice(draft.unit_price)}\n\nЗахиалга үүсгэхийн тулд дараах мэдээлэл хэрэгтэй:\n• ${missing.join('\n• ')}\n\nБичнэ үү:`
}

/**
 * Start a new order draft for a product. Fetches variants and resolves
 * any variant/address/phone info from the customer message.
 */
async function startOrderDraft(
  supabase: SupabaseClient,
  product: StoredProduct,
  customerMessage: string
): Promise<{ draft: OrderDraft; responseText: string }> {
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, size, color, price, stock_quantity')
    .eq('product_id', product.id)
    .gt('stock_quantity', 0)

  const inStock = variants ?? []

  let draft: OrderDraft

  if (inStock.length > 1) {
    // Try to auto-select variant from message
    const preselected = resolveVariantFromMessage(customerMessage, inStock)
    if (preselected) {
      const label = [preselected.size, preselected.color].filter(Boolean).join('/')
      draft = {
        product_id: product.id,
        product_name: product.name,
        variant_id: preselected.id,
        variant_label: label,
        unit_price: preselected.price ?? product.base_price,
        quantity: 1,
        step: 'info',
      }
    } else {
      draft = {
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
        responseText: `📦 ${product.name} захиалга\n\nАль хувилбарыг сонгох вэ?\n${variantList}\n\nДугаараа бичнэ үү:`,
      }
    }
  } else {
    // 0 or 1 variant — auto-select
    const variant = inStock[0]
    const label = variant ? [variant.size, variant.color].filter(Boolean).join('/') : undefined
    draft = {
      product_id: product.id,
      product_name: product.name,
      variant_id: variant?.id,
      variant_label: label || undefined,
      unit_price: variant?.price ?? product.base_price,
      quantity: 1,
      step: 'info',
    }
  }

  // Always ask for address + phone after product/variant selection
  return { draft, responseText: buildInfoRequest(draft) }
}

async function createOrderFromChat(
  supabase: SupabaseClient,
  storeId: string,
  customerId: string | null,
  draft: OrderDraft
): Promise<{ order_number: string; total_amount: number; delivery_fee: number } | null> {
  const orderNumber = `ORD-${Date.now()}`
  const productTotal = draft.unit_price * draft.quantity

  // Calculate delivery fee from address
  const feeResult = draft.address ? calculateDeliveryFee(draft.address) : null
  const deliveryFee = feeResult?.fee ?? DEFAULT_DELIVERY_FEE
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
      notes: `Messenger захиалга | Утас: ${draft.phone || ''}`,
    })
    .select('id, order_number, total_amount')
    .single()

  if (orderError || !newOrder) {
    console.error('[Order] Failed to create:', orderError)
    return null
  }

  // Create order item + delivery record in parallel
  const deliveryNumber = `DEL-${Date.now()}`

  // Fetch customer name for delivery record
  let customerName: string | null = null
  if (customerId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single()
    customerName = cust?.name ?? null
  }

  await Promise.all([
    supabase.from('order_items').insert({
      order_id: newOrder.id,
      product_id: draft.product_id,
      variant_id: draft.variant_id || null,
      quantity: draft.quantity,
      unit_price: draft.unit_price,
      variant_label: draft.variant_label || null,
    }),
    supabase.from('deliveries').insert({
      store_id: storeId,
      order_id: newOrder.id,
      delivery_number: deliveryNumber,
      status: 'pending',
      delivery_type: 'own_driver',
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

// ---------------------------------------------------------------------------
// Gift Card Flow
// ---------------------------------------------------------------------------

interface GiftCardFlowInput {
  customerMessage: string
  storeId: string
  customerId: string | null
  state: Awaited<ReturnType<typeof readState>>
  conversationId: string
}

interface GiftCardFlowResult {
  response: string
  intent: string
  giftCardDraft: GiftCardDraft | null
  pendingGiftCardCode: string | null
}

/**
 * Handle all gift card chat flow states.
 * Returns a result if the gift card flow should intercept this message,
 * or null to let the normal pipeline handle it.
 */
async function handleGiftCardFlow(
  supabase: SupabaseClient,
  { customerMessage, storeId, customerId, state }: GiftCardFlowInput
): Promise<GiftCardFlowResult | null> {
  const normalized = normalizeText(customerMessage)

  // ── Case 1: Active gift card purchase flow ─────────────────────────────
  const draft = state.gift_card_draft
  if (draft && draft.step !== 'done') {
    return handleGiftCardPurchaseStep(supabase, {
      customerMessage,
      normalized,
      storeId,
      customerId,
      draft,
    })
  }

  // ── Case 2: Pending redemption confirmation ────────────────────────────
  const pendingCode = state.pending_gift_card_code
  if (pendingCode) {
    if (isAffirmative(customerMessage)) {
      // Customer confirmed — look up card and show info, mark as pending apply
      const card = await lookupGiftCard(supabase, { code: pendingCode, storeId })
      if (!card || card.status !== 'active') {
        return {
          response: '⚠️ Бэлгийн карт олдсонгүй эсвэл хүчингүй байна.',
          intent: 'gift_card_redeem',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
      return {
        response: `💳 **${pendingCode}**\nҮлдэгдэл: **${formatGiftCardBalance(card.current_balance)}**\n\nЭнэ захиалгаас хасах уу? Захиалгын дугаараа бичнэ үү, эсвэл "Үгүй" гэж бичнэ үү.`,
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: pendingCode,
      }
    } else if (isNegative(customerMessage)) {
      return {
        response: 'За, бэлгийн карт ашиглахгүй боллоо. Өөр тусалж чадах зүйл байна уу?',
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
    }
    // Check if they provided an order number to apply against
    const orderMatch = customerMessage.match(/ORD-\d+/i)
    if (orderMatch) {
      const orderNumber = orderMatch[0].toUpperCase()
      // Look up order
      const { data: order } = await supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('order_number', orderNumber)
        .eq('store_id', storeId)
        .single()
      if (order) {
        const card = await lookupGiftCard(supabase, { code: pendingCode, storeId })
        if (card && card.status === 'active' && card.current_balance > 0) {
          const applyAmount = Math.min(card.current_balance, order.total_amount)
          const result = await redeemGiftCard(supabase, {
            code: pendingCode,
            storeId,
            amount: applyAmount,
            orderId: order.id,
            customerId,
          })
          if (result.success) {
            return {
              response: `✅ **${formatGiftCardBalance(applyAmount)}** захиалгаас хасагдлаа!\n\nБэлгийн картын үлдэгдэл: ${formatGiftCardBalance(result.remaining)}\n\nБаярлалаа!`,
              intent: 'gift_card_redeem',
              giftCardDraft: null,
              pendingGiftCardCode: null,
            }
          }
        }
        return {
          response: `⚠️ Бэлгийн карт ашиглахад алдаа гарлаа. Менежертэй холбогдоно уу.`,
          intent: 'gift_card_redeem',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
    }
    // Still waiting — don't intercept, let normal flow handle
    return null
  }

  // ── Case 3: Message contains a GIFT-XXXX-XXXX code ────────────────────
  const codeInMessage = extractGiftCardCode(customerMessage)
  if (codeInMessage) {
    const card = await lookupGiftCard(supabase, { code: codeInMessage, storeId })
    if (!card) {
      return {
        response: `⚠️ **${codeInMessage}** код олдсонгүй. Кодоо дахин шалгана уу.`,
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
    }
    if (card.status !== 'active') {
      const msg = card.status === 'redeemed'
        ? `💳 **${codeInMessage}** — дууссан (үлдэгдэл 0₮).`
        : `💳 **${codeInMessage}** — хүчингүй карт.`
      return {
        response: msg,
        intent: 'gift_card_redeem',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
    }
    return {
      response: `💳 Бэлгийн карт олдлоо!\n\n**Код:** ${codeInMessage}\n**Үлдэгдэл:** ${formatGiftCardBalance(card.current_balance)}\n\nЭнэ захиалгаас хасах уу? (Тийм / Үгүй)`,
      intent: 'gift_card_redeem',
      giftCardDraft: null,
      pendingGiftCardCode: codeInMessage,
    }
  }

  // ── Case 4: Gift card purchase intent ─────────────────────────────────
  if (classifyIntent(customerMessage) === 'gift_card_purchase') {
    const denomList = GIFT_CARD_DENOMINATIONS
      .map((d) => `💳 ${formatGiftCardBalance(d)}`)
      .join('\n')
    return {
      response: `🎁 Бэлгийн карт авмаар байна уу?\n\nДараах дүнгүүдээс сонгоно уу:\n\n${denomList}\n\nДүнгээ бичнэ үү:`,
      intent: 'gift_card_purchase',
      giftCardDraft: { step: 'select_amount' },
      pendingGiftCardCode: null,
    }
  }

  // Not a gift card message
  return null
}

/**
 * Handle individual steps of the gift card purchase flow.
 */
async function handleGiftCardPurchaseStep(
  supabase: SupabaseClient,
  {
    customerMessage,
    storeId,
    customerId,
    draft,
  }: {
    customerMessage: string
    normalized: string
    storeId: string
    customerId: string | null
    draft: GiftCardDraft
  }
): Promise<GiftCardFlowResult> {
  switch (draft.step) {
    case 'select_amount': {
      const amount = parseGiftCardAmount(customerMessage)
      if (!amount) {
        const denomList = GIFT_CARD_DENOMINATIONS
          .map((d) => `💳 ${formatGiftCardBalance(d)}`)
          .join('\n')
        return {
          response: `Уучлаарай, дүнг танихгүй байна. Дараахаас сонгоно уу:\n\n${denomList}`,
          intent: 'gift_card_purchase',
          giftCardDraft: draft,
          pendingGiftCardCode: null,
        }
      }
      return {
        response: `💳 **${formatGiftCardBalance(amount)}** бэлгийн карт\n\nQPay-аар төлнө үү?\n\n[QPay холбоос — TODO: integrate real QPay]\n\n_(Одоогоор тест горимд автоматаар баталгаажна)_\n\nБаталгаажуулах уу? (Тийм / Үгүй)`,
        intent: 'gift_card_purchase',
        giftCardDraft: { ...draft, step: 'confirm', amount },
        pendingGiftCardCode: null,
      }
    }

    case 'confirm': {
      if (isNegative(customerMessage)) {
        return {
          response: '❌ Бэлгийн карт авахаас татгалзлаа. Өөр тусалж чадах зүйл байна уу?',
          intent: 'gift_card_purchase',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
      if (!isAffirmative(customerMessage)) {
        return {
          response: 'Бэлгийн картыг баталгаажуулах уу? (Тийм / Үгүй)',
          intent: 'gift_card_purchase',
          giftCardDraft: draft,
          pendingGiftCardCode: null,
        }
      }

      // Payment confirmed — create the gift card
      try {
        const { code } = await purchaseGiftCard(supabase, {
          storeId,
          customerId,
          amount: draft.amount!,
          purchasedVia: 'chat',
        })
        return {
          response: `✅ Бэлгийн карт үүслээ!\n\n🎁 **Код:** \`${code}\`\n💰 **Дүн:** ${formatGiftCardBalance(draft.amount!)}\n📅 **Хүчинтэй:** 1 жил\n\nХэнд нэгэнд илгээх үү? Утасны дугаар эсвэл нэр бичнэ үү.\n_(Илгээхгүй бол "Үгүй" гэж бичнэ үү)_`,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'send_to', code },
          pendingGiftCardCode: null,
        }
      } catch (err) {
        console.error('[GiftCard] Purchase failed:', err)
        return {
          response: '⚠️ Бэлгийн карт үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.',
          intent: 'gift_card_purchase',
          giftCardDraft: null,
          pendingGiftCardCode: null,
        }
      }
    }

    case 'send_to': {
      if (isNegative(customerMessage)) {
        return {
          response: `✅ Бэлгийн карт таны гарт байна!\n\n🎁 **Код:** \`${draft.code}\`\n\nДараа хэрэглэх үед кодоо бичвэл хэрэглэж болно. Баярлалаа!`,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'done' },
          pendingGiftCardCode: null,
        }
      }

      // Extract phone number or name from message
      const phone = customerMessage.match(/\d{8,}/)?.[0]
      const recipientContact = phone ?? customerMessage.trim()

      // Transfer the card
      try {
        await transferGiftCard(supabase, {
          code: draft.code!,
          storeId,
          fromCustomerId: customerId,
          recipientContact,
        })
        return {
          response: `✅ Бэлгийн карт **${recipientContact}**-д илгээлээ!\n\n🎁 **Код:** \`${draft.code}\`\n\nТэд кодыг ашиглан дэлгүүрт захиалга хийж болно. Баярлалаа!`,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'done', recipientContact },
          pendingGiftCardCode: null,
        }
      } catch (err) {
        console.error('[GiftCard] Transfer failed:', err)
        return {
          response: `⚠️ Дамжуулахад алдаа гарлаа. Бэлгийн карт таны гарт байна: \`${draft.code}\``,
          intent: 'gift_card_purchase',
          giftCardDraft: { ...draft, step: 'done' },
          pendingGiftCardCode: null,
        }
      }
    }

    default:
      return {
        response: 'Бэлгийн картын алхам алдаатай. Дахин оролдоно уу.',
        intent: 'gift_card_purchase',
        giftCardDraft: null,
        pendingGiftCardCode: null,
      }
  }
}
