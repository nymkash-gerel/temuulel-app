/**
 * Smart conversation escalation engine.
 *
 * Scores each incoming customer message against multiple signals
 * (complaint keywords, frustration, repeated messages, AI-fail-to-resolve, etc.).
 * When the cumulative score crosses a configurable threshold the conversation
 * is escalated from AI auto-reply to human agent handling.
 *
 * The scoring is additive — each message can only raise the score, never lower it.
 * A human agent resets the score by taking over the conversation.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { dispatchNotification } from './notifications'
import type { ChatbotSettings } from './chat-ai'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EscalationLevel = 'low' | 'medium' | 'high' | 'critical'

export interface EscalationResult {
  newScore: number
  level: EscalationLevel
  shouldEscalate: boolean
  signals: string[]
}

export interface EscalationConfig {
  enabled: boolean
  threshold: number
}

export interface RecentMessage {
  content: string
  is_from_customer: boolean
  is_ai_response: boolean
}

// ---------------------------------------------------------------------------
// Keyword lists (Mongolian)
// ---------------------------------------------------------------------------

const COMPLAINT_KEYWORDS = [
  'гомдол', 'асуудал', 'муу', 'буруу', 'алдаа',
  'сэтгэл ханамжгүй', 'чанар муу', 'эвдэрсэн', 'гэмтсэн',
  'хуурамч', 'луйвар', 'тохиромжгүй',
]

const FRUSTRATION_KEYWORDS = [
  'яагаад', 'яаж ийм', 'битгий', 'хэрэггүй',
  'уурласан', 'бухимдсан', 'залхсан', 'ичмээр',
  'ямар ч', 'хариулахгүй', 'хэзээ ч',
]

const RETURN_EXCHANGE_KEYWORDS = [
  'буцаах', 'буцаалт', 'солих', 'солилцох',
  'буцааж өгөх', 'мөнгө буцаах',
]

const PAYMENT_DISPUTE_KEYWORDS = [
  'төлбөр буруу', 'давхар төлсөн', 'мөнгө ирээгүй',
  'залилсан', 'хуурсан', 'төлбөр төлсөн ч',
]

// ---------------------------------------------------------------------------
// Signal weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  complaint: 25,
  frustration: 20,
  return_exchange: 20,
  payment_dispute: 25,
  repeated_message: 15,
  ai_fail_to_resolve: 15,
  long_unresolved: 10,
} as const

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

export function scoreToLevel(score: number): EscalationLevel {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

function matchesAny(lower: string, keywords: string[]): boolean {
  return keywords.some((kw) => lower.includes(kw))
}

/**
 * Detect whether the new message is a repeat of a recent customer message.
 * Uses Jaccard similarity on word sets with a 0.8 threshold.
 */
export function detectRepeatedMessage(
  message: string,
  recentCustomerMessages: string[]
): boolean {
  if (recentCustomerMessages.length === 0) return false

  const normalize = (s: string) =>
    new Set(
      s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean)
    )

  const words = normalize(message)
  if (words.size === 0) return false

  for (const prev of recentCustomerMessages) {
    const prevWords = normalize(prev)
    if (prevWords.size === 0) continue

    const intersection = new Set([...words].filter((w) => prevWords.has(w)))
    const union = new Set([...words, ...prevWords])
    const similarity = intersection.size / union.size

    if (similarity >= 0.8) return true
  }

  return false
}

/**
 * Count how many consecutive customer messages appear at the END of the
 * conversation with NO response at all (neither AI nor human).
 * This detects situations where the system is completely failing to respond.
 *
 * For cases where the AI responds but unhelpfully, the `repeated_message`
 * signal handles escalation instead.
 */
export function countConsecutiveAiOnly(messages: RecentMessage[]): number {
  let customerCount = 0

  // Walk backwards — any response (AI or human) breaks the streak
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]

    if (msg.is_from_customer) {
      customerCount++
    } else {
      break
    }
  }

  return customerCount
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

export function evaluateEscalation(
  currentScore: number,
  currentMessage: string,
  recentMessages: RecentMessage[],
  config: EscalationConfig
): EscalationResult {
  if (!config.enabled) {
    return {
      newScore: currentScore,
      level: scoreToLevel(currentScore),
      shouldEscalate: false,
      signals: [],
    }
  }

  const lower = currentMessage.toLowerCase()
  let addedScore = 0
  const signals: string[] = []

  // 1. Complaint keywords
  if (matchesAny(lower, COMPLAINT_KEYWORDS)) {
    addedScore += WEIGHTS.complaint
    signals.push('complaint')
  }

  // 2. Frustration language
  if (matchesAny(lower, FRUSTRATION_KEYWORDS)) {
    addedScore += WEIGHTS.frustration
    signals.push('frustration')
  }

  // 3. Return/exchange request
  if (matchesAny(lower, RETURN_EXCHANGE_KEYWORDS)) {
    addedScore += WEIGHTS.return_exchange
    signals.push('return_exchange')
  }

  // 4. Payment dispute
  if (matchesAny(lower, PAYMENT_DISPUTE_KEYWORDS)) {
    addedScore += WEIGHTS.payment_dispute
    signals.push('payment_dispute')
  }

  // 5. Repeated message (check last 5 customer messages BEFORE the current one)
  const allCustomerMsgs = recentMessages
    .filter((m) => m.is_from_customer)
    .map((m) => m.content)
  // Exclude the last entry — it's the current message (already saved to DB
  // before this check runs), so comparing against it would always self-match.
  const recentCustomerMsgs = allCustomerMsgs.slice(0, -1).slice(-5)

  if (detectRepeatedMessage(currentMessage, recentCustomerMsgs)) {
    addedScore += WEIGHTS.repeated_message
    signals.push('repeated_message')
  }

  // 6. AI fail-to-resolve (5+ customer messages with only AI replies)
  const consecutiveCustomer = countConsecutiveAiOnly(recentMessages)
  if (consecutiveCustomer >= 5) {
    addedScore += WEIGHTS.ai_fail_to_resolve
    signals.push('ai_fail_to_resolve')
  }

  // 7. Long unresolved thread (6+ customer messages, no human reply)
  const totalCustomerMsgs = recentMessages.filter((m) => m.is_from_customer).length
  const hasHumanReply = recentMessages.some((m) => !m.is_from_customer && !m.is_ai_response)
  if (totalCustomerMsgs >= 6 && !hasHumanReply) {
    addedScore += WEIGHTS.long_unresolved
    signals.push('long_unresolved')
  }

  const newScore = Math.min(currentScore + addedScore, 100)
  const level = scoreToLevel(newScore)
  const wasBelow = currentScore < config.threshold
  const isAbove = newScore >= config.threshold

  return {
    newScore,
    level,
    shouldEscalate: wasBelow && isAbove,
    signals,
  }
}

// ---------------------------------------------------------------------------
// Shared route helper — call from widget, messenger, and chat routes
// ---------------------------------------------------------------------------

const DEFAULT_ESCALATION_MESSAGE =
  'Таны хүсэлтийг бид хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно. Түр хүлээнэ үү!'

export async function processEscalation(
  supabase: SupabaseClient,
  conversationId: string,
  customerMessage: string,
  storeId: string,
  chatbotSettings: ChatbotSettings
): Promise<{ escalated: boolean; level: EscalationLevel; escalationMessage?: string }> {
  const config: EscalationConfig = {
    enabled: chatbotSettings.escalation_enabled !== false,
    threshold: chatbotSettings.escalation_threshold ?? 60,
  }

  if (!config.enabled) {
    return { escalated: false, level: 'low' }
  }

  // Fetch conversation's current score and customer_id
  const { data: conv } = await supabase
    .from('conversations')
    .select('escalation_score, customer_id')
    .eq('id', conversationId)
    .single()

  const currentScore = (conv?.escalation_score as number) ?? 0

  // Fetch recent messages for context
  const { data: msgs } = await supabase
    .from('messages')
    .select('content, is_from_customer, is_ai_response')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10)

  const recentMessages: RecentMessage[] = ((msgs || []) as RecentMessage[]).reverse()

  // Evaluate
  const result = evaluateEscalation(currentScore, customerMessage, recentMessages, config)

  // Update conversation score and level
  const updateData: Record<string, unknown> = {
    escalation_score: result.newScore,
    escalation_level: result.level,
  }

  if (result.shouldEscalate) {
    updateData.escalated_at = new Date().toISOString()
    updateData.status = 'escalated'
  }

  await supabase
    .from('conversations')
    .update(updateData)
    .eq('id', conversationId)

  // If escalated, save the escalation message and notify
  if (result.shouldEscalate) {
    const escalationMessage =
      chatbotSettings.escalation_message || DEFAULT_ESCALATION_MESSAGE

    // Summarize complaint for merchant dashboard (optional, requires OpenAI)
    let complaintSummary = null
    try {
      const { summarizeComplaint } = await import('./ai/complaint-summarizer')
      const customerTexts = recentMessages
        .filter((m) => m.is_from_customer)
        .map((m) => m.content)
      customerTexts.push(customerMessage)
      complaintSummary = await summarizeComplaint({
        complaint_text: customerTexts.join('\n'),
      })
    } catch {
      // AI summary is optional; proceed without it
    }

    // Save escalation message as a system AI message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: escalationMessage,
      is_from_customer: false,
      is_ai_response: true,
      metadata: {
        type: 'escalation',
        signals: result.signals,
        score: result.newScore,
        level: result.level,
        complaint_summary: complaintSummary,
      },
    })

    // Dispatch notification
    dispatchNotification(storeId, 'escalation' as Parameters<typeof dispatchNotification>[1], {
      conversation_id: conversationId,
      level: result.level,
      score: result.newScore,
      signals: result.signals.join(', '),
    })

    // --- AI Compensation: classify complaint and create voucher if policy exists ---
    if (conv?.customer_id) {
      try {
        const { classifyComplaint } = await import('./ai/complaint-classifier')
        const customerTextsForClassify = recentMessages
          .filter((m) => m.is_from_customer)
          .map((m) => m.content)
        customerTextsForClassify.push(customerMessage)
        const classification = await classifyComplaint({
          complaint_text: customerTextsForClassify.join('\n'),
        })

        if (classification && classification.confidence >= 0.5) {
          // Look up compensation policy for this store + category
          const { data: policy } = await supabase
            .from('compensation_policies')
            .select('*')
            .eq('store_id', storeId)
            .eq('complaint_category', classification.category)
            .eq('is_active', true)
            .single()

          if (policy) {
            const voucherCode = `COMP-${Date.now()}`
            const validUntil = new Date()
            validUntil.setDate(validUntil.getDate() + (policy.valid_days || 30))

            const voucherStatus = policy.auto_approve ? 'approved' : 'pending_approval'

            const { data: voucher } = await supabase
              .from('vouchers')
              .insert({
                store_id: storeId,
                customer_id: conv.customer_id,
                policy_id: policy.id,
                voucher_code: voucherCode,
                compensation_type: policy.compensation_type,
                compensation_value: policy.compensation_value,
                max_discount_amount: policy.max_discount_amount,
                complaint_category: classification.category,
                complaint_summary: complaintSummary?.summary || classification.suggested_response,
                conversation_id: conversationId,
                status: voucherStatus,
                valid_until: validUntil.toISOString(),
              })
              .select('id, voucher_code')
              .single()

            if (voucher) {
              // Build compensation label
              const compLabel =
                policy.compensation_type === 'percent_discount'
                  ? `${policy.compensation_value}% хөнгөлөлт`
                  : policy.compensation_type === 'fixed_discount'
                    ? `${new Intl.NumberFormat('mn-MN').format(policy.compensation_value)}₮ хөнгөлөлт`
                    : policy.compensation_type === 'free_shipping'
                      ? 'Үнэгүй хүргэлт'
                      : 'Үнэгүй бараа'

              const CATEGORY_LABELS: Record<string, string> = {
                food_quality: 'Хоолны чанар',
                wrong_item: 'Буруу бараа',
                delivery_delay: 'Хүргэлт удсан',
                service_quality: 'Үйлчилгээний чанар',
                damaged_item: 'Гэмтэлтэй бараа',
                pricing_error: 'Үнийн алдаа',
                staff_behavior: 'Ажилтны зан',
                other: 'Бусад',
              }

              // Notify store owner
              dispatchNotification(storeId, 'compensation_suggested' as Parameters<typeof dispatchNotification>[1], {
                voucher_id: voucher.id,
                voucher_code: voucher.voucher_code,
                compensation_label: compLabel,
                complaint_category_label: CATEGORY_LABELS[classification.category] || classification.category,
                auto_approved: policy.auto_approve,
              })

              // If auto-approved, tell customer about the discount
              if (policy.auto_approve) {
                await supabase.from('messages').insert({
                  conversation_id: conversationId,
                  content: `Уучлаарай, дараагийн захиалгадаа ${compLabel} авах эрхтэй боллоо. Код: ${voucherCode}`,
                  is_from_customer: false,
                  is_ai_response: true,
                  metadata: { type: 'compensation', voucher_id: voucher.id, voucher_code: voucherCode },
                })
              }
            }
          }
        }
      } catch {
        // Compensation is optional; proceed without it
      }
    }

    return { escalated: true, level: result.level, escalationMessage }
  }

  return { escalated: false, level: result.level }
}
