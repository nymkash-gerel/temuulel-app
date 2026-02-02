/**
 * Flow state read/write helpers.
 *
 * Stores flow execution state in conversations.metadata.flow_state,
 * following the same pattern as conversation-state.ts uses
 * conversations.metadata.conversation_state.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlowState } from './flow-types'

/**
 * Read the active flow state from a conversation's metadata.
 * Returns null if no flow is active.
 */
export async function readFlowState(
  supabase: SupabaseClient,
  conversationId: string
): Promise<FlowState | null> {
  if (!conversationId) return null

  const { data } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single()

  if (!data?.metadata) return null

  const meta = data.metadata as Record<string, unknown>
  const flowState = meta.flow_state as FlowState | undefined

  if (!flowState?.flow_id || !flowState?.current_node_id) return null

  return flowState
}

/**
 * Write flow state to a conversation's metadata.
 * Pass null to clear the flow state (flow completed/abandoned).
 * Preserves existing metadata fields (conversation_state, etc.).
 */
export async function writeFlowState(
  supabase: SupabaseClient,
  conversationId: string,
  flowState: FlowState | null
): Promise<void> {
  if (!conversationId) return

  // Read existing metadata to preserve other fields
  const { data } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .single()

  const existingMeta = (data?.metadata || {}) as Record<string, unknown>

  await supabase
    .from('conversations')
    .update({
      metadata: {
        ...existingMeta,
        flow_state: flowState,
      },
    })
    .eq('id', conversationId)
}
