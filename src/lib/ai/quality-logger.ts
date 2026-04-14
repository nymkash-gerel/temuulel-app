/**
 * AI Quality Logger
 * Logs quality scores and unanswered questions (fire-and-forget)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface QualityLogParams {
  storeId: string
  conversationId: string
  messageId?: string
  customerMessage: string
  aiResponse: string
  intent: string
  confidence: number
  qualityScore: number
  detectedIssues: string[]
  requiresHumanReview: boolean
  isUnanswered: boolean
}

/**
 * Log AI quality and optionally record unanswered questions.
 * Designed to be called fire-and-forget — errors are caught and logged.
 */
export async function logAIQuality(
  supabase: SupabaseClient,
  params: QualityLogParams
): Promise<void> {
  const promises: PromiseLike<unknown>[] = []

  // 1. Insert quality log
  promises.push(
    supabase.from('ai_quality_logs').insert({
      store_id: params.storeId,
      conversation_id: params.conversationId,
      message_id: params.messageId || null,
      customer_message: params.customerMessage,
      ai_response: params.aiResponse.substring(0, 2000), // truncate for storage
      intent: params.intent,
      confidence: params.confidence,
      quality_score: params.qualityScore,
      detected_issues: params.detectedIssues,
      requires_human_review: params.requiresHumanReview,
    }).then(({ error }) => {
      if (error) console.error('[quality-logger] Insert quality log failed:', error.message)
    })
  )

  // 2. If unanswered, log the question
  if (params.isUnanswered) {
    promises.push(
      supabase.from('unanswered_questions').insert({
        store_id: params.storeId,
        conversation_id: params.conversationId,
        customer_message: params.customerMessage,
        intent: params.intent,
        ai_response: params.aiResponse.substring(0, 2000),
        status: 'pending',
      }).then(({ error }) => {
        if (error) console.error('[quality-logger] Insert unanswered failed:', error.message)
      })
    )
  }

  await Promise.allSettled(promises)
}
