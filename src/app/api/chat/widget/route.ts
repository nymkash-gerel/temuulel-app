import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyIntent,
  searchProducts,
  generateResponse,
  matchesHandoffKeywords,
  ChatbotSettings,
} from '@/lib/chat-ai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const RATE_LIMIT = { limit: 20, windowSeconds: 60 }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()
  const body = await request.json()
  const { store_id, customer_message, sender_id, conversation_id } = body

  if (!store_id || !customer_message) {
    return NextResponse.json(
      { error: 'store_id and customer_message required' },
      { status: 400 }
    )
  }

  // Get store with chatbot settings
  const { data: store } = await supabase
    .from('stores')
    .select('name, ai_auto_reply, chatbot_settings')
    .eq('id', store_id)
    .single()

  const storeName = store?.name || 'Манай дэлгүүр'
  const chatbotSettings = (store?.chatbot_settings || {}) as ChatbotSettings
  const aiAutoReply = store?.ai_auto_reply !== false // default true

  // Check for handoff keywords
  if (matchesHandoffKeywords(customer_message, chatbotSettings)) {
    return NextResponse.json({
      response: null,
      intent: 'handoff',
      handoff: true,
    })
  }

  // If AI auto-reply is disabled, don't generate a response
  if (!aiAutoReply) {
    return NextResponse.json({
      response: null,
      intent: 'disabled',
      ai_disabled: true,
    })
  }

  const intent = classifyIntent(customer_message)

  // Search products if needed
  let products: Awaited<ReturnType<typeof searchProducts>> = []

  if (intent === 'product_search' || intent === 'general') {
    products = await searchProducts(
      supabase,
      customer_message,
      store_id,
      chatbotSettings.max_products
    )
  }

  const response = generateResponse(intent, products, [], storeName, chatbotSettings)

  // If we have a conversation_id, save the AI response directly
  if (conversation_id) {
    await supabase
      .from('messages')
      .insert({
        conversation_id,
        content: response,
        is_from_customer: false,
        is_ai_response: true,
        metadata: {
          intent,
          products_found: products.length,
        },
      })

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id)
  }

  return NextResponse.json({
    response,
    intent,
    products_found: products.length,
  })
}
