import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyIntent,
  extractSearchTerms,
  searchProducts,
  searchOrders,
  generateAIResponse,
  generateResponse,
  formatPrice,
  fetchRecentMessages,
  ChatbotSettings,
} from '@/lib/chat-ai'
import {
  readState,
  writeState,
  resolveFollowUp,
  updateState,
  StoredProduct,
} from '@/lib/conversation-state'
import { isOpenAIConfigured } from '@/lib/ai/openai-client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { conversation_id, customer_message, store_id, is_comment, context } = body

  // Comment-based AI (no conversation required)
  if (is_comment && store_id) {
    return handleCommentAI(supabase, store_id, customer_message, context)
  }

  if (!conversation_id || !customer_message) {
    return NextResponse.json(
      { error: 'conversation_id and customer_message required' },
      { status: 400 }
    )
  }

  // Get conversation with store info including chatbot settings
  const { data: conversation } = await supabase
    .from('conversations')
    .select(`
      *,
      customers(id, name),
      stores(id, name, chatbot_settings, ai_auto_reply)
    `)
    .eq('id', conversation_id)
    .single()

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const storeId = conversation.store_id
  const storeName = conversation.stores?.name || 'Манай дэлгүүр'
  const customerId = conversation.customer_id
  const chatbotSettings = (conversation.stores?.chatbot_settings || {}) as ChatbotSettings

  // --- Conversation Memory ---
  const state = await readState(supabase, conversation_id)
  const followUp = resolveFollowUp(customer_message, state)

  let intent: string
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  let orders: Awaited<ReturnType<typeof searchOrders>> = []
  let responseText: string

  if (followUp) {
    // Handle follow-up without re-classifying intent
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
        products = await searchProducts(
          supabase,
          followUp.refinedQuery!,
          storeId,
          chatbotSettings.max_products
        )
        const refHistory = isOpenAIConfigured()
          ? await fetchRecentMessages(supabase, conversation_id)
          : undefined
        responseText = await generateAIResponse(
          intent, products, orders, storeName, followUp.refinedQuery!, chatbotSettings, refHistory
        )
        break
      }
      case 'prefer_llm': {
        intent = classifyIntent(customer_message)

        if (intent === 'product_search' || intent === 'general') {
          const searchTerms = extractSearchTerms(customer_message)
          products = await searchProducts(supabase, searchTerms, storeId, chatbotSettings.max_products)
        }
        if (intent === 'order_status') {
          const searchTerms = extractSearchTerms(customer_message)
          orders = await searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
        }

        const llmHistory = isOpenAIConfigured()
          ? await fetchRecentMessages(supabase, conversation_id)
          : undefined
        responseText = await generateAIResponse(
          intent, products, orders, storeName, customer_message, chatbotSettings, llmHistory
        )
        break
      }
      default:
        intent = 'general'
        responseText = generateResponse(intent, products, orders, storeName, chatbotSettings)
    }
  } else {
    // Normal classification path
    intent = classifyIntent(customer_message)

    if (intent === 'product_search' || intent === 'general') {
      const searchTerms = extractSearchTerms(customer_message)
      products = await searchProducts(supabase, searchTerms, storeId, chatbotSettings.max_products)
    }

    if (intent === 'order_status') {
      const searchTerms = extractSearchTerms(customer_message)
      orders = await searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
    }

    // Fetch history for LLM tier
    const history = isOpenAIConfigured()
      ? await fetchRecentMessages(supabase, conversation_id)
      : undefined

    responseText = await generateAIResponse(
      intent, products, orders, storeName, customer_message, chatbotSettings, history
    )
  }

  // Save AI response as a message
  const { data: savedMessage, error } = await supabase
    .from('messages')
    .insert({
      conversation_id,
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
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update conversation state
  const storedProducts: StoredProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    base_price: p.base_price,
  }))
  const nextState = updateState(state, intent, storedProducts, customer_message)
  await writeState(supabase, conversation_id, nextState)

  // Update conversation timestamp
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversation_id)

  return NextResponse.json({
    response: responseText,
    intent,
    message_id: savedMessage?.id,
    metadata: {
      products_found: products.length,
      orders_found: orders.length,
    },
  })
}

/**
 * Handle AI response for comment auto-reply (no conversation context)
 */
async function handleCommentAI(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  customerMessage: string,
  additionalContext?: string
) {
  // Get store info
  const { data: store } = await supabase
    .from('stores')
    .select('id, name, chatbot_settings')
    .eq('id', storeId)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const storeName = store.name || 'Манай дэлгүүр'
  const chatbotSettings = (store.chatbot_settings || {}) as ChatbotSettings

  // Prepend context to the message if provided
  const messageWithContext = additionalContext
    ? `[Контекст: ${additionalContext}]\n\n${customerMessage}`
    : customerMessage

  // Classify intent
  const intent = classifyIntent(customerMessage)

  // Search products if relevant
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  if (intent === 'product_search' || intent === 'general' || intent === 'price_info') {
    const searchTerms = extractSearchTerms(customerMessage)
    products = await searchProducts(supabase, searchTerms, storeId, chatbotSettings.max_products || 5)
  }

  // Generate AI response (no history for comments)
  const responseText = await generateAIResponse(
    intent,
    products,
    [], // No orders for comment replies
    storeName,
    messageWithContext,
    chatbotSettings,
    undefined // No conversation history
  )

  return NextResponse.json({
    response: responseText,
    intent,
    metadata: {
      products_found: products.length,
      is_comment_reply: true,
    },
  })
}
