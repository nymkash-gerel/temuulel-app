/**
 * SupervisorAgent — Central orchestrator for the Temuulel chat pipeline.
 *
 * Routes messages to specialized agents based on intent classification
 * and conversation state. Replaces the monolithic processAIChat() logic
 * with a modular, testable agent architecture.
 *
 * Routing priority:
 * 1. Gift card flow (highest priority intercept)
 * 2. Follow-up detection (order steps, product selection)
 * 3. Intent-based routing (product search, order status, etc.)
 * 4. Default response generation
 */

import { TriageAgent } from './triage'
import { GiftCardAgent } from './gift-card'
import { OrderCollectionAgent } from './order-collection'
import { ProductAgent } from './product-search'
import { ResponseAgent } from './response'
import { EscalationAgent } from './escalation'
import type { AgentContext, AgentResult, TriageResult } from './types'
import { emptyResult } from './types'

/** Maximum agent redirects per request (loop protection). */
const MAX_REDIRECTS = 3

export class SupervisorAgent {
  private triageAgent = new TriageAgent()
  private giftCardAgent = new GiftCardAgent()
  private orderCollectionAgent = new OrderCollectionAgent()
  private productAgent = new ProductAgent()
  private responseAgent = new ResponseAgent()
  private escalationAgent = new EscalationAgent()

  /**
   * Process a customer message through the agent pipeline.
   * This is the main entry point replacing processAIChat() logic.
   */
  async process(ctx: AgentContext): Promise<AgentResult> {
    try {
      // Phase 1: Gift card intercept (highest priority)
      const gcResult = await this.giftCardAgent.tryHandle(ctx)
      if (gcResult) return gcResult

      // Phase 2: Triage — classify intent + detect follow-up
      const triage = await this.triageAgent.classify(ctx)

      // Phase 3: Route based on follow-up type
      if (triage.followUpType === 'order_step_input' && ctx.state.order_draft) {
        // Order collection is still handled by processAIChat for now
        // (complex state machine — will be extracted in Step 4)
        return this.handleOrderStep(ctx, triage)
      }

      // Phase 4: Route based on intent
      return this.routeByIntent(ctx, triage)
    } catch (error) {
      // Graceful degradation — return a safe fallback
      return emptyResult(
        'general',
        'Уучлаарай, системд алдаа гарлаа. Дахин оролдоно уу.'
      )
    }
  }

  /** Route to the appropriate agent based on classified intent. */
  private async routeByIntent(ctx: AgentContext, triage: TriageResult): Promise<AgentResult> {
    const { intent } = triage

    // Fast path: simple intents that don't need search
    if (intent === 'greeting' || intent === 'thanks') {
      return this.responseAgent.quickReply(ctx, intent)
    }

    // Complaint/escalation path (checked before search to avoid type narrowing issues)
    if (intent === 'complaint' || intent === 'return_exchange') {
      const result = await this.responseAgent.generate(ctx, triage)
      this.escalationAgent.evaluate(ctx).catch(() => {})
      return result
    }

    // Search path: intents that need product/order data
    if (
      intent === 'product_search' ||
      intent === 'order_collection' ||
      intent === 'order_status' ||
      intent === 'shipping' ||
      intent === 'size_info' ||
      intent === 'table_reservation'
    ) {
      const searchResult = await this.productAgent.search(ctx, triage)

      // Busy mode check
      if (searchResult.busyMode.busy_mode && intent === 'product_search') {
        const waitMin = searchResult.busyMode.estimated_wait_minutes ?? 30
        return emptyResult(intent, `Уучлаарай, одоогоор завгүй байна. Хүлээх хугацаа: ~${waitMin} мин.`)
      }

      // Generate response with search results
      return this.responseAgent.generate(ctx, triage, searchResult)
    }

    // Payment path
    if (intent === 'payment') {
      return this.responseAgent.generate(ctx, triage)
    }

    // Default: generate response without search
    return this.responseAgent.generate(ctx, triage)
  }

  /** Handle order collection step via OrderCollectionAgent. */
  private async handleOrderStep(ctx: AgentContext, triage: TriageResult): Promise<AgentResult> {
    return this.orderCollectionAgent.handle(ctx, triage)
  }
}
