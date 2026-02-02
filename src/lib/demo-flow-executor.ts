/**
 * Demo flow executor — runs flow templates with mock data.
 *
 * Wraps the real `executeFlowStep()` with a mock Supabase client
 * that returns static demo data instead of querying the database.
 * This allows visitors to experience flows without signup or DB access.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Flow, FlowState, FlowStepResult } from './flow-types'
import { getFlowTemplate, type FlowTemplate } from './flow-templates'
import { getDemoItems } from './demo-flow-data'
import { executeFlowStep } from './flow-executor'

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

/**
 * Chainable mock query builder that records method calls
 * and resolves to demo data when awaited.
 */
class MockQueryBuilder {
  private _table: string
  private _businessType: string
  private _operation: 'select' | 'insert' | 'update' | 'rpc' = 'select'
  private _filters: Record<string, string> = {}
  private _limit = 10
  private _isSingle = false
  private _ilikeField: string | null = null
  private _ilikeValue: string | null = null

  constructor(table: string, businessType: string) {
    this._table = table
    this._businessType = businessType
  }

  select(_columns?: string, _options?: Record<string, unknown>): this {
    this._operation = 'select'
    return this
  }

  insert(_data: unknown): this {
    this._operation = 'insert'
    return this
  }

  update(_data: unknown): this {
    this._operation = 'update'
    return this
  }

  eq(_column: string, value: unknown): this {
    this._filters[_column] = String(value ?? '')
    return this
  }

  ilike(_column: string, value: string): this {
    this._ilikeField = _column
    this._ilikeValue = value
    return this
  }

  limit(n: number): this {
    this._limit = n
    return this
  }

  order(_column: string, _opts?: Record<string, unknown>): this {
    return this
  }

  single(): this {
    this._isSingle = true
    return this
  }

  range(_from: number, _to: number): this {
    return this
  }

  private _resolve(): { data: unknown; error: null; count?: number } {
    // Insert operations return a mock ID
    if (this._operation === 'insert') {
      const mockId = `demo-${this._table}-${Date.now()}`
      if (this._isSingle) {
        return { data: { id: mockId }, error: null }
      }
      return { data: [{ id: mockId }], error: null }
    }

    // Update operations are no-ops
    if (this._operation === 'update') {
      return { data: null, error: null }
    }

    // Select: return demo items
    if (this._table === 'products' || this._table === 'services') {
      const category = this._ilikeValue?.replace(/%/g, '') || undefined
      const items = getDemoItems(
        this._businessType,
        this._table as 'products' | 'services',
        { category, limit: this._limit }
      )
      if (this._isSingle) {
        return { data: items[0] ?? null, error: null }
      }
      return { data: items, error: null }
    }

    // Other tables: return empty
    if (this._isSingle) {
      return { data: null, error: null }
    }
    return { data: [], error: null }
  }

  // Make the builder thenable so `await query` works
  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = this._resolve()
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

/**
 * Create a mock SupabaseClient that returns demo data.
 */
function createMockSupabase(businessType: string): SupabaseClient {
  const mock = {
    from(table: string) {
      return new MockQueryBuilder(table, businessType)
    },
    rpc(_fn: string, _params?: unknown) {
      return Promise.resolve({ data: null, error: null })
    },
  }
  return mock as unknown as SupabaseClient
}

// ---------------------------------------------------------------------------
// Template → Flow conversion
// ---------------------------------------------------------------------------

function templateToFlow(template: FlowTemplate): Flow {
  return {
    id: `demo-${template.business_type}`,
    store_id: 'demo-store',
    name: template.name,
    description: template.description,
    status: 'active',
    is_template: true,
    business_type: template.business_type,
    trigger_type: template.trigger_type,
    trigger_config: template.trigger_config,
    nodes: template.nodes,
    edges: template.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    priority: 0,
    times_triggered: 0,
    times_completed: 0,
    last_triggered_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const VALID_BUSINESS_TYPES = [
  'restaurant',
  'hospital',
  'beauty_salon',
  'coffee_shop',
  'fitness',
  'education',
  'dental_clinic',
  'real_estate',
  'camping_guesthouse',
] as const

export type DemoBusinessType = typeof VALID_BUSINESS_TYPES[number]

export function isValidBusinessType(type: string): type is DemoBusinessType {
  return (VALID_BUSINESS_TYPES as readonly string[]).includes(type)
}

/**
 * Start a demo flow for a given business type.
 * Returns initial messages and flow state.
 */
export async function startDemoFlow(businessType: DemoBusinessType): Promise<FlowStepResult> {
  const template = getFlowTemplate(businessType)
  if (!template) {
    return { messages: [{ type: 'text', text: 'Template not found.' }], newState: null, completed: true }
  }

  const flow = templateToFlow(template)
  const mockSupabase = createMockSupabase(businessType)

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
    log_id: 'demo-log',
  }

  return executeFlowStep(initialState, '', flow, mockSupabase, 'demo-store')
}

/**
 * Execute one step of a demo flow with the user's message.
 */
export async function executeDemoFlowStep(
  state: FlowState,
  message: string,
  businessType: DemoBusinessType
): Promise<FlowStepResult> {
  const template = getFlowTemplate(businessType)
  if (!template) {
    return { messages: [{ type: 'text', text: 'Template not found.' }], newState: null, completed: true }
  }

  const flow = templateToFlow(template)
  const mockSupabase = createMockSupabase(businessType)

  return executeFlowStep(state, message, flow, mockSupabase, 'demo-store')
}
