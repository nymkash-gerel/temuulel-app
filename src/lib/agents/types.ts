/**
 * Agent types for the Supervisor orchestration pattern.
 *
 * Each agent is a focused module that handles one aspect of the chat pipeline.
 * The SupervisorAgent routes messages to the appropriate agent(s) based on
 * intent classification and conversation state.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatbotSettings } from '@/lib/chat-ai'
import type { StoredProduct, OrderDraft, GiftCardDraft } from '@/lib/conversation-state'
import type { MorphFeatures } from '@/lib/morphological-features'

/** Shared context passed to all agents. */
export interface AgentContext {
  supabase: SupabaseClient
  message: string
  normalizedMessage: string
  storeId: string
  storeName: string
  conversationId: string
  customerId: string | null
  chatbotSettings: ChatbotSettings
  /** Current conversation state (loaded once by supervisor) */
  state: {
    last_intent: string | null
    last_products: StoredProduct[]
    last_query: string | null
    turn_count: number
    order_draft: OrderDraft | null
    gift_card_draft: GiftCardDraft | null
  }
}

/** Product card format returned to the caller. */
export interface AgentProductCard {
  name: string
  base_price: number
  description: string
  images: string[]
}

/** Standard result returned by any agent. */
export interface AgentResult {
  response: string
  intent: string
  products: AgentProductCard[]
  metadata: {
    products_found: number
    orders_found: number
    [key: string]: unknown
  }
  orderStep?: 'variant' | 'info' | 'name' | 'address' | 'phone' | 'confirming' | null
  /** Updated state fields to merge into conversation state */
  stateUpdates?: Partial<AgentContext['state']>
}

/** Triage result from intent classification + follow-up detection. */
export interface TriageResult {
  intent: string
  confidence: number
  followUpType: string | null
  followUpData: unknown
  morphFeatures: MorphFeatures
}

/** Base interface for all agents. */
export interface Agent {
  readonly name: string
  handle(ctx: AgentContext, triage: TriageResult): Promise<AgentResult>
}

/** Empty/default agent result for fallback. */
export function emptyResult(intent: string, response: string): AgentResult {
  return {
    response,
    intent,
    products: [],
    metadata: { products_found: 0, orders_found: 0 },
    orderStep: null,
  }
}
