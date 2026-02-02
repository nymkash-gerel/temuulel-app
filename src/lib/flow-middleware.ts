/**
 * Flow middleware — intercepts messages before the AI pipeline.
 *
 * Used by widget, messenger, and AI routes. If a flow handles the
 * message, returns a FlowInterceptResult. Otherwise returns null
 * and the normal AI pipeline continues.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlowMessage, TriggerContext } from './flow-types'
import { readFlowState, writeFlowState } from './flow-state'
import { findMatchingFlow, rowToFlow } from './flow-trigger'
import { executeFlowStep, startFlow, completeFlowExecution } from './flow-executor'

export interface FlowInterceptResult {
  response: string
  intent: 'flow'
  flow_id: string
  quick_replies?: { title: string; payload: string }[]
  products?: { id: string; name: string; price: number; description?: string }[]
}

/**
 * Check if a message should be handled by a flow.
 * Returns FlowInterceptResult if handled, null if the normal pipeline should run.
 */
export async function interceptWithFlow(
  supabase: SupabaseClient,
  conversationId: string,
  storeId: string,
  message: string,
  context: TriggerContext
): Promise<FlowInterceptResult | null> {
  if (!conversationId || !storeId) return null

  // 1. Active flow? → execute next step
  const flowState = await readFlowState(supabase, conversationId)

  if (flowState) {
    const { data: flowRow } = await supabase
      .from('flows')
      .select('*')
      .eq('id', flowState.flow_id)
      .single()

    if (!flowRow) {
      // Flow deleted while active — clear state
      await writeFlowState(supabase, conversationId, null)
      return null
    }

    const flow = rowToFlow(flowRow)
    const result = await executeFlowStep(flowState, message, flow, supabase, storeId)

    if (result.completed) {
      await writeFlowState(supabase, conversationId, null)
      await completeFlowExecution(supabase, flowState, flowState.current_node_id)
    } else if (result.newState) {
      await writeFlowState(supabase, conversationId, result.newState)
    }

    return saveAndFormat(supabase, conversationId, result.messages, flowState.flow_id)
  }

  // 2. Does the message trigger a new flow?
  const matched = await findMatchingFlow(supabase, storeId, message, context)
  if (!matched) return null

  const result = await startFlow(matched, supabase, conversationId, storeId)

  if (result.newState) {
    await writeFlowState(supabase, conversationId, result.newState)
  }
  // startFlow auto-completes the execution log if the flow finishes immediately

  return saveAndFormat(supabase, conversationId, result.messages, matched.id)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function saveAndFormat(
  supabase: SupabaseClient,
  conversationId: string,
  messages: FlowMessage[],
  flowId: string
): Promise<FlowInterceptResult> {
  const responseText = messages
    .filter(m => m.text)
    .map(m => m.text!)
    .join('\n\n')

  // Save flow response as a message in the conversation
  if (responseText) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: responseText,
      is_from_customer: false,
      is_ai_response: true,
      metadata: { intent: 'flow', flow_id: flowId },
    })
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
  }

  const result: FlowInterceptResult = {
    response: responseText,
    intent: 'flow',
    flow_id: flowId,
  }

  // Extract quick replies (first message with quick_replies)
  const qrMsg = messages.find(m => m.type === 'quick_replies' && m.quick_replies)
  if (qrMsg?.quick_replies) result.quick_replies = qrMsg.quick_replies

  // Extract product cards (first message with products)
  const pcMsg = messages.find(m => m.type === 'product_cards' && m.products)
  if (pcMsg?.products) result.products = pcMsg.products

  return result
}
