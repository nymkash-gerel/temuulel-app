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

  it('resolves "2-г авъя" (bare -г accusative) to order_intent for the 2nd product', () => {
    const result = resolveFollowUp('2-г авъя', stateWith())
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

  // Every form the order_cancel_request classifier recognizes must also be
  // intercepted here — otherwise mid-checkout "цуцлаач" is stored as the
  // customer's name by the order_step_input path.
  it.each([
    'Захиалгаа цуцлаач',
    'цуцлаач',
    'Захиалгаа цуцлаарай',
    'цуцламаар байна',
    'Захиалгаа цуцалъя',
    'Захиалгаа болиулмаар байна',
    'болиулаач',
    'cancel',
    'zahialgaa tsutslaach',
  ])('order_cancel intercepts mid-checkout cancel form: %s', (msg) => {
    const state = stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'name',
      },
    })
    expect(resolveFollowUp(msg, state)).toEqual({ type: 'order_cancel' })
  })

  it('a real customer name is still order_step_input at the name step', () => {
    const state = stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'name',
      },
    })
    expect(resolveFollowUp('Батбаяр', state)).toEqual({ type: 'order_step_input' })
  })

  // Negated cancel mid-checkout means "do NOT cancel it" — clearing the draft
  // would do the opposite of what the customer asked. Passive "цуцлагдсан уу?"
  // asks whether it was cancelled and is likewise not a request.
  it.each([
    'цуцлахгүй',
    'Захиалгаа цуцлахгүй',
    'цуцлаагүй',
    'цуцлагдсан уу',
    'tsutslahgui',
  ])('negated/passive cancel does NOT clear the draft: %s', (msg) => {
    const state = stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'name',
      },
    })
    expect(resolveFollowUp(msg, state)).not.toEqual({ type: 'order_cancel' })
  })

  // The pre-existing decline phrases are negations whose negation IS the cancel
  // ("I don't need it") — they must keep working alongside the new verb guard.
  it.each(['хэрэггүй', 'авахгүй', 'болих'])(
    'decline phrase still cancels the draft: %s',
    (msg) => {
      const state = stateWith({
        order_draft: {
          items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
          step: 'name',
        },
      })
      expect(resolveFollowUp(msg, state)).toEqual({ type: 'order_cancel' })
    }
  )

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

// ---------------------------------------------------------------------------
// Abandoning a purchase mid-checkout
// ---------------------------------------------------------------------------

describe('resolveFollowUp — purchase abandonment during checkout', () => {
  function draftState() {
    return stateWith({
      order_draft: {
        items: [{ product_id: '1', product_name: 'Test', unit_price: 5000, quantity: 1 }],
        step: 'name',
      },
    })
  }

  // "болих" was already covered; these abandonment forms were not, so the
  // message was stored as the customer's name by the order_step_input path.
  it.each(['захиалахаа болилоо', 'авахаа болилоо', 'больё', 'болъё'])(
    'cancels the draft for abandonment form: %s',
    (msg) => {
      expect(resolveFollowUp(msg, draftState())).toEqual({ type: 'order_cancel' })
    }
  )
})

// ---------------------------------------------------------------------------
// Side questions must not blank the listing the customer is looking at
//
// The preserve list used to carry intent names nothing emits ('payment_info',
// 'delivery_info', 'order_info', 'warranty_info', 'stock_info'), so the real
// intents fell through to the clear branch: a payment question mid-browse wiped
// last_products and the next "2 дахийг авъя" had nothing to resolve against.
// ---------------------------------------------------------------------------

describe('updateState — side questions preserve the listing', () => {
  function browsing() {
    return updateState(emptyState(), 'product_search', PRODUCTS, 'хувцас')
  }

  it.each([
    'payment',
    'order_status',
    'return_exchange',
    'shipping',
    'size_info',
    'allergen_info',
    'table_reservation',
    'gift_card_purchase',
    'complaint',
    'greeting',
    'thanks',
  ])('%s keeps products, query and last_intent', (intent) => {
    const next = updateState(browsing(), intent, [], '')
    expect(next.last_products).toEqual(PRODUCTS)
    expect(next.last_query).toBe('хувцас')
    expect(next.last_intent).toBe('product_search')
  })

  it('an ordinal reference still resolves after a side question', () => {
    const afterPayment = updateState(browsing(), 'payment', [], '')
    expect(resolveFollowUp('2 дахийг авъя', afterPayment)).toEqual({
      type: 'order_intent',
      product: PRODUCTS[1],
    })
  })

  // §8 detects a REPEATED low_confidence, which needs last_intent to become it.
  it('low_confidence still takes over last_intent', () => {
    const next = updateState(browsing(), 'low_confidence', [], '')
    expect(next.last_intent).toBe('low_confidence')
  })

  it('an intent in neither list still clears — unknown intents fail safe', () => {
    const next = updateState(browsing(), 'order_created', [], '')
    expect(next.last_products).toEqual([])
    expect(next.last_intent).toBe('order_created')
  })

  // Regression guard: a search that returns nothing must keep the query and the
  // catalog cursor, so "next page" and refinements still work.
  it('a zero-result product_search keeps last_query and catalog pagination', () => {
    const state = { ...browsing(), catalog_page: 2, catalog_query: 'хувцас', catalog_total: 40 }
    const next = updateState(state, 'product_search', [], 'улаан цамц')
    expect(next.last_query).toBe('улаан цамц')
    expect(next.catalog_page).toBe(2)
    expect(next.catalog_total).toBe(40)
  })
})
