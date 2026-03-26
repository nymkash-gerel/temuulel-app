/**
 * ResponseAgent — 3-tier response generation.
 *
 * Tier 1: Contextual AI (GPT-4o-mini with rich context)
 * Tier 2: Recommendation Writer (deterministic, no API)
 * Tier 3: Template Response (hardcoded Mongolian templates)
 */

import {
  generateAIResponse,
  generateResponse,
  fetchRecentMessages,
} from '@/lib/chat-ai'
import { resolve } from '@/lib/resolution-engine'
import { buildCustomerProfile } from '@/lib/ai/customer-profile'
import type { AgentContext, AgentResult, TriageResult, AgentProductCard } from './types'
import { emptyResult } from './types'
import type { SearchResult } from './product-search'

export class ResponseAgent {
  readonly name = 'response'

  /** Quick reply for simple intents (greeting, thanks). */
  quickReply(ctx: AgentContext, intent: string): AgentResult {
    const response = generateResponse(
      intent,
      [],
      [],
      ctx.storeName,
      ctx.chatbotSettings
    )
    return emptyResult(intent, response)
  }

  /** Full response generation with search results and AI context. */
  async generate(
    ctx: AgentContext,
    triage: TriageResult,
    searchResult?: SearchResult,
  ): Promise<AgentResult> {
    const products = searchResult?.products ?? []
    const orders = searchResult?.orders ?? []

    try {
      // Fetch conversation history for AI context
      const history = await fetchRecentMessages(ctx.supabase, ctx.conversationId, 10)

      // Build resolution context
      const resolution = await resolve(ctx.supabase, {
        intent: triage.intent,
        storeId: ctx.storeId,
        customerId: ctx.customerId,
        message: ctx.message,
        products,
        orders,
      })

      // Generate AI response (3-tier fallback handled inside)
      const response = await generateAIResponse(
        triage.intent,
        products,
        orders,
        ctx.storeName,
        ctx.message,
        ctx.chatbotSettings,
        history,
        undefined, // customerProfile — loaded inside if needed
        undefined, // extendedProfile
        undefined, // latestPurchaseSummary
        resolution,
      )

      return {
        response,
        intent: triage.intent,
        products: products as AgentProductCard[],
        metadata: {
          products_found: products.length,
          orders_found: orders.length,
        },
      }
    } catch {
      // Fallback to template response
      const response = generateResponse(
        triage.intent,
        products,
        orders,
        ctx.storeName,
        ctx.chatbotSettings
      )
      return {
        response,
        intent: triage.intent,
        products: products as AgentProductCard[],
        metadata: {
          products_found: products.length,
          orders_found: orders.length,
        },
      }
    }
  }
}
