import { createClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  verifyWebhookSignature,
  sendTextMessage,
  sendTypingIndicator,
  sendProductCards,
  sendQuickReplies,
  markSeen,
} from '@/lib/messenger'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { dispatchNotification } from '@/lib/notifications'
import { processEscalation } from '@/lib/escalation'
import { analyzeMessage, analyzeMessageKeyword } from '@/lib/ai/message-tagger'
import { handleFeedChange, FeedChangeValue } from '@/lib/comment-auto-reply'
import type { ChatbotSettings } from '@/lib/chat-ai'
import { interceptWithFlow } from '@/lib/flow-middleware'
import { findActivePartialPayment, handlePartialPaymentReply } from '@/lib/partial-payment-agent'
import { processAIChat, type AIProductCard } from '@/lib/chat-ai-handler'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
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

const RATE_LIMIT = { limit: 100, windowSeconds: 60 }

// POST - Receive messages from Messenger
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

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

  // Return 200 to Facebook immediately — Facebook times out after 5 seconds.
  // Process messages in the background after the response is sent.
  const body = JSON.parse(rawBody) as Record<string, unknown>
  after(async () => {
    try {
      await handleWebhookEvents(body)
      console.log('[Webhook] Processed:', {
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      console.error('[Webhook] Failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      })
    }
  })

  return NextResponse.json({ status: 'ok' })
}

async function handleWebhookEvents(body: Record<string, unknown>): Promise<void> {
  const supabase = getSupabase()

  // Meta sends both Messenger and Instagram DMs with object='page' or 'instagram'
  if (body.object !== 'page' && body.object !== 'instagram') {
    return
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

      // Mark message as seen (fire-and-forget — visual only)
      if (pageToken) {
        void markSeen(senderId, pageToken).catch(err => console.error("[silent-catch]", err))
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

      // Save customer message + increment unread — in parallel
      const [{ data: savedMsg }] = await Promise.all([
        supabase.from('messages').insert({
          conversation_id: conversation.id,
          content: messageText,
          is_from_customer: true,
          is_ai_response: false,
          metadata: quickReplyPayload ? { quick_reply: quickReplyPayload } : {},
        }).select('id').single(),
        (async () => {
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
        })(),
      ])

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

      // Dispatch new_message notification (fire-and-forget)
      dispatchNotification(store.id, 'new_message', {
        conversation_id: conversation.id,
        customer_id: customer.id,
        customer_name: customer.name,
        message: messageText,
        channel,
      })

      // Smart escalation check — runs after AI reply, only for complaint/frustration intents
      const chatbotSettings = (store.chatbot_settings || {}) as ChatbotSettings

      // AI auto-reply
      if (store.ai_auto_reply && pageToken) {
        // --- Redelivery quick reply interception ---
        if (quickReplyPayload?.startsWith('REDELIVERY_')) {
          try {
            const [action, delId] = [quickReplyPayload.split(':')[0], quickReplyPayload.split(':')[1]]
            let redeliveryMsg = ''
            if (action === 'REDELIVERY_CANCEL') {
              await supabase.from('deliveries').update({ status: 'cancelled', notes: 'Харилцагч цуцалсан' }).eq('id', delId)
              redeliveryMsg = 'Захиалга цуцлагдлаа. Баярлалаа!'
            } else {
              let etaLabel = ''
              let etaDate = new Date()
              if (action === 'REDELIVERY_TODAY') { etaLabel = 'Өнөөдөр'; etaDate = new Date() }
              else if (action === 'REDELIVERY_TOMORROW') { etaLabel = 'Маргааш'; etaDate = new Date(Date.now() + 24 * 60 * 60 * 1000) }
              else if (action === 'REDELIVERY_WEEK') { etaLabel = 'Энэ 7 хоногт'; etaDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
              await supabase.from('deliveries').update({
                status: 'pending',
                driver_id: null,
                notes: `Дахин хүргэлт: ${etaLabel}`,
                estimated_delivery_time: etaDate.toISOString(),
              }).eq('id', delId)
              redeliveryMsg = `Баярлалаа! ${etaLabel} хүргэхээр бүртгэлээ.`
              // Notify staff
              const { data: rdel } = await supabase.from('deliveries').select('delivery_number, store_id').eq('id', delId).single()
              if (rdel) {
                await supabase.from('notifications').insert({
                  store_id: rdel.store_id, type: 'delivery_assigned',
                  title: '📦 Дахин хүргэлт баталгаажлаа',
                  body: `#${rdel.delivery_number}: Харилцагч "${etaLabel}" гэж баталлаа.`,
                  data: { delivery_id: delId },
                }).then(null, () => {})
                // Telegram notify
                const rdBotToken = process.env.TELEGRAM_BOT_TOKEN
                if (rdBotToken) {
                  const rdChatIds: string[] = []
                  const { data: rdStaff } = await supabase.from('staff').select('telegram_chat_id').eq('store_id', rdel.store_id).not('telegram_chat_id', 'is', null)
                  for (const s of (rdStaff || []) as Array<{ telegram_chat_id: string }>) {
                    if (s.telegram_chat_id && !rdChatIds.includes(s.telegram_chat_id)) rdChatIds.push(s.telegram_chat_id)
                  }
                  const { data: rdMembers } = await supabase.from('store_members').select('telegram_chat_id, notification_preferences').eq('store_id', rdel.store_id).not('telegram_chat_id', 'is', null)
                  for (const m of (rdMembers || []) as Array<{ telegram_chat_id: string; notification_preferences: Record<string, boolean> | null }>) {
                    if (m.telegram_chat_id && (m.notification_preferences || {} as Record<string, boolean>).delivery !== false && !rdChatIds.includes(m.telegram_chat_id)) rdChatIds.push(m.telegram_chat_id)
                  }
                  const rdTgMsg = `📦 <b>ДАХИН ХҮРГЭЛТ БАТАЛГААЖЛАА</b>\n\n🆔 #${rdel.delivery_number}\n📅 ${etaLabel}\n\nЖолооч оноож хүргүүлнэ үү.`
                  for (const cid of rdChatIds) {
                    await fetch(`https://api.telegram.org/bot${rdBotToken}/sendMessage`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ chat_id: cid, text: rdTgMsg, parse_mode: 'HTML' }),
                    }).catch(err => console.error("[silent-catch]", err))
                  }
                }
              }
            }
            await sendTextMessage(senderId, redeliveryMsg, pageToken)
            await supabase.from('messages').insert({
              conversation_id: conversation.id, content: redeliveryMsg,
              is_from_customer: false, is_ai_response: true,
              metadata: { type: 'redelivery_response', delivery_id: delId },
            })
            continue
          } catch (rdErr) {
            console.error('[Redelivery] Quick reply error:', rdErr)
          }
        }

        // --- Partial payment agent interception ---
        try {
          const ppActive = await findActivePartialPayment(supabase, customer.id, store.id)
          if (ppActive) {
            const ppResult = await handlePartialPaymentReply({
              supabase, deliveryId: ppActive.deliveryId, storeId: store.id,
              customerId: customer.id, customerMessage: messageText,
              quickReplyPayload: quickReplyPayload || null,
              senderId, pageToken, conversationId: conversation.id,
            })
            if (ppResult.handled) continue
          }
        } catch (ppErr) {
          console.error('[PartialPayment] Messenger interception error:', ppErr)
        }

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
            // Save flow response to messages so it appears in dashboard chat
            if (flowResult.response) {
              await supabase.from('messages').insert({
                conversation_id: conversation.id,
                content: flowResult.response,
                is_from_customer: false,
                is_ai_response: true,
                metadata: { type: 'flow_response' },
              }).then(null, () => {})
            }
            continue
          }
        } catch (flowErr) {
          console.error('[Flow] Messenger interception error:', flowErr)
          // Fall through to normal AI pipeline
        }

        try {
          // Show typing indicator (fire-and-forget — visual only)
          void sendTypingIndicator(senderId, true, pageToken).catch(err => console.error("[silent-catch]", err))

          console.log('[Messenger] Starting AI processing for:', messageText, 'store:', store.id, 'customer:', customer.id)
          const aiResult = await processAIChat(supabase, {
            conversationId: conversation.id,
            customerMessage: messageText,
            storeId: store.id,
            storeName: store.name || 'Манай дэлгүүр',
            customerId: customer.id,
            chatbotSettings,
          })
          console.log('[Messenger] AI completed. Intent:', aiResult.intent, 'Response length:', aiResult.response?.length)

          const aiResponse = aiResult.response
          const aiIntent = aiResult.intent
          console.log('[AI] Intent:', aiIntent, 'Products:', aiResult.products.length,
            'OrderStep:', aiResult.orderStep, 'Response length:', aiResponse?.length ?? 0)

          if (aiResponse) {
            // Send text + product cards when products are available
            const hasProducts = aiResult.products.length > 0
            const showCards = hasProducts && (aiIntent === 'product_search' || aiIntent === 'product_detail')
            if (showCards) {
              console.log('[AI] Sending product cards:', aiResult.products.map(p => p.name))
              await sendProductCardsFromResult(
                senderId, aiResponse, aiResult.products, pageToken
              )
            } else if (aiResult.orderStep === 'confirming') {
              // Order summary — send with Тийм/Үгүй quick replies
              await sendQuickReplies(
                senderId,
                aiResponse,
                [
                  { title: 'Тийм ✅', payload: 'ORDER_CONFIRM_YES' },
                  { title: 'Үгүй ❌', payload: 'ORDER_CONFIRM_NO' },
                ],
                pageToken
              )
            } else if (aiIntent === 'order_created') {
              // Order completed — send confirmation text
              await sendTextMessage(senderId, aiResponse, pageToken)
            } else if (aiIntent === 'order_collection') {
              // Order collection in progress — just send text
              await sendTextMessage(senderId, aiResponse, pageToken)
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
          } else {
            console.warn('[AI] No response text returned')
          }

          // Post-reply escalation check — match widget route logic:
          // Only skip truly low-risk intents. product_search/order_status are NOT
          // excluded — frustrated customers often get misclassified into these.
          const SKIP_ESCALATION_INTENTS = [
            'greeting', 'thanks', 'order_created',
            'gift_card_purchase', 'gift_card_redeem',
          ]
          const inCheckout = aiIntent === 'order_collection'
          if (!SKIP_ESCALATION_INTENTS.includes(aiIntent) && !inCheckout) {
            const esc = await processEscalation(
              supabase, conversation.id, messageText, store.id, chatbotSettings
            )
            if (esc.escalated && pageToken && esc.escalationMessage) {
              await sendTextMessage(senderId, esc.escalationMessage, pageToken)
            }
          }

          // Turn off typing (fire-and-forget)
          void sendTypingIndicator(senderId, false, pageToken).catch(err => console.error("[silent-catch]", err))
        } catch (aiErr) {
          console.error('[AI] Exception:', aiErr instanceof Error ? aiErr.message : String(aiErr))
          // Send fallback response so customer isn't left hanging
          if (pageToken) {
            try {
              await sendTextMessage(senderId, 'Уучлаарай, түр алдаа гарлаа. Дахин оролдоно уу!', pageToken)
            } catch { /* last resort */ }
          }
        }
      }
    }
  }
}

/**
 * Send AI text response + product cards using products already fetched by AI pipeline.
 * No extra DB query needed.
 */
async function sendProductCardsFromResult(
  recipientId: string,
  textFallback: string,
  products: AIProductCard[],
  pageToken: string
) {
  // Always send the AI text response first (has natural language + prices)
  await sendTextMessage(recipientId, textFallback, pageToken)

  if (products.length > 0) {
    const cards = products.slice(0, 10).map((p) => {
      const images = (p.images || []) as string[]
      const price = new Intl.NumberFormat('mn-MN').format(p.base_price) + '₮'
      const desc = p.description
        ? `💰 ${price}\n${p.description.substring(0, 60)}`
        : `💰 ${price}`
      return {
        title: p.name,
        subtitle: desc,
        imageUrl: images[0] || undefined,
      }
    })

    console.log('[ProductCards] Sending', cards.length, 'cards, images:',
      cards.map(c => c.imageUrl ? 'yes' : 'no'))
    const cardResult = await sendProductCards(recipientId, cards, pageToken)
    if (!cardResult) {
      console.error('[ProductCards] Failed to send — API returned null')
    }
  }
}
