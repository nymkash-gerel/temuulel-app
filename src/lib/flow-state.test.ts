import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readFlowState, writeFlowState } from './flow-state'
import type { FlowState } from './flow-types'

function createMockSupabase(metadata: Record<string, unknown> | null = null) {
  const singleFn = vi.fn().mockResolvedValue({
    data: metadata !== null ? { metadata } : null,
  })

  const eqFns: ReturnType<typeof vi.fn>[] = []
  const updateFn = vi.fn()

  const createEq = (): ReturnType<typeof vi.fn> => {
    const fn = vi.fn()
    eqFns.push(fn)
    fn.mockReturnValue({ single: singleFn })
    return fn
  }

  const selectFn = vi.fn().mockReturnValue({
    eq: createEq(),
  })

  updateFn.mockReturnValue({
    eq: vi.fn().mockResolvedValue({}),
  })

  const mock = {
    from: vi.fn().mockReturnValue({
      select: selectFn,
      update: updateFn,
    }),
    _singleFn: singleFn,
    _selectFn: selectFn,
    _updateFn: updateFn,
  }

  return mock as unknown as SupabaseClient & typeof mock
}

describe('flow-state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('readFlowState', () => {
    it('returns null for empty conversationId', async () => {
      const supabase = createMockSupabase()
      const result = await readFlowState(supabase, '')
      expect(result).toBeNull()
    })

    it('returns null when conversation has no metadata', async () => {
      const supabase = createMockSupabase(null)
      const result = await readFlowState(supabase, 'conv-1')
      expect(result).toBeNull()
    })

    it('returns null when metadata has no flow_state', async () => {
      const supabase = createMockSupabase({ some_key: 'val' })
      const result = await readFlowState(supabase, 'conv-1')
      expect(result).toBeNull()
    })

    it('returns null when flow_state is missing flow_id', async () => {
      const supabase = createMockSupabase({
        flow_state: { current_node_id: 'n1', variables: {} },
      })
      const result = await readFlowState(supabase, 'conv-1')
      expect(result).toBeNull()
    })

    it('returns null when flow_state is missing current_node_id', async () => {
      const supabase = createMockSupabase({
        flow_state: { flow_id: 'f1', variables: {} },
      })
      const result = await readFlowState(supabase, 'conv-1')
      expect(result).toBeNull()
    })

    it('returns valid flow state', async () => {
      const state: FlowState = {
        flow_id: 'flow-1',
        current_node_id: 'node-2',
        variables: { name: 'Bat' },
        waiting_for_input: true,
        started_at: '2024-01-01T00:00:00Z',
        log_id: 'log-1',
      }
      const supabase = createMockSupabase({ flow_state: state })
      const result = await readFlowState(supabase, 'conv-1')
      expect(result).toEqual(state)
    })
  })

  describe('writeFlowState', () => {
    it('does nothing for empty conversationId', async () => {
      const supabase = createMockSupabase()
      await writeFlowState(supabase, '', null)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('merges flow_state with existing metadata', async () => {
      const existingMeta = { conversation_state: { step: 'greeting' } }
      const mock = createMockSupabase(existingMeta)

      const newState: FlowState = {
        flow_id: 'flow-1',
        current_node_id: 'node-3',
        variables: {},
        waiting_for_input: false,
        started_at: '2024-01-01T00:00:00Z',
        log_id: 'log-1',
      }

      await writeFlowState(mock, 'conv-1', newState)

      expect(mock._updateFn).toHaveBeenCalledWith({
        metadata: {
          conversation_state: { step: 'greeting' },
          flow_state: newState,
        },
      })
    })

    it('sets flow_state to null when clearing', async () => {
      const existingMeta = {
        conversation_state: { step: 'greeting' },
        flow_state: { flow_id: 'old' },
      }
      const mock = createMockSupabase(existingMeta)

      await writeFlowState(mock, 'conv-1', null)

      expect(mock._updateFn).toHaveBeenCalledWith({
        metadata: {
          conversation_state: { step: 'greeting' },
          flow_state: null,
        },
      })
    })

    it('handles missing existing metadata gracefully', async () => {
      const mock = createMockSupabase(null)

      // When data is null, metadata will be {}
      mock._singleFn.mockResolvedValue({ data: null })

      const newState: FlowState = {
        flow_id: 'flow-1',
        current_node_id: 'node-1',
        variables: {},
        waiting_for_input: false,
        started_at: '2024-01-01T00:00:00Z',
        log_id: 'log-1',
      }

      await writeFlowState(mock, 'conv-1', newState)

      expect(mock._updateFn).toHaveBeenCalledWith({
        metadata: {
          flow_state: newState,
        },
      })
    })
  })
})
