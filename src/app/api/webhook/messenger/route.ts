import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  verifyWebhookSignature,
  sendTextMessage,
  sendTypingIndicator,
  sendProductCards,
  sendQuickReplies,
  markSeen,
} from '@/lib/messenger'
import { dispatchNotification } from '@/lib/notifications'
import { processEscalation } from '@/lib/escalation'
import { analyzeMessage, analyzeMessageKeyword } from '@/lib/ai/message-tagger'
import { handleFeedChange, FeedChangeValue } from '@/lib/comment-auto-reply'
import type { ChatbotSettings } from '@/lib/chat-ai'
import { interceptWithFlow } from '@/lib/flow-middleware'
import { processAIChat } from '@/lib/chat-ai-handler'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

// GET - Webhook verification (Facebook sends this when you set up the webhook)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.MESSENGER_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST - Receive messages from Messenger
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) {
    console.error('FACEBOOK_APP_SECRET is not configured — rejecting webhook')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = request.headers.get('x-hub-signature-256')
  const rawBody = await request.text()

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  try {
    const result = await handleWebhookEvents(JSON.parse(rawBody))
    console.log('[Webhook] Processed:', {
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
    return result
  } catch (error) {
    console.error('[Webhook] Failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleWebhookEvents(body: Record<string, unknown>) {
  const supabase = getSupabase()

  // Meta sends both Messenger and Instagram DMs with object='page' or 'instagram'
  if (body.object !== 'page' && body.object !== 'instagram') {
    return NextResponse.json({ status: 'ignored' })
  }

  const isInstagram = body.object === 'instagram'
  const entries = body.entry as Array<{
    id: string
    messaging?: Array<Record<string, unknown>>
    changes?: Array<{ field: string; value: Record<string, unknown> }>
  }> | undefined

  for (const entry of entries || []) {
    const entryId = entry.id

    // Handle feed events (comments) - Comment Auto-Reply feature
    for (const change of entry.changes || []) {
      if (change.field === 'feed') {
        const platform = isInstagram ? 'instagram' : 'facebook'
        try {
          await handleFeedChange(entryId, change.value as unknown as FeedChangeValue, platform)
        } catch (err) {
          console.error('[Webhook] Feed change error:', err)
        }
      }
    }

    // Handle messaging events (DMs)
    for (const event of entry.messaging || []) {
      const senderId = (event.sender as Record<string, string>)?.id
      const message = event.message as Record<string, unknown> | undefined
      const messageText = message?.text as string | undefined
      const quickReplyPayload = (message?.quick_reply as Record<string, string>)?.payload

      if (!senderId || !messageText) continue
      if (messageText.length > 2000) continue

      // Determine channel: try Messenger first (facebook_page_id), then Instagram
      let channel: 'messenger' | 'instagram' = 'messenger'

      let { data: store } = await supabase
        .from('stores')
        .select('id, name, ai_auto_reply, chatbot_settings, facebook_page_access_token')
        .eq('facebook_page_id', entryId)
        .single()

      if (!store) {
        // Try Instagram: entry.id is the Instagram Business Account ID
        const { data: igStore } = await supabase
          .from('stores')
          .select('id, name, ai_auto_reply, chatbot_settings, facebook_page_access_token')
          .eq('instagram_business_account_id', entryId)
          .single()

        if (!igStore) continue
        store = igStore
        channel = 'instagram'
      }

      // Per-store token with fallback to global env for backward compatibility
      const pageToken = store.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN

      // Mark message as seen
      if (pageToken) {
        await markSeen(senderId, pageToken)
      }

      // Find or create customer
      const customerIdField = channel === 'instagram' ? 'instagram_id' : 'messenger_id'

      let { data: customer } = await supabase
        .from('customers')
        .select('id, name')
        .eq(customerIdField, senderId)
        .eq('store_id', store.id)
        .single()

      if (!customer) {
        let customerName = channel === 'instagram' ? 'Instagram хэрэглэгч' : 'Messenger хэрэглэгч'
        if (pageToken) {
          try {
            const profileRes = await fetch(
              `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${pageToken}`
            )
            if (profileRes.ok) {
              const profile = await profileRes.json()
              customerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            }
          } catch {
            // Use default name
          }
        }

        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            store_id: store.id,
            name: customerName,
            [customerIdField]: senderId,
            channel,
          })
          .select('id, name')
          .single()

        customer = newCustomer

        // Dispatch new_customer notification (email + in-app + webhook)
        if (customer) {
          dispatchNotification(store.id, 'new_customer', {
            customer_id: customer.id,
            name: customerName,
            channel,
          })
        }
      }

      if (!customer) continue

      // Find or create conversation
      let isNewConversation = false
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('store_id', store.id)
        .eq('customer_id', customer.id)
        .neq('status', 'closed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (!conversation) {
        isNewConversation = true
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            store_id: store.id,
            customer_id: customer.id,
            channel,
            status: 'active',
          })
          .select('id')
          .single()

        conversation = newConv
      }

      if (!conversation) continue

      // Save customer message
      const { data: savedMsg } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        content: messageText,
        is_from_customer: true,
        is_ai_response: false,
        metadata: quickReplyPayload ? { quick_reply: quickReplyPayload } : {},
      }).select('id').single()

      // Tag message with sentiment + topic tags (fire-and-forget)
      if (savedMsg?.id) {
        void (async () => {
          try {
            const result = await analyzeMessage(messageText) ?? analyzeMessageKeyword(messageText)
            const { data: existing } = await supabase.from('messages').select('metadata').eq('id', savedMsg.id).single()
            const meta = (existing?.metadata ?? {}) as Record<string, unknown>
            await supabase.from('messages').update({
              metadata: { ...meta, sentiment: result.sentiment, tags: result.tags, tagged_at: new Date().toISOString() },
            }).eq('id', savedMsg.id)
          } catch (e) {
            console.error('[message-tagger] Failed:', e)
          }
        })()
      }

      // Update conversation timestamp and increment unread
      const { error: rpcError } = await supabase.rpc('increment_unread', { conv_id: conversation.id })
      if (rpcError) {
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString(), unread_count: 1 })
          .eq('id', conversation.id)
      } else {
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversation.id)
      }

      // Dispatch new_message notification (email + in-app + webhook)
      dispatchNotification(store.id, 'new_message', {
        conversation_id: conversation.id,
        customer_id: customer.id,
        customer_name: customer.name,
        message: messageText,
        channel,
      })

      // Smart escalation check
      const chatbotSettings = (store.chatbot_settings || {}) as ChatbotSettings
      const esc = await processEscalation(
        supabase, conversation.id, messageText, store.id, chatbotSettings
      )
      if (esc.escalated) {
        // Send escalation message to customer via Messenger
        if (pageToken && esc.escalationMessage) {
          await sendTextMessage(senderId, esc.escalationMessage, pageToken)
        }
        continue // Skip AI auto-reply for this escalated message
      }

      // AI auto-reply
      if (store.ai_auto_reply && pageToken) {
        // --- Flow interception (before AI pipeline) ---
        try {
          const flowResult = await interceptWithFlow(
            supabase, conversation.id, store.id, messageText,
            { is_new_conversation: isNewConversation, quick_reply_payload: quickReplyPayload }
          )
          if (flowResult) {
            if (flowResult.quick_replies && flowResult.quick_replies.length > 0) {
              await sendQuickReplies(senderId, flowResult.response, flowResult.quick_replies, pageToken)
            } else if (flowResult.response) {
              await sendTextMessage(senderId, flowResult.response, pageToken)
            }
            continue
          }
        } catch (flowErr) {
          console.error('[Flow] Messenger interception error:', flowErr)
          // Fall through to normal AI pipeline
        }

        try {
          // Show typing indicator
          await sendTypingIndicator(senderId, true, pageToken)

          const aiResult = await processAIChat(supabase, {
            conversationId: conversation.id,
            customerMessage: messageText,
            storeId: store.id,
            storeName: store.name || 'Манай дэлгүүр',
            customerId: customer.id,
            chatbotSettings,
          })

          // Turn off typing
          await sendTypingIndicator(senderId, false, pageToken)

          const aiResponse = aiResult.response
          const aiIntent = aiResult.intent
          console.log('[AI] Intent:', aiIntent, 'Response length:', aiResponse?.length ?? 0)

          if (aiResponse) {
            let sendResult
            // If product_search intent with products found, send cards + text
            if (aiIntent === 'product_search' && aiResult.metadata?.products_found > 0) {
              await sendProductCardsForIntent(
                senderId, store.id, aiResponse, pageToken, supabase
              )
            } else if (aiIntent === 'greeting' || aiIntent === 'general') {
              // Send with quick reply suggestions
              sendResult = await sendQuickReplies(
                senderId,
                aiResponse,
                [
                  { title: 'Бүтээгдэхүүн', payload: 'BROWSE_PRODUCTS' },
                  { title: 'Захиалга шалгах', payload: 'CHECK_ORDER' },
                  { title: 'Хүргэлт', payload: 'SHIPPING_INFO' },
                ],
                pageToken
              )
            } else {
              sendResult = await sendTextMessage(senderId, aiResponse, pageToken)
            }
            console.log('[Messenger] Send result:', sendResult ? 'sent' : 'failed')
          } else {
            console.warn('[AI] No response text returned')
          }
        } catch (aiErr) {
          console.error('[AI] Exception:', aiErr instanceof Error ? aiErr.message : aiErr)
        }
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}

/**
 * Fetch products from DB and send as Messenger cards
 */
async function sendProductCardsForIntent(
  recipientId: string,
  storeId: string,
  textFallback: string,
  pageToken: string,
  supabase: ReturnType<typeof getSupabase>
) {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, base_price, images, description')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .limit(5)

  // Always send the AI text response first (has natural language + prices)
  await sendTextMessage(recipientId, textFallback, pageToken)

  if (products && products.length > 0) {
    const cards = products.map((p) => {
      const images = (p.images || []) as string[]
      const price = new Intl.NumberFormat('mn-MN').format(p.base_price) + '₮'
      // Always include price in subtitle, then short description
      const desc = p.description
        ? `💰 ${price}\n${p.description.substring(0, 60)}`
        : `💰 ${price}`
      return {
        title: p.name,
        subtitle: desc,
        imageUrl: images[0] || undefined,
      }
    })

    await sendProductCards(recipientId, cards, pageToken)
  }
}
