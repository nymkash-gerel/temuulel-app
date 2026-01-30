import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchNotification } from '@/lib/notifications'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { processEscalation } from '@/lib/escalation'
import { analyzeMessage, analyzeMessageKeyword } from '@/lib/ai/message-tagger'
import type { ChatbotSettings } from '@/lib/chat-ai'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }
const MAX_CONTENT_LENGTH = 2000

/** Fire-and-forget: tag a customer message with sentiment + topic tags. */
async function tagMessage(
  supabase: ReturnType<typeof getSupabase>,
  messageId: string,
  text: string
) {
  try {
    const result = await analyzeMessage(text) ?? analyzeMessageKeyword(text)
    const { data: existing } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', messageId)
      .single()
    const meta = (existing?.metadata ?? {}) as Record<string, unknown>
    await supabase
      .from('messages')
      .update({
        metadata: {
          ...meta,
          sentiment: result.sentiment,
          tags: result.tags,
          tagged_at: new Date().toISOString(),
        },
      })
      .eq('id', messageId)
  } catch (e) {
    console.error('[message-tagger] Failed:', e)
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase credentials not configured')
  }

  return createClient(url, key)
}

/**
 * Resolve or create a customer and conversation for a given sender.
 * This bridges the widget (which uses sender_id) into the
 * conversations/messages tables that the dashboard reads.
 */
async function resolveConversation(
  supabase: ReturnType<typeof getSupabase>,
  senderId: string,
  storeId: string,
  channel: string
) {
  // 1. Find or create customer by channel identifier
  const channelField = channel === 'messenger' ? 'messenger_id'
    : channel === 'instagram' ? 'instagram_id'
    : channel === 'whatsapp' ? 'whatsapp_id'
    : 'messenger_id' // web visitors use messenger_id field with web_ prefix

  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('store_id', storeId)
    .eq(channelField, senderId)
    .single()

  if (!customer) {
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        store_id: storeId,
        name: null,
        [channelField]: senderId,
        channel,
      })
      .select('id')
      .single()

    if (error) throw new Error('Failed to create customer: ' + error.message)
    customer = newCustomer
  }

  // 2. Find or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('store_id', storeId)
    .eq('customer_id', customer!.id)
    .in('status', ['active', 'pending'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!conversation) {
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        store_id: storeId,
        customer_id: customer!.id,
        status: 'active',
        channel,
        unread_count: 0,
      })
      .select('id')
      .single()

    if (error) throw new Error('Failed to create conversation: ' + error.message)
    conversation = newConv
  }

  return {
    customerId: customer!.id,
    conversationId: conversation!.id,
  }
}

// GET - Retrieve session and recent messages
export async function GET(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()
  const searchParams = request.nextUrl.searchParams
  const senderId = searchParams.get('sender_id')
  const storeId = searchParams.get('store_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  if (!senderId || !storeId) {
    return NextResponse.json({ error: 'sender_id and store_id required' }, { status: 400 })
  }

  try {
    const channel = senderId.startsWith('web_') ? 'web' : 'messenger'
    const { conversationId } = await resolveConversation(
      supabase, senderId, storeId, channel
    )

    // Get the most recent N messages (DESC), then reverse for chronological order
    const { data: messages } = await supabase
      .from('messages')
      .select('id, content, is_from_customer, is_ai_response, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    const recentMessages = (messages || []).reverse().map((m) => ({
      role: m.is_from_customer ? 'user' : 'assistant',
      content: m.content,
      created_at: m.created_at,
      is_ai_response: m.is_ai_response,
    }))

    return NextResponse.json({
      conversation_id: conversationId,
      messages: recentMessages,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST - Save a message and optionally auto-reply with AI
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = getSupabase()
  const body = await request.json()
  const { sender_id, store_id, role, content, metadata } = body

  if (!sender_id || !role || !content) {
    return NextResponse.json(
      { error: 'sender_id, role, and content required' },
      { status: 400 }
    )
  }

  if (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `content must be a string of at most ${MAX_CONTENT_LENGTH} characters` },
      { status: 400 }
    )
  }

  const effectiveStoreId = store_id || ''
  if (!effectiveStoreId) {
    return NextResponse.json({ error: 'store_id required' }, { status: 400 })
  }

  try {
    const channel = sender_id.startsWith('web_') ? 'web' : 'messenger'
    const { conversationId } = await resolveConversation(
      supabase, sender_id, effectiveStoreId, channel
    )

    const isFromCustomer = role === 'user'

    // Save to messages table (conversations system)
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        is_from_customer: isFromCustomer,
        is_ai_response: role === 'assistant' && (metadata?.is_ai || true),
        metadata: metadata || {},
      })
      .select('id, created_at')
      .single()

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Tag customer message with sentiment + topic tags (fire-and-forget)
    if (isFromCustomer && message?.id) {
      void tagMessage(supabase, message.id, content)
    }

    // Update conversation timestamp and unread count
    if (isFromCustomer) {
      // Try RPC first, fall back to direct update
      const { error: rpcError } = await supabase.rpc('increment_unread', { conv_id: conversationId })

      if (rpcError) {
        // Fallback if RPC doesn't exist
        await supabase
          .from('conversations')
          .update({
            updated_at: new Date().toISOString(),
            unread_count: 1,
          })
          .eq('id', conversationId)
      } else {
        // Also update conversation timestamp
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
      }
    }

    // Dispatch new_message notification for customer messages
    if (isFromCustomer && effectiveStoreId) {
      dispatchNotification(effectiveStoreId, 'new_message', {
        conversation_id: conversationId,
        customer_name: sender_id,
        message: content,
        channel: channel,
      })

      // Smart escalation — evaluate and update score
      const { data: storeData } = await supabase
        .from('stores')
        .select('chatbot_settings')
        .eq('id', effectiveStoreId)
        .single()

      const chatbotSettings = (storeData?.chatbot_settings || {}) as ChatbotSettings
      await processEscalation(
        supabase, conversationId, content, effectiveStoreId, chatbotSettings
      )
    }

    return NextResponse.json({
      conversation_id: conversationId,
      message_id: message.id,
      created_at: message.created_at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
