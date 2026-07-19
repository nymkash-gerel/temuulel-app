import { describe, it, expect } from 'vitest'
import {
  emptyState,
  resolveFollowUp,
  updateState,
  ConversationState,
  StoredProduct,
} from './conversation-state'

const PRODUCTS: StoredProduct[] = [
  { id: '1', name: 'Цагаан цамц', base_price: 35000 },
  { id: '2', name: 'Хар гутал', base_price: 89000 },
  { id: '3', name: 'Улаан цүнх', base_price: 55000 },
]

function stateWith(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    last_intent: 'product_search',
    last_products: PRODUCTS,
    last_query: 'хувцас',
    turn_count: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// resolveFollowUp
// ---------------------------------------------------------------------------

describe('resolveFollowUp', () => {
  it('returns null for empty state (turn_count 0)', () => {
    expect(resolveFollowUp('2', emptyState())).toBeNull()
  })

  // Number references
  it('resolves "2" to second product', () => {
    const result = resolveFollowUp('2', stateWith())
    expect(result).toEqual({ type: 'number_reference', product: PRODUCTS[1] })
  })

  it('resolves "1" to first product', () => {
    const result = resolveFollowUp('1', stateWith())
    expect(result).toEqual({ type: 'number_reference', product: PRODUCTS[0] })
  })

  it('resolves "3" to third product', () => {
    const result = resolveFollowUp('3', stateWith())
    expect(result).toEqual({ type: 'number_reference', product: PRODUCTS[2] })
  })

  it('returns null for out-of-range number "5"', () => {
    expect(resolveFollowUp('5', stateWith())).toBeNull()
  })

  it('returns null for "0"', () => {
    expect(resolveFollowUp('0', stateWith())).toBeNull()
  })

  // Ordinals
  it('resolves "эхнийх" to first product', () => {
    const result = resolveFollowUp('эхнийх', stateWith())
    expect(result).toEqual({ type: 'number_reference', product: PRODUCTS[0] })
  })

  it('resolves "сүүлийнх" to last product', () => {
    const result = resolveFollowUp('сүүлийнх', stateWith())
    expect(result).toEqual({ type: 'number_reference', product: PRODUCTS[2] })
  })

  // Ordinal/number + buy verb must order the REFERENCED item, not always the first.
  it('resolves "хоёр дахийг нь авъя" to order_intent for the 2nd product', () => {
    const result = resolveFollowUp('хоёр дахийг нь авъя', stateWith())
    expect(result).toEqual({ type: 'order_intent', product: PRODUCTS[1] })
  })

  it('resolves "гурав дахийг авъя" to order_intent for the 3rd product', () => {
    const result = resolveFollowUp('гурав дахийг авъя', stateWith())
    expect(result).toEqual({ type: 'order_intent', product: PRODUCTS[2] })
  })

  it('resolves "2 дахийг авъя" (digit form) to order_intent for the 2nd product', () => {
    const result = resolveFollowUp('2 дахийг авъя', stateWith())
    expect(result).toEqual({ type: 'order_intent', product: PRODUCTS[1] })
  })

  it('resolves "эхнийхийг авъя" to order_intent for the 1st product', () => {
    const result = resolveFollowUp('эхнийхийг авъя', stateWith())
    expect(result).toEqual({ type: 'order_intent', product: PRODUCTS[0] })
  })

  it('still defaults to the first product for a bare buy verb with no reference', () => {
    const result = resolveFollowUp('авъя', stateWith())
    expect(result).toEqual({ type: 'order_intent', product: PRODUCTS[0] })
  })

  it('resolves standalone accusative ordinal "хоёр дахийг" to the 2nd product', () => {
    const result = resolveFollowUp('хоёр дахийг', stateWith())
    expect(result).toEqual({ type: 'number_reference', product: PRODUCTS[1] })
  })

  // Select single
  it('resolves "энийг авъя" when exactly 1 product', () => {
    const state = stateWith({ last_products: [PRODUCTS[0]] })
    const result = resolveFollowUp('энийг авъя', state)
    expect(result?.type).toBe('select_single')
    expect(result?.product).toEqual(PRODUCTS[0])
  })

  it('does not resolve "энийг авъя" with 3 products', () => {
    const result = resolveFollowUp('энийг авъя', stateWith())
    // Should not match select_single since there are 3 products
    expect(result?.type).not.toBe('select_single')
  })

  // Price question
  it('resolves "үнэ хэд" as price question', () => {
    const result = resolveFollowUp('үнэ хэд', stateWith())
    expect(result).toEqual({ type: 'price_question', products: PRODUCTS })
  })

  it('does not resolve price question without products', () => {
    const state = stateWith({ last_products: [] })
    expect(resolveFollowUp('үнэ хэд', state)).toBeNull()
  })

  // Query refinement
  it('resolves color refinement "улаан" after product_search', () => {
    const result = resolveFollowUp('улаан', stateWith())
    expect(result).toEqual({
      type: 'query_refinement',
      refinedQuery: 'хувцас улаан',
    })
  })

  it('does not resolve refinement after greeting intent', () => {
    const state = stateWith({ last_intent: 'greeting' })
    expect(resolveFollowUp('улаан', state)).toBeNull()
  })

  it('does not resolve refinement without last_query', () => {
    const state = stateWith({ last_query: '' })
    expect(resolveFollowUp('улаан', state)).toBeNull()
  })

  // Prefer LLM — emotional
  it('returns prefer_llm for emotional message', () => {
    const state = stateWith({ last_products: [] })
    const result = resolveFollowUp('яагаад ингэж удаж байна', state)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'emotional' })
  })

  it('returns prefer_llm for "тусална уу"', () => {
    const state = stateWith({ last_products: [], last_intent: 'general' })
    const result = resolveFollowUp('тусална уу', state)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'emotional' })
  })

  // Prefer LLM — repeated low confidence
  it('returns prefer_llm on repeated low_confidence', () => {
    const state = stateWith({ last_intent: 'low_confidence', last_products: [] })
    const result = resolveFollowUp('ааа юу гэсэн юм', state)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'repeated_low_confidence' })
  })

  it('does not return prefer_llm for low_confidence on first turn', () => {
    expect(resolveFollowUp('ааа', emptyState())).toBeNull()
  })

  // Non follow-up
  it('returns null for unrelated message', () => {
    expect(resolveFollowUp('сайн байна уу', stateWith())).toBeNull()
  })

  // Order draft — variant selection
  it('returns order_step_input when order_draft exists (variant step)', () => {
    const state = stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'variant',
      },
    })
    const result = resolveFollowUp('12', state)
    expect(result).toEqual({ type: 'order_step_input' })
  })

  it('order_step_input beats number_reference when order_draft active', () => {
    const state = stateWith({
      last_products: PRODUCTS,
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'variant',
      },
    })
    const result = resolveFollowUp('2', state)
    expect(result).toEqual({ type: 'order_step_input' })
  })

  it('order_cancel beats order_step_input for cancel phrases', () => {
    const state = stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'name',
      },
    })
    const result = resolveFollowUp('болих', state)
    expect(result).toEqual({ type: 'order_cancel' })
  })

  it('greeting resets order draft context (does not return order_step_input)', () => {
    const state = stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'name',
      },
    })
    const result = resolveFollowUp('сайн байна', state)
    expect(result?.type).not.toBe('order_step_input')
  })
})

// ---------------------------------------------------------------------------
// updateState
// ---------------------------------------------------------------------------

describe('updateState', () => {
  it('replaces products on product_search', () => {
    const newProducts = [{ id: '9', name: 'Шинэ', base_price: 10000 }]
    const next = updateState(stateWith(), 'product_search', newProducts, 'гутал')
    expect(next.last_products).toEqual(newProducts)
    expect(next.last_query).toBe('гутал')
    expect(next.last_intent).toBe('product_search')
    expect(next.turn_count).toBe(2)
  })

  it('preserves products on greeting', () => {
    const next = updateState(stateWith(), 'greeting', [], '')
    expect(next.last_products).toEqual(PRODUCTS)
    expect(next.last_query).toBe('хувцас')
    expect(next.last_intent).toBe('product_search') // preserved
  })

  it('preserves products on thanks', () => {
    const next = updateState(stateWith(), 'thanks', [], '')
    expect(next.last_products).toEqual(PRODUCTS)
  })

  it('preserves products on complaint intent', () => {
    const next = updateState(stateWith(), 'complaint', [], '')
    expect(next.last_products).toEqual(PRODUCTS)
    expect(next.last_query).toBe('хувцас')
    expect(next.last_intent).toBe('product_search') // preserveIntent keeps previous
  })

  it('preserves products on shipping intent', () => {
    const next = updateState(stateWith(), 'shipping', [], '')
    expect(next.last_products).toEqual(PRODUCTS)
    expect(next.last_query).toBe('хувцас')
  })

  it('increments turn_count', () => {
    const next = updateState(stateWith({ turn_count: 5 }), 'general', [], '')
    expect(next.turn_count).toBe(6)
  })

  it('caps last_products at 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      id: String(i), name: `P${i}`, base_price: 1000,
    }))
    const next = updateState(emptyState(), 'product_search', many, 'test')
    expect(next.last_products).toHaveLength(10)
  })

  it('preserves customer_prefs across state updates', () => {
    const prefs = { weight_kg: 65, height_cm: 170, preferred_size: 'M' }
    const state = stateWith({ customer_prefs: prefs })
    const next = updateState(state, 'order_collection', [], '')
    expect(next.customer_prefs).toEqual(prefs)
  })

  it('preserves products on order_collection intent', () => {
    const next = updateState(stateWith(), 'order_collection', [], '')
    expect(next.last_products).toEqual(PRODUCTS)
    expect(next.last_query).toBe('хувцас')
  })
})
