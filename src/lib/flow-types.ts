/**
 * TypeScript types for the visual flow builder.
 *
 * Flows are stored as JSON node/edge graphs in the `flows` table.
 * At runtime the flow executor walks the graph, sending messages
 * and collecting variables from the customer.
 */

// ---------------------------------------------------------------------------
// Trigger types
// ---------------------------------------------------------------------------

export type TriggerType = 'keyword' | 'new_conversation' | 'button_click' | 'intent_match'

export interface KeywordTriggerConfig {
  keywords: string[]
  match_mode: 'any' | 'all'
}

export interface ButtonClickTriggerConfig {
  payload: string
}

export interface IntentMatchTriggerConfig {
  intents: string[]
}

export type TriggerConfig =
  | KeywordTriggerConfig
  | ButtonClickTriggerConfig
  | IntentMatchTriggerConfig
  | Record<string, never> // new_conversation has no config

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

export type FlowNodeType =
  | 'trigger'
  | 'send_message'
  | 'ask_question'
  | 'button_choice'
  | 'condition'
  | 'api_action'
  | 'show_items'
  | 'handoff'
  | 'delay'
  | 'end'

// --- Per-node config ---

export interface TriggerNodeConfig {
  type: 'trigger'
}

export interface SendMessageConfig {
  type: 'send_message'
  text: string // supports {{variable}} interpolation
  delay_ms?: number
}

export type ValidationRule = 'phone' | 'email' | 'number' | 'date' | 'text'

export interface AskQuestionConfig {
  type: 'ask_question'
  question_text: string
  variable_name: string
  validation?: ValidationRule
  error_message?: string
}

export interface ButtonOption {
  label: string
  value: string
}

export interface ButtonChoiceConfig {
  type: 'button_choice'
  question_text: string
  variable_name: string
  buttons: ButtonOption[]
}

export interface ConditionRule {
  variable: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists'
  value: string
  next_node_id: string
}

export interface ConditionConfig {
  type: 'condition'
  conditions: ConditionRule[]
  default_node_id: string
}

export type ApiActionType =
  | 'create_appointment'
  | 'create_order'
  | 'search_products'
  | 'search_services'
  | 'lookup_customer'
  | 'webhook'

export interface ApiActionConfig {
  type: 'api_action'
  action_type: ApiActionType
  action_config: Record<string, unknown>
}

export interface ShowItemsConfig {
  type: 'show_items'
  source: 'products' | 'services' | 'variable'
  variable_name?: string
  filter_category?: string // supports {{variable}}
  max_items?: number
  display_format: 'list' | 'cards'
  selection_variable?: string // if set, waits for selection
}

export interface HandoffConfig {
  type: 'handoff'
  message?: string
}

export interface DelayConfig {
  type: 'delay'
  seconds: number
  typing_indicator: boolean
}

export interface EndConfig {
  type: 'end'
  message?: string
}

export type NodeConfig =
  | TriggerNodeConfig
  | SendMessageConfig
  | AskQuestionConfig
  | ButtonChoiceConfig
  | ConditionConfig
  | ApiActionConfig
  | ShowItemsConfig
  | HandoffConfig
  | DelayConfig
  | EndConfig

// ---------------------------------------------------------------------------
// Graph types (stored in flows.nodes / flows.edges)
// ---------------------------------------------------------------------------

export interface FlowNode {
  id: string
  type: FlowNodeType
  position: { x: number; y: number }
  data: {
    label: string
    config: NodeConfig
  }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string // e.g. "button_0", "condition_0", "default"
  label?: string
}

// ---------------------------------------------------------------------------
// Flow (matches flows table row)
// ---------------------------------------------------------------------------

export interface Flow {
  id: string
  store_id: string
  name: string
  description?: string | null
  status: 'draft' | 'active' | 'archived'
  is_template: boolean
  business_type?: string | null
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: { x: number; y: number; zoom: number }
  priority: number
  times_triggered: number
  times_completed: number
  last_triggered_at?: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Flow runtime state (stored in conversations.metadata.flow_state)
// ---------------------------------------------------------------------------

export interface FlowState {
  flow_id: string
  current_node_id: string
  variables: Record<string, unknown>
  waiting_for_input: boolean
  started_at: string
  log_id: string
}

// ---------------------------------------------------------------------------
// Flow executor result
// ---------------------------------------------------------------------------

export interface FlowMessage {
  type: 'text' | 'quick_replies' | 'product_cards'
  text?: string
  quick_replies?: { title: string; payload: string }[]
  products?: { id: string; name: string; price: number; description?: string; image_url?: string }[]
}

export interface FlowStepResult {
  messages: FlowMessage[]
  newState: FlowState | null // null = flow completed
  completed: boolean
}

// ---------------------------------------------------------------------------
// Flow trigger context
// ---------------------------------------------------------------------------

export interface TriggerContext {
  is_new_conversation: boolean
  quick_reply_payload?: string
  classified_intent?: string
}
