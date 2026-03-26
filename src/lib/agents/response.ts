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
import type { AgentContext, AgentResult, TriageResult, AgentProductCard } from './types'
import { emptyResult } from './types'
import type { SearchResult } from './product-search'
import type { ProductMatch, OrderMatch } from '@/lib/chat-ai-types'

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

      // Build resolution context (ResolveInput does not accept 'orders')
      const resolution = await resolve(ctx.supabase, {
        intent: triage.intent,
        storeId: ctx.storeId,
        customerId: ctx.customerId,
        message: ctx.message,
        products,
      })

      // Generate AI response (3-tier fallback handled inside)
      // generateAIResponse expects ProductMatch[] — cast since AgentProductCard
      // has the same shape for the fields used by the response generator.
      const response = await generateAIResponse(
        triage.intent,
        products as unknown as ProductMatch[],
        orders as unknown as OrderMatch[],
        ctx.storeName,
        ctx.message,
        ctx.chatbotSettings,
        history,
        undefined, // activeVouchers
        undefined, // restaurantContext
        undefined, // customerProfile
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
        products as unknown as ProductMatch[],
        orders as unknown as OrderMatch[],
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
