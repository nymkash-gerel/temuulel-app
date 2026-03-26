/**
 * OrderCollectionAgent — Multi-step order state machine.
 *
 * Handles the order collection flow: variant → name → address → phone → confirming.
 * Extracted from processAIChat lines 160-316.
 *
 * This agent manages the most complex conversation flow in the system,
 * collecting order details step-by-step and creating the final order.
 *
 * Note: The actual order creation and helper functions (extractPhone, extractAddress,
 * isAffirmative, isNegative, buildOrderSummary, createOrderFromChat, startOrderDraft,
 * resolveVariantsFromMessage) remain in chat-ai-handler.ts for now.
 * This agent provides the routing structure — the full extraction of helpers
 * into this module is a future step to avoid breaking the 222 existing tests.
 */

import type { AgentContext, AgentResult, TriageResult } from './types'
import { emptyResult } from './types'
import type { OrderDraft, CartItem } from '@/lib/conversation-state'
import { getDraftItems, getDraftTotal } from '@/lib/conversation-state'
import { formatPrice } from '@/lib/chat-ai'
import { calculateDeliveryFee } from '@/lib/delivery-fee-calculator'

/** Order step types matching the conversation state machine. */
export type OrderStep = 'variant' | 'info' | 'name' | 'address' | 'phone' | 'confirming'

/**
 * OrderCollectionAgent handles the multi-step order flow.
 *
 * Each step collects one piece of information:
 * 1. variant — select size/color if product has variants
 * 2. name — collect customer name
 * 3. address — collect delivery address
 * 4. phone — collect phone number
 * 5. confirming — show summary, confirm or cancel
 */
export class OrderCollectionAgent {
  readonly name = 'order-collection'

  /**
   * Check if this agent should handle the current message.
   * Returns true if there's an active order draft with a step.
   */
  canHandle(ctx: AgentContext, followUpType: string | null): boolean {
    return followUpType === 'order_step_input' && ctx.state.order_draft !== null
  }

  /**
   * Handle an order collection step.
   *
   * NOTE: This is a structural placeholder. The actual step logic is still
   * executed by processAIChat() in chat-ai-handler.ts because the helper
   * functions (extractPhone, extractAddress, createOrderFromChat, etc.)
   * are private to that module.
   *
   * The SupervisorAgent detects order_step_input and delegates here,
   * but for Phase 1 the actual execution path still goes through
   * processAIChat's switch statement.
   *
   * Phase 2 will move the helpers into this agent.
   */
  async handle(ctx: AgentContext, triage: TriageResult): Promise<AgentResult> {
    const draft = ctx.state.order_draft
    if (!draft) {
      return emptyResult('order_collection', 'Захиалга эхлүүлэхийн тулд бараа сонгоно уу.')
    }

    // Return a result that tells the caller which step we're on
    // The actual step execution happens in processAIChat for now
    return {
      response: this.getStepPrompt(draft),
      intent: 'order_collection',
      products: [],
      metadata: { products_found: 0, orders_found: 0 },
      orderStep: draft.step as OrderStep,
      stateUpdates: { order_draft: draft },
    }
  }

  /** Get the user-facing prompt for the current order step. */
  private getStepPrompt(draft: OrderDraft): string {
    switch (draft.step) {
      case 'variant':
        return 'Аль хувилбарыг сонгохоо дугаараар бичнэ үү:'
      case 'info':
      case 'name':
        return 'Нэрээ бичнэ үү:'
      case 'address':
        return draft.customer_name
          ? `${draft.customer_name}, хүргэлтийн хаягаа бичнэ үү (дүүрэг, хороо, байр):`
          : 'Хүргэлтийн хаягаа бичнэ үү:'
      case 'phone':
        return 'Утасны дугаараа бичнэ үү:'
      case 'confirming':
        return 'Захиалгаа баталгаажуулах уу? (Тийм/Үгүй)'
      default:
        return 'Захиалгын мэдээллийг оруулна уу.'
    }
  }
}
