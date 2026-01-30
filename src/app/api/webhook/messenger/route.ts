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

  return handleWebhookEvents(JSON.parse(rawBody))
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
        try {
          // Show typing indicator
          await sendTypingIndicator(senderId, true, pageToken)

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const aiRes = await fetch(`${appUrl}/api/chat/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversation_id: conversation.id,
              customer_message: messageText,
            }),
          })

          // Turn off typing
          await sendTypingIndicator(senderId, false, pageToken)

          if (aiRes.ok) {
            const aiData = await aiRes.json()
            const aiResponse = typeof aiData?.response === 'string' ? aiData.response : null
            const aiIntent = typeof aiData?.intent === 'string' ? aiData.intent : null

            if (aiResponse) {
              // If product_search intent with products found, send cards + text
              if (aiIntent === 'product_search' && aiData.metadata?.products_found > 0) {
                await sendProductCardsForIntent(
                  senderId, store.id, aiResponse, pageToken, supabase
                )
              } else if (aiIntent === 'greeting' || aiIntent === 'general') {
                // Send with quick reply suggestions
                await sendQuickReplies(
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
                await sendTextMessage(senderId, aiResponse, pageToken)
              }
            }
          }
        } catch {
          // AI response failed, admin will handle manually
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

  if (products && products.length > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const cards = products.map((p) => {
      const images = (p.images || []) as string[]
      const price = new Intl.NumberFormat('mn-MN').format(p.base_price) + '₮'
      return {
        title: p.name,
        subtitle: price,
        imageUrl: images[0] || undefined,
        buttonUrl: appUrl ? `${appUrl}/products/${p.id}` : undefined,
        buttonTitle: 'Дэлгэрэнгүй',
      }
    })

    await sendProductCards(recipientId, cards, pageToken)
  } else {
    // Fall back to text
    await sendTextMessage(recipientId, textFallback, pageToken)
  }
}
