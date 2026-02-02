/**
 * Flow executor — walks the node graph and generates responses.
 *
 * Called by the chat pipeline when a flow is active.
 * Processes nodes sequentially, pausing at nodes that need user input
 * (ask_question, button_choice, show_items with selection).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Flow,
  FlowNode,
  FlowEdge,
  FlowState,
  FlowStepResult,
  FlowMessage,
  SendMessageConfig,
  AskQuestionConfig,
  ButtonChoiceConfig,
  ConditionConfig,
  ApiActionConfig,
  ShowItemsConfig,
  HandoffConfig,
  DelayConfig,
  EndConfig,
  ValidationRule,
} from './flow-types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute one step of a flow, processing the user's message.
 *
 * If the current node is waiting for input (ask_question, button_choice),
 * processes the user's response. Then advances through non-input nodes
 * (send_message, condition, delay, etc.) until hitting another input node or end.
 */
export async function executeFlowStep(
  state: FlowState,
  userMessage: string,
  flow: Flow,
  supabase: SupabaseClient,
  storeId: string
): Promise<FlowStepResult> {
  const messages: FlowMessage[] = []
  let currentNodeId = state.current_node_id
  let variables = { ...state.variables }
  let nodesVisited = 0
  const MAX_NODES = 50 // safety limit to prevent infinite loops

  // If waiting for input, process the response first
  if (state.waiting_for_input) {
    const currentNode = findNode(flow, currentNodeId)
    if (!currentNode) return flowError(state, 'Node not found')

    const inputResult = processUserInput(currentNode, userMessage, variables)
    if (inputResult.error) {
      // Validation failed — re-ask
      messages.push({ type: 'text', text: inputResult.error })
      return {
        messages,
        newState: { ...state, variables },
        completed: false,
      }
    }

    variables = { ...variables, ...inputResult.variables }

    // For button_choice, branch to the selected button's edge
    if (currentNode.type === 'button_choice') {
      const nextId = resolveButtonEdge(flow, currentNode, inputResult.selectedValue ?? '')
      if (nextId) {
        currentNodeId = nextId
      } else {
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
      }
    } else {
      currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
    }
  }

  // Walk forward through non-input nodes
  while (currentNodeId && nodesVisited < MAX_NODES) {
    nodesVisited++
    const node = findNode(flow, currentNodeId)
    if (!node) break

    switch (node.type) {
      case 'trigger': {
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
        break
      }

      case 'send_message': {
        const config = node.data.config as SendMessageConfig
        const text = interpolateVariables(config.text, variables)
        messages.push({ type: 'text', text })
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
        break
      }

      case 'ask_question': {
        const config = node.data.config as AskQuestionConfig
        const text = interpolateVariables(config.question_text, variables)
        messages.push({ type: 'text', text })
        return {
          messages,
          newState: {
            ...state,
            current_node_id: currentNodeId,
            variables,
            waiting_for_input: true,
          },
          completed: false,
        }
      }

      case 'button_choice': {
        const config = node.data.config as ButtonChoiceConfig
        const text = interpolateVariables(config.question_text, variables)
        messages.push({
          type: 'quick_replies',
          text,
          quick_replies: config.buttons.map((b, i) => ({
            title: b.label,
            payload: `flow_btn_${i}_${b.value}`,
          })),
        })
        return {
          messages,
          newState: {
            ...state,
            current_node_id: currentNodeId,
            variables,
            waiting_for_input: true,
          },
          completed: false,
        }
      }

      case 'condition': {
        const config = node.data.config as ConditionConfig
        const nextId = evaluateCondition(config, variables, flow, currentNodeId)
        currentNodeId = nextId
        break
      }

      case 'api_action': {
        const config = node.data.config as ApiActionConfig
        const result = await executeApiAction(config, variables, supabase, storeId)
        variables = { ...variables, ...result }
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
        break
      }

      case 'show_items': {
        const config = node.data.config as ShowItemsConfig
        const itemMessages = await processShowItems(config, variables, supabase, storeId)
        messages.push(...itemMessages)

        if (config.selection_variable) {
          // Wait for user to select
          return {
            messages,
            newState: {
              ...state,
              current_node_id: currentNodeId,
              variables,
              waiting_for_input: true,
            },
            completed: false,
          }
        }
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
        break
      }

      case 'handoff': {
        const config = node.data.config as HandoffConfig
        if (config.message) {
          messages.push({ type: 'text', text: interpolateVariables(config.message, variables) })
        } else {
          messages.push({ type: 'text', text: 'Та түр хүлээнэ үү, оператор тантай холбогдоно.' })
        }
        // Mark conversation as escalated
        await supabase
          .from('conversations')
          .update({ status: 'escalated', escalated_at: new Date().toISOString() })
          .eq('id', state.log_id ? undefined : '') // handled by caller

        return { messages, newState: null, completed: true }
      }

      case 'delay': {
        const config = node.data.config as DelayConfig
        // Delay is informational — the actual pause is handled by the route
        if (config.typing_indicator) {
          // The caller handles typing indicators; just advance
        }
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
        break
      }

      case 'end': {
        const config = node.data.config as EndConfig
        if (config.message) {
          messages.push({ type: 'text', text: interpolateVariables(config.message, variables) })
        }
        // Complete the flow
        return { messages, newState: null, completed: true }
      }

      default:
        currentNodeId = getNextNodeId(flow, currentNodeId) ?? ''
    }
  }

  // If we exited the loop without hitting an end node, the flow is broken
  if (!currentNodeId) {
    return { messages, newState: null, completed: true }
  }

  return {
    messages,
    newState: { ...state, current_node_id: currentNodeId, variables, waiting_for_input: false },
    completed: false,
  }
}

/**
 * Start a new flow: create a log entry, set initial state, and execute
 * from the trigger node.
 */
export async function startFlow(
  flow: Flow,
  supabase: SupabaseClient,
  conversationId: string,
  storeId: string
): Promise<FlowStepResult> {
  // Create execution log
  const { data: log } = await supabase
    .from('flow_execution_logs')
    .insert({
      store_id: storeId,
      flow_id: flow.id,
      conversation_id: conversationId,
      status: 'running',
    })
    .select('id')
    .single()

  const logId = log?.id ?? ''

  // Increment trigger stats
  await supabase.rpc('increment_flow_stats', {
    p_flow_id: flow.id,
    p_increment_triggered: 1,
    p_increment_completed: 0,
  })

  // Find trigger node
  const triggerNode = flow.nodes.find(n => n.type === 'trigger')
  if (!triggerNode) {
    return { messages: [], newState: null, completed: true }
  }

  const initialState: FlowState = {
    flow_id: flow.id,
    current_node_id: triggerNode.id,
    variables: {},
    waiting_for_input: false,
    started_at: new Date().toISOString(),
    log_id: logId,
  }

  // Execute from trigger node onward
  const result = await executeFlowStep(initialState, '', flow, supabase, storeId)

  // If flow completed immediately, complete the execution log
  if (result.completed && logId) {
    await completeFlowExecution(supabase, initialState, initialState.current_node_id)
  }

  return result
}

/**
 * Mark a flow execution as completed and update analytics.
 */
export async function completeFlowExecution(
  supabase: SupabaseClient,
  state: FlowState,
  exitNodeId?: string
): Promise<void> {
  if (!state.log_id) return

  await supabase
    .from('flow_execution_logs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      variables_collected: state.variables,
      exit_node_id: exitNodeId ?? null,
    })
    .eq('id', state.log_id)

  await supabase.rpc('increment_flow_stats', {
    p_flow_id: state.flow_id,
    p_increment_triggered: 0,
    p_increment_completed: 1,
  })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Common Mongolian words/phrases that indicate a date or day of the week. */
const MONGOLIAN_DATE_WORDS = /^(өнөөдөр|маргааш|нөгөөдөр|даваа|мягмар|лхагва|пүрэв|баасан|бямба|ням|дараа\s*долоо\s*хоног|энэ\s*долоо\s*хоног|ирэх\s*долоо\s*хоног|даваа\s*гараг|мягмар\s*гараг|лхагва\s*гараг|пүрэв\s*гараг|баасан\s*гараг|бямба\s*гараг|ням\s*гараг)/

function findNode(flow: Flow, nodeId: string): FlowNode | undefined {
  return flow.nodes.find(n => n.id === nodeId)
}

function getNextNodeId(flow: Flow, currentNodeId: string): string | null {
  const edge = flow.edges.find(e => e.source === currentNodeId && !e.sourceHandle)
    ?? flow.edges.find(e => e.source === currentNodeId)
  return edge?.target ?? null
}

function resolveButtonEdge(flow: Flow, node: FlowNode, selectedValue: string): string | null {
  const config = node.data.config as ButtonChoiceConfig
  const btnIndex = config.buttons.findIndex(
    b => b.value === selectedValue || b.label === selectedValue
  )
  if (btnIndex >= 0) {
    const edge = flow.edges.find(
      e => e.source === node.id && e.sourceHandle === `button_${btnIndex}`
    )
    if (edge) return edge.target
  }
  // Fall back to default edge
  return getNextNodeId(flow, node.id)
}

/**
 * Interpolate {{variable}} placeholders in text.
 */
export function interpolateVariables(text: string, variables: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = variables[key]
    if (val === undefined || val === null) return `{{${key}}}`
    return String(val)
  })
}

/**
 * Validate user input based on a validation rule.
 */
export function validateInput(value: string, rule?: ValidationRule): boolean {
  if (!rule || rule === 'text') return value.trim().length > 0

  switch (rule) {
    case 'phone':
      return /^\+?[\d\s\-()]{6,15}$/.test(value.trim())
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    case 'number':
      return /^\d+([.,]\d+)?$/.test(value.trim())
    case 'date':
      // Accept numeric dates (2024-02-15, 02/15, 3-р сарын 10)
      // AND common Mongolian text dates (маргааш, нөгөөдөр, даваа гараг, etc.)
      if (value.trim().length < 2) return false
      if (/\d/.test(value)) return true
      return MONGOLIAN_DATE_WORDS.test(value.trim().toLowerCase())
    default:
      return true
  }
}

interface InputProcessResult {
  variables: Record<string, unknown>
  selectedValue?: string
  error?: string
}

function processUserInput(
  node: FlowNode,
  userMessage: string,
  currentVariables: Record<string, unknown>
): InputProcessResult {
  const msg = userMessage.trim()

  switch (node.type) {
    case 'ask_question': {
      const config = node.data.config as AskQuestionConfig
      if (!validateInput(msg, config.validation)) {
        return {
          variables: {},
          error: config.error_message || getDefaultValidationError(config.validation),
        }
      }
      return { variables: { [config.variable_name]: msg } }
    }

    case 'button_choice': {
      const config = node.data.config as ButtonChoiceConfig
      // Try exact match first
      const exactMatch = config.buttons.find(
        b => b.label.toLowerCase() === msg.toLowerCase() || b.value.toLowerCase() === msg.toLowerCase()
      )
      if (exactMatch) {
        return {
          variables: { [config.variable_name]: exactMatch.value },
          selectedValue: exactMatch.value,
        }
      }

      // Try matching by number (1, 2, 3...)
      const num = parseInt(msg)
      if (num > 0 && num <= config.buttons.length) {
        const btn = config.buttons[num - 1]
        return {
          variables: { [config.variable_name]: btn.value },
          selectedValue: btn.value,
        }
      }

      // Try partial match
      const partialMatch = config.buttons.find(
        b => b.label.toLowerCase().includes(msg.toLowerCase()) ||
             msg.toLowerCase().includes(b.label.toLowerCase())
      )
      if (partialMatch) {
        return {
          variables: { [config.variable_name]: partialMatch.value },
          selectedValue: partialMatch.value,
        }
      }

      // No match — re-ask
      const options = config.buttons.map((b, i) => `${i + 1}. ${b.label}`).join('\n')
      return {
        variables: {},
        error: `Дараах сонголтуудаас сонгоно уу:\n${options}`,
      }
    }

    case 'show_items': {
      const config = node.data.config as ShowItemsConfig
      if (config.selection_variable) {
        // Try number selection
        const num = parseInt(msg)
        const items = (currentVariables._last_shown_items as Array<{ name: string }>) || []
        if (num > 0 && num <= items.length) {
          const selected = items[num - 1]
          return {
            variables: { [config.selection_variable]: selected.name },
            selectedValue: selected.name,
          }
        }
        // Try name match
        const nameMatch = items.find(
          item => item.name.toLowerCase().includes(msg.toLowerCase())
        )
        if (nameMatch) {
          return {
            variables: { [config.selection_variable]: nameMatch.name },
            selectedValue: nameMatch.name,
          }
        }
        return {
          variables: {},
          error: 'Жагсаалтаас дугаар эсвэл нэрээр сонгоно уу.',
        }
      }
      return { variables: {} }
    }

    default:
      return { variables: {} }
  }
}

function getDefaultValidationError(rule?: ValidationRule): string {
  switch (rule) {
    case 'phone': return 'Зөв утасны дугаар оруулна уу (жиш: 99001122).'
    case 'email': return 'Зөв имэйл хаяг оруулна уу.'
    case 'number': return 'Тоо оруулна уу.'
    case 'date': return 'Огноо оруулна уу (жиш: 2024-02-15).'
    default: return 'Хариу оруулна уу.'
  }
}

function evaluateCondition(
  config: ConditionConfig,
  variables: Record<string, unknown>,
  flow: Flow,
  currentNodeId: string
): string {
  for (const cond of config.conditions) {
    const val = variables[cond.variable]
    const strVal = val !== undefined && val !== null ? String(val) : ''
    let matches = false

    switch (cond.operator) {
      case 'equals':
        matches = strVal.toLowerCase() === cond.value.toLowerCase()
        break
      case 'contains':
        matches = strVal.toLowerCase().includes(cond.value.toLowerCase())
        break
      case 'greater_than':
        matches = parseFloat(strVal) > parseFloat(cond.value)
        break
      case 'less_than':
        matches = parseFloat(strVal) < parseFloat(cond.value)
        break
      case 'exists':
        matches = val !== undefined && val !== null && strVal.length > 0
        break
    }

    if (matches) {
      // Use the condition's explicit next_node_id, or find edge with matching handle
      if (cond.next_node_id) return cond.next_node_id
      const idx = config.conditions.indexOf(cond)
      const edge = flow.edges.find(
        e => e.source === currentNodeId && e.sourceHandle === `condition_${idx}`
      )
      if (edge) return edge.target
    }
  }

  // Default branch
  if (config.default_node_id) return config.default_node_id
  const defaultEdge = flow.edges.find(
    e => e.source === currentNodeId && e.sourceHandle === 'default'
  )
  return defaultEdge?.target ?? ''
}

async function executeApiAction(
  config: ApiActionConfig,
  variables: Record<string, unknown>,
  supabase: SupabaseClient,
  storeId: string
): Promise<Record<string, unknown>> {
  switch (config.action_type) {
    case 'create_appointment': {
      const { data } = await supabase.from('appointments').insert({
        store_id: storeId,
        customer_name: (variables.customer_name ?? variables.name ?? variables.patient_name ?? '') as string,
        customer_phone: (variables.phone ?? variables.customer_phone ?? '') as string,
        notes: buildNotes(variables),
        status: 'pending',
        payment_status: 'pending',
        total_amount: 0,
        duration_minutes: 30,
        scheduled_at: new Date().toISOString(),
        source: 'chat',
      }).select('id').single()
      return { appointment_id: data?.id ?? null }
    }

    case 'create_order': {
      const orderNum = `ORD-${Date.now().toString(36).toUpperCase()}`
      const { data } = await supabase.from('orders').insert({
        store_id: storeId,
        order_number: orderNum,
        status: 'pending',
        payment_status: 'pending',
        total_amount: 0,
        shipping_address: (variables.address ?? '') as string,
        customer_phone: (variables.phone ?? '') as string,
        notes: buildNotes(variables),
      }).select('id').single()
      return { order_id: data?.id ?? null, order_number: orderNum }
    }

    case 'search_products': {
      const category = variables.filter_category
        ? interpolateVariables(String(variables.filter_category), variables)
        : undefined
      let query = supabase
        .from('products')
        .select('id, name, base_price, description, images')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .limit(10)
      if (category) {
        query = query.ilike('category', `%${category}%`)
      }
      const { data } = await query
      return { search_results: data ?? [] }
    }

    case 'search_services': {
      const category = variables.filter_category
        ? interpolateVariables(String(variables.filter_category), variables)
        : undefined
      let query = supabase
        .from('services')
        .select('id, name, base_price, description, duration_minutes')
        .eq('store_id', storeId)
        .eq('status', 'active')
        .limit(10)
      if (category) {
        query = query.ilike('category', `%${category}%`)
      }
      const { data } = await query
      return { search_results: data ?? [] }
    }

    case 'webhook': {
      const url = config.action_config?.url as string
      if (url) {
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store_id: storeId, variables }),
            signal: AbortSignal.timeout(5000),
          })
          const body = await resp.json().catch(() => ({}))
          return { webhook_response: body }
        } catch {
          return { webhook_error: true }
        }
      }
      return {}
    }

    default:
      return {}
  }
}

async function processShowItems(
  config: ShowItemsConfig,
  variables: Record<string, unknown>,
  supabase: SupabaseClient,
  storeId: string
): Promise<FlowMessage[]> {
  const category = config.filter_category
    ? interpolateVariables(config.filter_category, variables)
    : undefined
  const maxItems = config.max_items ?? 8
  const messages: FlowMessage[] = []

  let items: Array<{ id: string; name: string; base_price: number; description?: string }> = []

  if (config.source === 'variable' && config.variable_name) {
    items = (variables[config.variable_name] as typeof items) ?? []
  } else {
    const table = config.source === 'services' ? 'services' : 'products'
    let query = supabase
      .from(table)
      .select('id, name, base_price, description')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .limit(maxItems)

    if (category) {
      query = query.ilike('category', `%${category}%`)
    }

    const { data } = await query
    items = (data ?? []) as typeof items
  }

  if (items.length === 0) {
    messages.push({ type: 'text', text: 'Одоогоор жагсаалт хоосон байна.' })
    return messages
  }

  // Store items for selection reference
  variables._last_shown_items = items

  if (config.display_format === 'cards') {
    messages.push({
      type: 'product_cards',
      products: items.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.base_price),
        description: item.description ?? undefined,
      })),
    })
  } else {
    // List format
    const lines = items.map((item, i) =>
      `${i + 1}. ${item.name} — ${Number(item.base_price).toLocaleString()}₮`
    )
    const text = lines.join('\n')
    messages.push({ type: 'text', text })

    if (config.selection_variable) {
      messages.push({ type: 'text', text: 'Дугаар эсвэл нэрээр сонгоно уу.' })
    }
  }

  return messages
}

function buildNotes(variables: Record<string, unknown>): string {
  const skip = new Set(['_last_shown_items', 'search_results', 'appointment_id', 'order_id', 'order_number', 'webhook_response', 'webhook_error'])
  const entries = Object.entries(variables)
    .filter(([k]) => !skip.has(k) && !k.startsWith('_'))
    .map(([k, v]) => `${k}: ${String(v)}`)
  return entries.join(', ')
}

function flowError(state: FlowState, msg: string): FlowStepResult {
  return {
    messages: [{ type: 'text', text: `Уучлаарай, алдаа гарлаа. ${msg}` }],
    newState: null,
    completed: true,
  }
}
