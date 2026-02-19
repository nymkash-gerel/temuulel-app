/**
 * Flow trigger matching.
 *
 * Checks if an incoming message matches any active flow's trigger
 * for the given store. Returns the first matching flow (sorted by priority).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeText, classifyIntentWithConfidence } from './chat-ai'
import type {
  Flow,
  FlowNode,
  FlowEdge,
  TriggerConfig,
  TriggerContext,
  KeywordTriggerConfig,
  IntentMatchTriggerConfig,
  ButtonClickTriggerConfig,
} from './flow-types'

/**
 * Intents that indicate the customer's message has clear, substantive purpose.
 * When detected, new_conversation welcome flows should NOT intercept —
 * let the AI pipeline answer the actual question instead.
 */
const SUBSTANTIVE_INTENTS = new Set([
  'product_search', 'order_status', 'size_info', 'payment', 'shipping',
  'complaint', 'return_exchange', 'table_reservation', 'allergen_info',
  'menu_availability',
])

/**
 * Find the first active flow whose trigger matches the context.
 * Flows are checked in priority order (lower = first).
 */
export async function findMatchingFlow(
  supabase: SupabaseClient,
  storeId: string,
  message: string,
  context: TriggerContext
): Promise<Flow | null> {
  const { data: flows } = await supabase
    .from('flows')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'active')
    .order('priority', { ascending: true })

  if (!flows || flows.length === 0) return null

  const normalizedMsg = normalizeText(message)

  // Pre-classify intent so new_conversation triggers can decide
  // whether to intercept or let the AI pipeline handle the question.
  if (!context.classified_intent) {
    const { intent, confidence } = classifyIntentWithConfidence(message)
    if (confidence >= 1) {
      context.classified_intent = intent
    }
  }

  for (const row of flows) {
    const flow = rowToFlow(row)
    if (matchesTrigger(flow, normalizedMsg, context)) {
      return flow
    }
  }

  return null
}

/**
 * Check if a single flow's trigger matches the message/context.
 */
export function matchesTrigger(
  flow: Flow,
  normalizedMessage: string,
  context: TriggerContext
): boolean {
  switch (flow.trigger_type) {
    case 'keyword':
      return matchKeywordTrigger(flow.trigger_config as KeywordTriggerConfig, normalizedMessage)

    case 'new_conversation':
      if (!context.is_new_conversation) return false
      // If the first message has clear substantive intent (product question,
      // sizing query, order check, etc.), skip the welcome flow so the AI
      // pipeline can answer the actual question.
      if (context.classified_intent && SUBSTANTIVE_INTENTS.has(context.classified_intent)) {
        return false
      }
      return true

    case 'button_click': {
      const config = flow.trigger_config as ButtonClickTriggerConfig
      return context.quick_reply_payload === config.payload
    }

    case 'intent_match': {
      const config = flow.trigger_config as IntentMatchTriggerConfig
      return !!context.classified_intent && config.intents.includes(context.classified_intent)
    }

    default:
      return false
  }
}

function matchKeywordTrigger(config: KeywordTriggerConfig, normalizedMessage: string): boolean {
  if (!config.keywords || config.keywords.length === 0) return false

  const words = normalizedMessage.split(/\s+/)

  if (config.match_mode === 'all') {
    return config.keywords.every(kw => {
      const nkw = normalizeText(kw)
      return words.some(w => w.includes(nkw))
    })
  }

  // match_mode === 'any'
  return config.keywords.some(kw => {
    const nkw = normalizeText(kw)
    return words.some(w => w.includes(nkw))
  })
}

/**
 * Convert a database row to a typed Flow object.
 */
export function rowToFlow(row: Record<string, unknown>): Flow {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    status: row.status as Flow['status'],
    is_template: row.is_template as boolean,
    business_type: (row.business_type as string) ?? null,
    trigger_type: row.trigger_type as Flow['trigger_type'],
    trigger_config: (row.trigger_config ?? {}) as TriggerConfig,
    nodes: (row.nodes ?? []) as FlowNode[],
    edges: (row.edges ?? []) as FlowEdge[],
    viewport: (row.viewport ?? { x: 0, y: 0, zoom: 1 }) as Flow['viewport'],
    priority: (row.priority as number) ?? 0,
    times_triggered: (row.times_triggered as number) ?? 0,
    times_completed: (row.times_completed as number) ?? 0,
    last_triggered_at: (row.last_triggered_at as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}
