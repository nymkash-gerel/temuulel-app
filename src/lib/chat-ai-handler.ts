/**
 * Shared AI chat processing logic.
 *
 * Extracted from /api/chat/ai so the Messenger webhook can call it
 * directly with a service-role Supabase client — avoiding the HTTP
 * round-trip and cookie-based auth issues that break RLS writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
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
} from '@/lib/conversation-state'
import { normalizeText } from '@/lib/chat-ai'
import { dispatchNotification } from '@/lib/notifications'
import { isOpenAIConfigured } from '@/lib/ai/openai-client'

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
  orderStep?: 'variant' | 'confirm' | 'address' | 'phone' | null
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

  // --- Parallel: fetch conversation state + busy mode at the same time ---
  const [state, busyMode] = await Promise.all([
    readState(supabase, conversationId),
    checkStoreBusyMode(supabase, storeId),
  ])

  const followUp = resolveFollowUp(customerMessage, state)

  let intent: string
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  let orders: Awaited<ReturnType<typeof searchOrders>> = []
  let tables: TableMatch[] = []
  let responseText: string
  let orderDraft: OrderDraft | null = state.order_draft ?? null

  if (followUp) {
    switch (followUp.type) {
      case 'order_step_input': {
        const draft = state.order_draft!
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
              draft.step = 'confirm'
              orderDraft = { ...draft }
              responseText = buildConfirmMessage(draft)
            } else {
              orderDraft = draft
              responseText = 'Аль хувилбарыг сонгохоо дугаараар бичнэ үү:'
            }
            break
          }
          case 'confirm': {
            if (isAffirmative(customerMessage)) {
              draft.step = 'address'
              orderDraft = { ...draft }
              responseText = '📍 Хүргэлтийн хаяг бичнэ үү (дүүрэг, хороо, байр, тоот):'
            } else {
              orderDraft = null
              responseText = '❌ Захиалга цуцлагдлаа. Өөр асуух зүйл байвал бичнэ үү!'
            }
            break
          }
          case 'address': {
            draft.address = customerMessage.trim()
            draft.step = 'phone'
            orderDraft = { ...draft }
            responseText = '📱 Утасны дугаар бичнэ үү (жишээ: 99112233):'
            break
          }
          case 'phone': {
            const phone = extractPhone(customerMessage)
            if (phone) {
              draft.phone = phone
              const order = await createOrderFromChat(supabase, storeId, customerId, draft)
              orderDraft = null
              if (order) {
                responseText = `✅ Захиалга амжилттай!\n\n📋 Захиалгын дугаар: ${order.order_number}\n📦 ${draft.product_name}${draft.variant_label ? ` (${draft.variant_label})` : ''} x${draft.quantity}\n💰 Нийт: ${formatPrice(order.total_amount)}\n📍 Хаяг: ${draft.address}\n📱 Утас: ${phone}\n\nМенежер тантай холбогдож баталгаажуулна. Баярлалаа! 🙏`
                intent = 'order_created'
              } else {
                responseText = '⚠️ Захиалга үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.'
              }
            } else {
              orderDraft = draft
              responseText = '8 оронтой утасны дугаар бичнэ үү (жишээ: 99112233):'
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
        const p = followUp.product!
        intent = 'order_collection'

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, size, color, price, stock_quantity')
          .eq('product_id', p.id)
          .gt('stock_quantity', 0)

        const inStock = variants ?? []

        if (inStock.length > 1) {
          orderDraft = {
            product_id: p.id,
            product_name: p.name,
            unit_price: p.base_price,
            quantity: 1,
            step: 'variant',
          }
          const variantList = inStock.map((v, i) => {
            const parts: string[] = []
            if (v.size) parts.push(v.size)
            if (v.color) parts.push(v.color)
            parts.push(formatPrice(v.price ?? p.base_price))
            return `${i + 1}. ${parts.join(' / ')}`
          }).join('\n')
          responseText = `📦 ${p.name} захиалга\n\nАль хувилбарыг сонгох вэ?\n${variantList}\n\nДугаараа бичнэ үү:`
        } else if (inStock.length === 1) {
          const variant = inStock[0]
          const label = [variant.size, variant.color].filter(Boolean).join('/')
          orderDraft = {
            product_id: p.id,
            product_name: p.name,
            variant_id: variant.id,
            variant_label: label || undefined,
            unit_price: variant.price ?? p.base_price,
            quantity: 1,
            step: 'confirm',
          }
          responseText = buildConfirmMessage(orderDraft)
        } else {
          // No variants — use base product
          orderDraft = {
            product_id: p.id,
            product_name: p.name,
            unit_price: p.base_price,
            quantity: 1,
            step: 'confirm',
          }
          responseText = buildConfirmMessage(orderDraft)
        }
        break
      }

      case 'number_reference':
      case 'select_single': {
        const p = followUp.product!
        intent = 'product_detail'
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
          intent, products, orders, storeName, followUp.refinedQuery!, chatbotSettings, refHistory
        )
        break
      }
      case 'prefer_llm': {
        intent = classifyIntent(customerMessage)
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
        products = llmProducts
        orders = llmOrders
        responseText = await generateAIResponse(
          intent, products, orders, storeName, customerMessage, chatbotSettings, llmHistory
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

      responseText = await generateAIResponse(
        intent, products, orders, storeName, customerMessage, chatbotSettings, history,
        undefined,
        { availableTables: tables, busyMode }
      )

      // If the message also contains order intent and products were found,
      // start order flow directly instead of just showing product info.
      if (products.length > 0 && hasOrderIntent(customerMessage)) {
        const p = products[0]
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, size, color, price, stock_quantity')
          .eq('product_id', p.id)
          .gt('stock_quantity', 0)

        const inStock = variants ?? []

        if (inStock.length > 1) {
          // Check if the customer specified a variant in their message
          const preselected = resolveVariantFromMessage(customerMessage, inStock)
          if (preselected) {
            const label = [preselected.size, preselected.color].filter(Boolean).join('/')
            orderDraft = {
              product_id: p.id,
              product_name: p.name,
              variant_id: preselected.id,
              variant_label: label,
              unit_price: preselected.price ?? p.base_price,
              quantity: 1,
              step: 'confirm',
            }
            responseText = buildConfirmMessage(orderDraft)
          } else {
            orderDraft = {
              product_id: p.id,
              product_name: p.name,
              unit_price: p.base_price,
              quantity: 1,
              step: 'variant',
            }
            const variantList = inStock.map((v, i) => {
              const parts: string[] = []
              if (v.size) parts.push(v.size)
              if (v.color) parts.push(v.color)
              parts.push(formatPrice(v.price ?? p.base_price))
              return `${i + 1}. ${parts.join(' / ')}`
            }).join('\n')
            responseText = `📦 ${p.name} захиалга\n\nАль хувилбарыг сонгох вэ?\n${variantList}\n\nДугаараа бичнэ үү:`
          }
          intent = 'order_collection'
        } else if (inStock.length === 1) {
          const variant = inStock[0]
          const label = [variant.size, variant.color].filter(Boolean).join('/')
          orderDraft = {
            product_id: p.id,
            product_name: p.name,
            variant_id: variant.id,
            variant_label: label || undefined,
            unit_price: variant.price ?? p.base_price,
            quantity: 1,
            step: 'confirm',
          }
          responseText = buildConfirmMessage(orderDraft)
          intent = 'order_collection'
        } else {
          orderDraft = {
            product_id: p.id,
            product_name: p.name,
            unit_price: p.base_price,
            quantity: 1,
            step: 'confirm',
          }
          responseText = buildConfirmMessage(orderDraft)
          intent = 'order_collection'
        }
      }
    }
  }

  // Save AI response + update state + update conversation — all in parallel
  const storedProducts: StoredProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    base_price: p.base_price,
  }))
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
    supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId),
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

/** Order intent words — used to detect order intent in first messages */
const ORDER_INTENT_WORDS = [
  'авъя', 'авья', 'авна', 'авах', 'авйа', 'ави', 'авь',
  'захиалъя', 'захиалья', 'захиалах', 'захиалмаар',
]

function hasOrderIntent(msg: string): boolean {
  const normalized = normalizeText(msg).trim()
  const padded = ` ${normalized} `
  return ORDER_INTENT_WORDS.some((w) => padded.includes(` ${normalizeText(w)} `))
}

function isAffirmative(msg: string): boolean {
  const n = normalizeText(msg).trim()
  const words = ['тийм', 'за', 'зүгээр', 'болно', 'тийм ээ', 'зөв', 'ok', 'ок', 'yes']
  return words.some((w) => n === w || n.startsWith(w + ' '))
}

function extractPhone(msg: string): string | null {
  const match = msg.replace(/\s+/g, '').match(/(\d{8})/)
  return match ? match[1] : null
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

  // Size/color keyword match
  for (const v of variants) {
    if (v.size && normalized.includes(normalizeText(v.size))) return v
    if (v.color && normalized.includes(normalizeText(v.color))) return v
  }

  return null
}

function buildConfirmMessage(draft: OrderDraft): string {
  const lines = [`📦 ${draft.product_name}`]
  if (draft.variant_label) lines.push(`Хувилбар: ${draft.variant_label}`)
  lines.push(`Тоо: ${draft.quantity} ширхэг`)
  lines.push(`Үнэ: ${formatPrice(draft.unit_price * draft.quantity)}`)
  lines.push('\nЗахиалга баталгаажуулах уу? (Тийм/Үгүй)')
  return lines.join('\n')
}

async function createOrderFromChat(
  supabase: SupabaseClient,
  storeId: string,
  customerId: string | null,
  draft: OrderDraft
): Promise<{ order_number: string; total_amount: number } | null> {
  const orderNumber = `ORD-${Date.now()}`
  const totalAmount = draft.unit_price * draft.quantity

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      store_id: storeId,
      customer_id: customerId || null,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount,
      shipping_amount: 0,
      payment_status: 'pending',
      shipping_address: draft.address || null,
      order_type: 'delivery',
      notes: 'Messenger захиалга',
    })
    .select('id, order_number, total_amount')
    .single()

  if (orderError || !newOrder) {
    console.error('[Order] Failed to create:', orderError)
    return null
  }

  await supabase.from('order_items').insert({
    order_id: newOrder.id,
    product_id: draft.product_id,
    variant_id: draft.variant_id || null,
    quantity: draft.quantity,
    unit_price: draft.unit_price,
    variant_label: draft.variant_label || null,
  })

  dispatchNotification(storeId, 'new_order', {
    order_id: newOrder.id,
    order_number: newOrder.order_number,
    total_amount: newOrder.total_amount,
    payment_method: null,
  })

  return { order_number: newOrder.order_number, total_amount: newOrder.total_amount }
}
