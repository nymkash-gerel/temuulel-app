/**
 * TriageAgent — Intent classification + follow-up detection.
 *
 * Wraps the existing hybrid classifier and follow-up resolver
 * into a single agent that determines what the customer wants.
 */

import { hybridClassify } from '@/lib/ai/hybrid-classifier'
import { resolveFollowUp } from '@/lib/conversation-state'
import { normalizeText } from '@/lib/text-normalizer'
import { extractMorphFeatures } from '@/lib/morphological-features'
import type { AgentContext, TriageResult } from './types'

export class TriageAgent {
  readonly name = 'triage'

  async classify(ctx: AgentContext): Promise<TriageResult> {
    // 1. Detect follow-up from conversation state
    const followUp = resolveFollowUp(ctx.message, {
      last_intent: ctx.state.last_intent,
      last_products: ctx.state.last_products,
      last_query: ctx.state.last_query,
      turn_count: ctx.state.turn_count,
      order_draft: ctx.state.order_draft,
    })

    // 2. Classify intent (hybrid: keyword → morph → ML → GPT)
    const classification = hybridClassify(ctx.message)

    // 3. Extract morphological features for downstream agents
    const morphFeatures = extractMorphFeatures(ctx.normalizedMessage)

    // If follow-up detected, use its type as intent override with full confidence
    const intent = followUp?.type ?? classification.intent
    const confidence = followUp?.type ? 1.0 : classification.confidence

    return {
      intent,
      confidence,
      followUpType: followUp?.type ?? null,
      followUpData: followUp ?? null,
      morphFeatures,
    }
  }
}
