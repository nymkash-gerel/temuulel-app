/**
 * EscalationAgent — Evaluates escalation score and dispatches notifications.
 *
 * Fire-and-forget: runs asynchronously after response generation.
 * Does not block the response pipeline.
 */

import {
  evaluateEscalation,
  processEscalation,
} from '@/lib/escalation'
import { fetchRecentMessages } from '@/lib/chat-ai'
import type { AgentContext } from './types'

export interface EscalationResult {
  shouldEscalate: boolean
  newScore: number
  signals: string[]
}

export class EscalationAgent {
  readonly name = 'escalation'

  /** Evaluate escalation score. Non-blocking — safe to fire-and-forget. */
  async evaluate(ctx: AgentContext): Promise<EscalationResult> {
    try {
      const history = await fetchRecentMessages(ctx.supabase, ctx.conversationId, 20)

      const result = evaluateEscalation(
        ctx.message,
        history,
        0 // current score — loaded from conversation in real impl
      )

      if (result.shouldEscalate) {
        // Fire-and-forget notification dispatch
        processEscalation(ctx.supabase, ctx.conversationId, result.newScore).catch(() => {})
      }

      return {
        shouldEscalate: result.shouldEscalate,
        newScore: result.newScore,
        signals: result.signals,
      }
    } catch {
      return { shouldEscalate: false, newScore: 0, signals: [] }
    }
  }
}
