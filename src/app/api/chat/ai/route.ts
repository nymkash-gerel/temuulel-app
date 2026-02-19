import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyIntent,
  extractSearchTerms,
  searchProducts,
  generateAIResponse,
  ChatbotSettings,
} from '@/lib/chat-ai'
import { interceptWithFlow } from '@/lib/flow-middleware'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import { addBreadcrumb } from '@/lib/sentry-helpers'
import { processAIChat } from '@/lib/chat-ai-handler'

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

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

  const log = createRequestLogger(crypto.randomUUID(), '/api/chat/ai', { storeId })
  log.info('AI chat request', { conversation_id })

  // --- Flow interception (before AI pipeline) ---
  try {
    const flowResult = await interceptWithFlow(
      supabase, conversation_id, storeId, customer_message,
      { is_new_conversation: false }
    )
    if (flowResult) {
      return NextResponse.json(flowResult)
    }
  } catch (flowErr) {
    console.error('[Flow] AI route interception error:', flowErr)
  }

  // --- AI pipeline (shared with webhook) ---
  try {
    const result = await processAIChat(supabase, {
      conversationId: conversation_id,
      customerMessage: customer_message,
      storeId,
      storeName,
      customerId,
      chatbotSettings,
    })

    void addBreadcrumb('ai.intent', `Classified intent: ${result.intent}`, {
      intent: result.intent,
      productsFound: result.metadata.products_found,
      ordersFound: result.metadata.orders_found,
    })

    return NextResponse.json({
      response: result.response,
      intent: result.intent,
      message_id: result.messageId,
      metadata: result.metadata,
    })
  } catch (err) {
    log.error('AI processing failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
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

  const messageWithContext = additionalContext
    ? `[Контекст: ${additionalContext}]\n\n${customerMessage}`
    : customerMessage

  const intent = classifyIntent(customerMessage)

  let products: Awaited<ReturnType<typeof searchProducts>> = []
  if (intent === 'product_search' || intent === 'general' || intent === 'price_info') {
    const searchTerms = extractSearchTerms(customerMessage)
    products = await searchProducts(supabase, searchTerms, storeId, { maxProducts: chatbotSettings.max_products || 5 })
  }

  const responseText = await generateAIResponse(
    intent,
    products,
    [],
    storeName,
    messageWithContext,
    chatbotSettings,
    undefined
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
