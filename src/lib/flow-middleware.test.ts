import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing
vi.mock('./flow-state', () => ({
  readFlowState: vi.fn(),
  writeFlowState: vi.fn(),
}))

vi.mock('./flow-trigger', () => ({
  findMatchingFlow: vi.fn(),
  rowToFlow: vi.fn(),
}))

vi.mock('./flow-executor', () => ({
  executeFlowStep: vi.fn(),
  startFlow: vi.fn(),
  completeFlowExecution: vi.fn(),
}))

import { interceptWithFlow } from './flow-middleware'
import { readFlowState, writeFlowState } from './flow-state'
import { findMatchingFlow, rowToFlow } from './flow-trigger'
import { executeFlowStep, startFlow, completeFlowExecution } from './flow-executor'
import type { FlowState, Flow, FlowStepResult } from './flow-types'

const mockReadFlowState = readFlowState as ReturnType<typeof vi.fn>
const mockWriteFlowState = writeFlowState as ReturnType<typeof vi.fn>
const mockFindMatchingFlow = findMatchingFlow as ReturnType<typeof vi.fn>
const mockRowToFlow = rowToFlow as ReturnType<typeof vi.fn>
const mockExecuteFlowStep = executeFlowStep as ReturnType<typeof vi.fn>
const mockStartFlow = startFlow as ReturnType<typeof vi.fn>
const mockCompleteFlowExecution = completeFlowExecution as ReturnType<typeof vi.fn>

function mockSupabase(): any {
  const singleFn = vi.fn()
  const eqFn = vi.fn().mockReturnValue({ single: singleFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) })
  const insertFn = vi.fn().mockResolvedValue({})

  return {
    from: vi.fn().mockReturnValue({
      select: selectFn,
      update: updateFn,
      insert: insertFn,
    }),
    _singleFn: singleFn,
    _eqFn: eqFn,
  }
}

describe('flow-middleware: interceptWithFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when conversationId is empty', async () => {
    const supabase = mockSupabase()
    const result = await interceptWithFlow(supabase, '', 'store-1', 'hello', { is_new_conversation: false })
    expect(result).toBeNull()
  })

  it('returns null when storeId is empty', async () => {
    const supabase = mockSupabase()
    const result = await interceptWithFlow(supabase, 'conv-1', '', 'hello', { is_new_conversation: false })
    expect(result).toBeNull()
  })

  it('returns null when no active flow and no trigger matches', async () => {
    mockReadFlowState.mockResolvedValue(null)
    mockFindMatchingFlow.mockResolvedValue(null)

    const supabase = mockSupabase()
    const result = await interceptWithFlow(supabase, 'conv-1', 'store-1', 'hello', { is_new_conversation: false })
    expect(result).toBeNull()
    expect(mockReadFlowState).toHaveBeenCalledWith(supabase, 'conv-1')
    expect(mockFindMatchingFlow).toHaveBeenCalled()
  })

  it('clears state and returns null when flow was deleted while active', async () => {
    const flowState: FlowState = {
      flow_id: 'flow-1',
      current_node_id: 'node-1',
      variables: {},
      waiting_for_input: true,
      started_at: new Date().toISOString(),
      log_id: 'log-1',
    }
    mockReadFlowState.mockResolvedValue(flowState)

    // Supabase returns no flow (deleted)
    const supabase = mockSupabase()
    const fromMock = (supabase as { from: ReturnType<typeof vi.fn> }).from
    const singleMock = vi.fn().mockResolvedValue({ data: null })
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleMock,
        }),
      }),
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    })

    const result = await interceptWithFlow(supabase, 'conv-1', 'store-1', 'hello', { is_new_conversation: false })
    expect(result).toBeNull()
    expect(mockWriteFlowState).toHaveBeenCalledWith(supabase, 'conv-1', null)
  })

  it('starts a new flow when trigger matches', async () => {
    mockReadFlowState.mockResolvedValue(null)

    const flow: Flow = {
      id: 'flow-1',
      store_id: 'store-1',
      name: 'Test Flow',
      status: 'active',
      is_template: false,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['hello'], match_mode: 'any' },
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      priority: 0,
      times_triggered: 0,
      times_completed: 0,
      created_at: '',
      updated_at: '',
    }
    mockFindMatchingFlow.mockResolvedValue(flow)

    const stepResult: FlowStepResult = {
      messages: [{ type: 'text', text: 'Welcome!' }],
      newState: {
        flow_id: 'flow-1',
        current_node_id: 'node-2',
        variables: {},
        waiting_for_input: true,
        started_at: new Date().toISOString(),
        log_id: 'log-1',
      },
      completed: false,
    }
    mockStartFlow.mockResolvedValue(stepResult)

    const supabase = mockSupabase()
    const fromMock = (supabase as { from: ReturnType<typeof vi.fn> }).from
    fromMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    })

    const result = await interceptWithFlow(supabase, 'conv-1', 'store-1', 'hello', { is_new_conversation: false })

    expect(result).not.toBeNull()
    expect(result!.intent).toBe('flow')
    expect(result!.flow_id).toBe('flow-1')
    expect(result!.response).toBe('Welcome!')
    expect(mockWriteFlowState).toHaveBeenCalled()
  })

  it('returns quick_replies when flow step produces them', async () => {
    mockReadFlowState.mockResolvedValue(null)

    const flow: Flow = {
      id: 'flow-2',
      store_id: 'store-1',
      name: 'Choice Flow',
      status: 'active',
      is_template: false,
      trigger_type: 'keyword',
      trigger_config: { keywords: ['menu'], match_mode: 'any' },
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      priority: 0,
      times_triggered: 0,
      times_completed: 0,
      created_at: '',
      updated_at: '',
    }
    mockFindMatchingFlow.mockResolvedValue(flow)

    mockStartFlow.mockResolvedValue({
      messages: [
        { type: 'text', text: 'Choose an option:' },
        { type: 'quick_replies', text: 'Choose:', quick_replies: [
          { title: 'Option A', payload: 'A' },
          { title: 'Option B', payload: 'B' },
        ]},
      ],
      newState: {
        flow_id: 'flow-2',
        current_node_id: 'node-3',
        variables: {},
        waiting_for_input: true,
        started_at: new Date().toISOString(),
        log_id: 'log-2',
      },
      completed: false,
    })

    const supabase = mockSupabase()
    const fromMock = (supabase as { from: ReturnType<typeof vi.fn> }).from
    fromMock.mockReturnValue({
      insert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }),
    })

    const result = await interceptWithFlow(supabase, 'conv-1', 'store-1', 'menu', { is_new_conversation: false })

    expect(result!.quick_replies).toBeDefined()
    expect(result!.quick_replies).toHaveLength(2)
    expect(result!.quick_replies![0].title).toBe('Option A')
  })
})
