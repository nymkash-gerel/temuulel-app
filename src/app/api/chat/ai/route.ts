import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyIntent,
  extractSearchTerms,
  searchProducts,
  searchOrders,
  generateResponse,
  ChatbotSettings,
} from '@/lib/chat-ai'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()
  const { conversation_id, customer_message } = body

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

  // Classify intent
  const intent = classifyIntent(customer_message)

  // Search for relevant data based on intent
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  let orders: Awaited<ReturnType<typeof searchOrders>> = []

  if (intent === 'product_search' || intent === 'general') {
    const searchTerms = extractSearchTerms(customer_message)
    products = await searchProducts(supabase, searchTerms, storeId, chatbotSettings.max_products)
  }

  if (intent === 'order_status') {
    const searchTerms = extractSearchTerms(customer_message)
    orders = await searchOrders(supabase, searchTerms, storeId, customerId ?? undefined)
  }

  // Generate response
  const responseText = generateResponse(intent, products, orders, storeName, chatbotSettings)

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
      },
    })
    .select('id, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update conversation
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
