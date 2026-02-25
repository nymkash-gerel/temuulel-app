import { describe, test, expect } from 'vitest'
import { resolveFollowUp } from '../src/lib/conversation-state'
import type { ConversationState } from '../src/lib/conversation-state'

describe('Greeting resets order draft', () => {
  test('hi should NOT resume order draft', () => {
    const state: ConversationState = {
      turn_count: 1,
      last_intent: 'order_collection',
      last_products: [],
      order_draft: {
        product_id: '123',
        product_name: 'Test Product',
        variant_id: null,
        variant_label: null,
        unit_price: 50000,
        quantity: 1,
        address: null,
        phone: null,
        step: 'info',
      },
      gift_card_draft: null,
      pending_gift_card_code: null,
    }

    // User types "hi" - should be treated as conversation reset, NOT order input
    const result = resolveFollowUp('hi', state)
    expect(result).toBeNull() // null means "not a followup, use normal classification"
  })

  test('hello should NOT resume order draft', () => {
    const state: ConversationState = {
      turn_count: 1,
      last_intent: 'order_collection',
      last_products: [],
      order_draft: {
        product_id: '123',
        product_name: 'Test Product',
        variant_id: null,
        variant_label: null,
        unit_price: 50000,
        quantity: 1,
        address: null,
        phone: null,
        step: 'info',
      },
      gift_card_draft: null,
      pending_gift_card_code: null,
    }

    const result = resolveFollowUp('hello', state)
    expect(result).toBeNull()
  })

  test('Сайн байна уу should NOT resume order draft', () => {
    const state: ConversationState = {
      turn_count: 1,
      last_intent: 'order_collection',
      last_products: [],
      order_draft: {
        product_id: '123',
        product_name: 'Test Product',
        variant_id: null,
        variant_label: null,
        unit_price: 50000,
        quantity: 1,
        address: null,
        phone: null,
        step: 'info',
      },
      gift_card_draft: null,
      pending_gift_card_code: null,
    }

    const result = resolveFollowUp('Сайн байна уу', state)
    expect(result).toBeNull()
  })

  test('Phone number SHOULD resume order draft', () => {
    const state: ConversationState = {
      turn_count: 1,
      last_intent: 'order_collection',
      last_products: [],
      order_draft: {
        product_id: '123',
        product_name: 'Test Product',
        variant_id: null,
        variant_label: null,
        unit_price: 50000,
        quantity: 1,
        address: null,
        phone: null,
        step: 'info',
      },
      gift_card_draft: null,
      pending_gift_card_code: null,
    }

    // User provides phone - should continue order flow
    const result = resolveFollowUp('99887766', state)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('order_step_input')
  })
})
