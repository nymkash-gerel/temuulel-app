import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyIntentWithConfidence,
  searchProducts,
  generateAIResponse,
  generateResponse,
  formatPrice,
  matchesHandoffKeywords,
  fetchRecentMessages,
  ChatbotSettings,
  LOW_CONFIDENCE_THRESHOLD,
} from '@/lib/chat-ai'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, chatWidgetSchema } from '@/lib/validations'
import {
  readState,
  writeState,
  emptyState,
  resolveFollowUp,
  updateState,
  StoredProduct,
} from '@/lib/conversation-state'
import { isOpenAIConfigured } from '@/lib/ai/openai-client'
import { interceptWithFlow } from '@/lib/flow-middleware'

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

  const { data: body, error: validationError } = await validateBody(request, chatWidgetSchema)
  if (validationError) return validationError
  const { store_id, customer_message, conversation_id } = body

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

  // Check if conversation was already escalated (score is evaluated in /api/chat POST)
  let convMeta: Record<string, unknown> = {}
  if (conversation_id) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('status, escalation_level, metadata')
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

    convMeta = (conv?.metadata ?? {}) as Record<string, unknown>
  }

  // If AI auto-reply is disabled, don't generate a response
  if (!aiAutoReply) {
    return NextResponse.json({
      response: null,
      intent: 'disabled',
      ai_disabled: true,
    })
  }

  // Extract active vouchers from conversation metadata (if any)
  const activeVouchers = (convMeta.active_vouchers as { voucher_code: string; compensation_type: string; compensation_value: number; valid_until: string }[] | undefined) || undefined

  // --- Flow interception (before AI pipeline) ---
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
      // Fall through to normal AI pipeline
    }
  }

  // --- Conversation Memory ---
  const state = conversation_id
    ? await readState(supabase, conversation_id)
    : emptyState()

  // Check for follow-ups (keyword tier — free, deterministic)
  const followUp = resolveFollowUp(customer_message, state)

  let intent: string
  let products: Awaited<ReturnType<typeof searchProducts>> = []
  let response: string

  if (followUp) {
    // Handle follow-up without re-classifying intent
    switch (followUp.type) {
      case 'number_reference':
      case 'select_single': {
        const p = followUp.product!
        intent = 'product_detail'
        // Fetch full product details for the selected product
        const { data: selectedProducts } = await supabase
          .from('products')
          .select('id, name, description, category, base_price, images, sales_script, product_faqs')
          .eq('id', p.id)
        products = (selectedProducts || []) as Awaited<ReturnType<typeof searchProducts>>
        // Fetch history for LLM tier
        const selectHistory = conversation_id && isOpenAIConfigured()
          ? await fetchRecentMessages(supabase, conversation_id)
          : undefined
        response = await generateAIResponse(
          intent, products, [], storeName, customer_message, chatbotSettings, selectHistory
        )
        break
      }
      case 'price_question': {
        intent = 'price_info'
        const priceList = followUp.products!
          .map((p, i) => `${i + 1}. ${p.name} — ${formatPrice(p.base_price)}`)
          .join('\n')
        response = `Үнийн мэдээлэл:\n\n${priceList}`
        break
      }
      case 'size_question': {
        intent = 'size_info'
        // Fetch full product details for the stored products
        const storedIds = followUp.products!.map((p) => p.id)
        const { data: fullProducts } = await supabase
          .from('products')
          .select('id, name, description, category, base_price, images, sales_script, product_faqs')
          .in('id', storedIds)
        products = (fullProducts || []) as Awaited<ReturnType<typeof searchProducts>>
        // Check if the customer provided body measurements (height, weight, pregnancy months, etc.)
        // In that case, the FAQ chart alone isn't enough — LLM should recommend a specific size.
        const hasBodyMeasurements = /\d+\s*(кг|kg|см|cm|сартай|сар\b|sartai|sar\b)/i.test(customer_message)
        // Try FAQ answer first (avoids LLM call) — but only for generic "what sizes?" questions
        const sizeFaqs = hasBodyMeasurements ? [] : products
          .map((p) => p.product_faqs?.size_fit ? `**${p.name}**: ${p.product_faqs.size_fit}` : null)
          .filter(Boolean)
        if (sizeFaqs.length > 0) {
          response = sizeFaqs.join('\n\n')
        } else {
          const sizeHistory = conversation_id && isOpenAIConfigured()
            ? await fetchRecentMessages(supabase, conversation_id)
            : undefined
          response = await generateAIResponse(
            intent, products, [], storeName, customer_message, chatbotSettings, sizeHistory
          )
        }
        break
      }
      case 'contextual_question': {
        // Map topic to intent for response generation
        const topicIntentMap: Record<string, string> = {
          delivery: 'delivery_info',
          order: 'order_info',
          payment: 'payment_info',
          material: 'product_detail',
          warranty: 'warranty_info',
          stock: 'stock_info',
          detail: 'product_detail',
        }
        intent = topicIntentMap[followUp.contextTopic!] || 'general'
        // Map context topic to FAQ key
        const faqKeyMap: Record<string, string> = {
          material: 'material',
          warranty: 'warranty',
          delivery: 'delivery',
          detail: 'care',
        }
        // Fetch full product details for the stored products
        const ctxIds = followUp.products!.map((p) => p.id)
        const { data: ctxProducts } = await supabase
          .from('products')
          .select('id, name, description, category, base_price, images, sales_script, product_faqs')
          .in('id', ctxIds)
        products = (ctxProducts || []) as Awaited<ReturnType<typeof searchProducts>>
        // Try FAQ answer first (avoids LLM call)
        const faqKey = faqKeyMap[followUp.contextTopic!]
        const ctxFaqs = faqKey
          ? products
              .map((p) => p.product_faqs?.[faqKey] ? `**${p.name}**: ${p.product_faqs[faqKey]}` : null)
              .filter(Boolean)
          : []
        if (ctxFaqs.length > 0) {
          response = ctxFaqs.join('\n\n')
        } else {
          const ctxHistory = conversation_id && isOpenAIConfigured()
            ? await fetchRecentMessages(supabase, conversation_id)
            : undefined
          response = await generateAIResponse(
            intent, products, [], storeName, customer_message, chatbotSettings, ctxHistory
          )
        }
        break
      }
      case 'query_refinement': {
        intent = 'product_search'
        products = await searchProducts(
          supabase,
          followUp.refinedQuery!,
          store_id,
          { maxProducts: chatbotSettings.max_products }
        )
        // Fetch history for LLM tier
        const refHistory = conversation_id && isOpenAIConfigured()
          ? await fetchRecentMessages(supabase, conversation_id)
          : undefined
        response = await generateAIResponse(
          intent, products, [], storeName, followUp.refinedQuery!, chatbotSettings, refHistory
        )
        break
      }
      case 'prefer_llm': {
        // Classify normally but force LLM context
        const { intent: llmIntent } = classifyIntentWithConfidence(customer_message)
        intent = llmIntent

        if (intent === 'product_search' || intent === 'general') {
          products = await searchProducts(
            supabase, customer_message, store_id, { maxProducts: chatbotSettings.max_products }
          )
        }

        // Always fetch history — that's the whole point of prefer_llm
        const llmHistory = conversation_id && isOpenAIConfigured()
          ? await fetchRecentMessages(supabase, conversation_id)
          : undefined
        response = await generateAIResponse(
          intent, products, [], storeName, customer_message, chatbotSettings, llmHistory
        )
        break
      }
      default:
        intent = 'general'
        response = generateResponse(intent, products, [], storeName, chatbotSettings)
    }
  } else {
    // Normal classification path
    const { intent: rawIntent, confidence } = classifyIntentWithConfidence(customer_message)
    intent = (confidence < LOW_CONFIDENCE_THRESHOLD && rawIntent === 'general')
      ? 'low_confidence'
      : rawIntent

    if (intent === 'product_search' || intent === 'general' || intent === 'low_confidence' || intent === 'size_info') {
      products = await searchProducts(
        supabase,
        customer_message,
        store_id,
        { maxProducts: chatbotSettings.max_products }
      )

      // If no products found, fetch suggested products as fallback
      if (products.length === 0) {
        products = await searchProducts(supabase, '', store_id, { maxProducts: chatbotSettings.max_products })
        if (products.length > 0) {
          // Override intent so response template shows "suggested" framing
          intent = 'product_suggestions'
        }
      }
    }

    // Fetch history for LLM tier (only if OpenAI configured + conversation exists)
    const history = conversation_id && isOpenAIConfigured()
      ? await fetchRecentMessages(supabase, conversation_id)
      : undefined

    response = await generateAIResponse(
      intent, products, [], storeName, customer_message, chatbotSettings, history, activeVouchers
    )
  }

  // If we have a conversation_id, save response + update state
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
          follow_up: followUp?.type ?? null,
        },
      })

    // Update conversation state
    const storedProducts: StoredProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      base_price: p.base_price,
    }))
    const nextState = updateState(
      state,
      intent,
      storedProducts,
      customer_message
    )
    await writeState(supabase, conversation_id, nextState)

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
