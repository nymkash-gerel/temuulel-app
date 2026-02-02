import { describe, it, expect } from 'vitest'
import { matchesTrigger } from './flow-trigger'
import { normalizeText } from './chat-ai'
import type { Flow, TriggerContext } from './flow-types'

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-1',
    store_id: 'store-1',
    name: 'Test Flow',
    description: null,
    status: 'active',
    is_template: false,
    business_type: null,
    trigger_type: 'keyword',
    trigger_config: { keywords: ['захиалга', 'order'], match_mode: 'any' as const },
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    priority: 0,
    times_triggered: 0,
    times_completed: 0,
    last_triggered_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const defaultContext: TriggerContext = {
  is_new_conversation: false,
  quick_reply_payload: undefined,
  classified_intent: undefined,
}

describe('flow-trigger', () => {
  describe('keyword trigger', () => {
    it('matches when message contains keyword (any mode)', () => {
      const flow = makeFlow()
      expect(matchesTrigger(flow, 'захиалга хийх', defaultContext)).toBe(true)
    })

    it('matches English keyword in trigger config (pre-normalized)', () => {
      const flow = makeFlow({
        trigger_config: { keywords: ['order', 'захиалга'], match_mode: 'any' },
      })
      // matchesTrigger receives pre-normalized text from findMatchingFlow
      const normalized = normalizeText('i want to order please')
      expect(matchesTrigger(flow, normalized, defaultContext)).toBe(true)
    })

    it('does not match unrelated message', () => {
      const flow = makeFlow()
      expect(matchesTrigger(flow, 'сайн байна уу', defaultContext)).toBe(false)
    })

    it('matches all mode when all keywords present', () => {
      const flow = makeFlow({
        trigger_config: { keywords: ['захиалга', 'хүргэлт'], match_mode: 'all' },
      })
      expect(matchesTrigger(flow, 'захиалга хүргэлттэй', defaultContext)).toBe(true)
    })

    it('does not match all mode when only some keywords present', () => {
      const flow = makeFlow({
        trigger_config: { keywords: ['захиалга', 'хүргэлт'], match_mode: 'all' },
      })
      expect(matchesTrigger(flow, 'захиалга хийе', defaultContext)).toBe(false)
    })

    it('returns false for empty keywords', () => {
      const flow = makeFlow({
        trigger_config: { keywords: [], match_mode: 'any' },
      })
      expect(matchesTrigger(flow, 'anything', defaultContext)).toBe(false)
    })
  })

  describe('new_conversation trigger', () => {
    it('matches when conversation is new', () => {
      const flow = makeFlow({ trigger_type: 'new_conversation', trigger_config: {} })
      expect(matchesTrigger(flow, '', { ...defaultContext, is_new_conversation: true })).toBe(true)
    })

    it('does not match existing conversation', () => {
      const flow = makeFlow({ trigger_type: 'new_conversation', trigger_config: {} })
      expect(matchesTrigger(flow, 'hello', { ...defaultContext, is_new_conversation: false })).toBe(false)
    })
  })

  describe('button_click trigger', () => {
    it('matches when payload matches', () => {
      const flow = makeFlow({
        trigger_type: 'button_click',
        trigger_config: { payload: 'START_ORDER' },
      })
      expect(matchesTrigger(flow, '', { ...defaultContext, quick_reply_payload: 'START_ORDER' })).toBe(true)
    })

    it('does not match different payload', () => {
      const flow = makeFlow({
        trigger_type: 'button_click',
        trigger_config: { payload: 'START_ORDER' },
      })
      expect(matchesTrigger(flow, '', { ...defaultContext, quick_reply_payload: 'OTHER' })).toBe(false)
    })
  })

  describe('intent_match trigger', () => {
    it('matches when intent is in the list', () => {
      const flow = makeFlow({
        trigger_type: 'intent_match',
        trigger_config: { intents: ['product_search', 'order_status'] },
      })
      expect(matchesTrigger(flow, '', { ...defaultContext, classified_intent: 'product_search' })).toBe(true)
    })

    it('does not match unrelated intent', () => {
      const flow = makeFlow({
        trigger_type: 'intent_match',
        trigger_config: { intents: ['product_search'] },
      })
      expect(matchesTrigger(flow, '', { ...defaultContext, classified_intent: 'greeting' })).toBe(false)
    })

    it('does not match when no intent classified', () => {
      const flow = makeFlow({
        trigger_type: 'intent_match',
        trigger_config: { intents: ['product_search'] },
      })
      expect(matchesTrigger(flow, '', defaultContext)).toBe(false)
    })
  })
})
