import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyIntentWithConfidence,
  searchProducts,
  generateAIResponse,
  generateResponse,
  matchesHandoffKeywords,
  ChatbotSettings,
  LOW_CONFIDENCE_THRESHOLD,
} from '@/lib/chat-ai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, chatWidgetSchema } from '@/lib/validations'
import { interceptWithFlow } from '@/lib/flow-middleware'
import { processEscalation } from '@/lib/escalation'
import { processAIChat } from '@/lib/chat-ai-handler'

const RATE_LIMIT = { limit: 20, windowSeconds: 60 }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()

  const { data: body, error: validationError } = await validateBody(request, chatWidgetSchema)
  if (validationError) return validationError
  const { store_id, customer_message, conversation_id, sender_id } = body

  // Get store with chatbot settings
  const { data: store } = await supabase
    .from('stores')
    .select('name, ai_auto_reply, chatbot_settings')
    .eq('id', store_id)
    .single()

  const storeName = store?.name || 'Манай дэлгүүр'
  const chatbotSettings = (store?.chatbot_settings || {}) as ChatbotSettings
  const aiAutoReply = store?.ai_auto_reply !== false // default true

  // 1. Check for handoff keywords
  if (matchesHandoffKeywords(customer_message, chatbotSettings)) {
    return NextResponse.json({
      response: null,
      intent: 'handoff',
      handoff: true,
    })
  }

  // 2. Check if conversation was already escalated
  if (conversation_id) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('status, escalation_level')
      .eq('id', conversation_id)
      .single()

    if (conv?.status === 'escalated') {
      const escalationMessage =
        chatbotSettings.escalation_message ||
        'Таны хүсэлтийг бид хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно. Түр хүлээнэ үү!'
      return NextResponse.json({
        response: escalationMessage,
        intent: 'escalated',
        handoff: true,
        escalation_level: conv.escalation_level,
      })
    }
  }

  // 3. If AI auto-reply is disabled, return early
  if (!aiAutoReply) {
    return NextResponse.json({
      response: null,
      intent: 'disabled',
      ai_disabled: true,
    })
  }

  // 4. Flow interception (before AI pipeline)
  if (conversation_id) {
    try {
      const flowResult = await interceptWithFlow(
        supabase, conversation_id, store_id, customer_message,
        { is_new_conversation: false }
      )
      if (flowResult) {
        return NextResponse.json(flowResult)
      }
    } catch (flowErr) {
      console.error('[Flow] Widget interception error:', flowErr)
    }
  }

  // 5. Full AI pipeline — use processAIChat when conversation_id exists.
  //    It handles: product search, checkout flow, order drafts, follow-ups, DB saves.
  if (conversation_id) {
    // Resolve customer_id from sender_id if available
    let customerId: string | null = null
    if (sender_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('store_id', store_id)
        .eq('external_id', sender_id)
        .single()
      customerId = customer?.id ?? null
    }

    // Ensure conversation row exists so writeState / processEscalation can
    // UPDATE it. Without this, fresh conversation_ids have no DB row and
    // all state writes silently fail.
    const upsertResult = await supabase
      .from('conversations')
      .upsert(
        {
          id: conversation_id,
          store_id,
          channel: 'web',
          status: 'open',
          customer_id: customerId,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      )
    if (upsertResult.error) {
      console.error('[Widget] conversation upsert failed:', upsertResult.error.message)
    }

    const aiResult = await processAIChat(supabase, {
      conversationId: conversation_id,
      customerMessage: customer_message,
      storeId: store_id,
      storeName,
      customerId,
      chatbotSettings,
    })

    // 6. Smart escalation — evaluate score AFTER AI response is saved
    // Skip escalation for informational intents (customer is just asking questions)
    const INFORMATIONAL_INTENTS = [
      'greeting', 'thanks', 'product_search', 'order_status', 'shipping',
      'payment', 'size_info', 'table_reservation', 'allergen_info',
      'menu_availability', 'order_collection', 'order_created',
      'product_detail', 'price_info', 'gift_card_purchase', 'gift_card_redeem',
    ]
    const shouldCheckEscalation = !INFORMATIONAL_INTENTS.includes(aiResult.intent)

    if (shouldCheckEscalation) {
      const escalationResult = await processEscalation(
        supabase, conversation_id, customer_message, store_id, chatbotSettings
      )

      if (escalationResult.escalated) {
        // Include AI response + escalation notice
        const escalationNotice = escalationResult.escalationMessage ||
          chatbotSettings.escalation_message ||
          'Таны хүсэлтийг бид хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно. Түр хүлээнэ үү!'
        return NextResponse.json({
          response: `${aiResult.response}\n\n---\n\n${escalationNotice}`,
          intent: 'escalated',
          handoff: true,
          products_found: aiResult.metadata.products_found,
        })
      }
    }

    return NextResponse.json({
      response: aiResult.response,
      intent: aiResult.intent,
      products_found: aiResult.metadata.products_found,
      order_step: aiResult.orderStep ?? null,
    })
  }

  // 6. Fallback: no conversation_id — generate response without saving
  //    (Used for anonymous first-message previews)
  const { intent: rawIntent, confidence } = classifyIntentWithConfidence(customer_message)
  const intent = (confidence < LOW_CONFIDENCE_THRESHOLD && rawIntent === 'general')
    ? 'low_confidence'
    : rawIntent

  let products: Awaited<ReturnType<typeof searchProducts>> = []
  if (['product_search', 'general', 'low_confidence', 'size_info'].includes(intent)) {
    products = await searchProducts(supabase, customer_message, store_id, {
      maxProducts: chatbotSettings.max_products,
    })
    if (products.length === 0) {
      products = await searchProducts(supabase, '', store_id, {
        maxProducts: chatbotSettings.max_products,
      })
    }
  }

  const response = await generateAIResponse(
    intent, products, [], storeName, customer_message, chatbotSettings
  )

  return NextResponse.json({
    response,
    intent,
    products_found: products.length,
  })
}
