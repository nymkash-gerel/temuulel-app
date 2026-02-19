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
} from '@/lib/conversation-state'
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

  if (followUp) {
    switch (followUp.type) {
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
    }
  }

  // Save AI response + update state + update conversation — all in parallel
  const storedProducts: StoredProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    base_price: p.base_price,
  }))
  const nextState = updateState(state, intent, storedProducts, customerMessage)

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
  }
}
