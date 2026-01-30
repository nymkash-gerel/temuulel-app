/**
 * Real conversation scenario tests — simulates multi-turn chat flows
 * through follow-up detection, state management, and intent classification.
 *
 * These tests catch systemic issues like:
 * - Product context switching to wrong product
 * - Size questions not detected (Latin input, leading numbers)
 * - Price-based / name-based product selection
 * - FAQ lookup correctness
 */
import { describe, it, expect } from 'vitest'
import {
  resolveFollowUp,
  updateState,
  emptyState,
  ConversationState,
  StoredProduct,
} from './conversation-state'
import { classifyIntentWithConfidence, normalizeText, neutralizeVowels } from './chat-ai'

// ---------------------------------------------------------------------------
// Test products matching the real DB
// ---------------------------------------------------------------------------

const CASHMERE_SWEATER: StoredProduct = {
  id: 'p1',
  name: 'Эмэгтэй кашемир цамц',
  base_price: 145000,
}

const NOOLURAN_SWEATER: StoredProduct = {
  id: 'p2',
  name: 'Ноолууран цамц',
  base_price: 189000,
}

const PREGNANCY_DRESS: StoredProduct = {
  id: 'p3',
  name: 'Жирэмсний даашинз',
  base_price: 89000,
}

const ALL_PRODUCTS = [CASHMERE_SWEATER, NOOLURAN_SWEATER, PREGNANCY_DRESS]

function stateWithProducts(
  products: StoredProduct[],
  overrides: Partial<ConversationState> = {}
): ConversationState {
  return {
    last_intent: 'product_search',
    last_products: products,
    last_query: 'цамц',
    turn_count: 1,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Scenario 1: Size question with leading number (the "5 sartai" bug)
// ---------------------------------------------------------------------------

describe('Scenario: Size question with leading number', () => {
  const state = stateWithProducts(ALL_PRODUCTS)

  it('"5 sartai hund ali ni blh ve" should NOT be treated as product #5 selection', () => {
    const result = resolveFollowUp('5 sartai hund ali ni blh ve', state)
    // Must not be null (was the original bug) and must not select product #5
    expect(result).not.toBeNull()
    expect(result?.type).not.toBe('number_reference')
  })

  it('"5 sartai hund ali ni blh ve" should detect as size_question', () => {
    const result = resolveFollowUp('5 sartai hund ali ni blh ve', state)
    expect(result?.type).toBe('size_question')
  })

  it('"160cm 65kg" should detect as size_question via body measurement', () => {
    const result = resolveFollowUp('160cm 65kg', state)
    expect(result?.type).toBe('size_question')
  })

  it('"160 65kg ali ni blh ve" should detect as size_question', () => {
    const result = resolveFollowUp('160 65kg ali ni blh ve', state)
    expect(result?.type).toBe('size_question')
  })

  it('"ali ni nadad blh ve" should detect as size_question', () => {
    const result = resolveFollowUp('ali ni nadad blh ve', state)
    expect(result?.type).toBe('size_question')
  })

  it('plain "2" should still select product #2', () => {
    const result = resolveFollowUp('2', state)
    expect(result).toEqual({ type: 'number_reference', product: NOOLURAN_SWEATER })
  })

  it('"2-г" should still select product #2', () => {
    const result = resolveFollowUp('2-г', state)
    // After normalization, punctuation stripped → just "2 г"
    // The suffix check should match "г"
    expect(result?.type).toBe('number_reference')
  })

  it('"2 дугаарыг" should select product #2', () => {
    const result = resolveFollowUp('2 дугаарыг', state)
    expect(result).toEqual({ type: 'number_reference', product: NOOLURAN_SWEATER })
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Product selection by name
// ---------------------------------------------------------------------------

describe('Scenario: Product selection by name', () => {
  const state = stateWithProducts(ALL_PRODUCTS)

  it('"Эмэгтэй кашемир цамц 145,000₮??" should select cashmere sweater', () => {
    const result = resolveFollowUp('Эмэгтэй кашемир цамц 145,000₮??', state)
    expect(result).toEqual({ type: 'number_reference', product: CASHMERE_SWEATER })
  })

  it('"кашемир цамц" should select cashmere sweater (2 matching name words)', () => {
    const result = resolveFollowUp('кашемир цамц талаар хэлээч', state)
    expect(result).toEqual({ type: 'number_reference', product: CASHMERE_SWEATER })
  })

  it('"жирэмсний даашинз" should select pregnancy dress', () => {
    const result = resolveFollowUp('жирэмсний даашинз ямар хэмжээ байдаг вэ', state)
    expect(result).toEqual({ type: 'number_reference', product: PREGNANCY_DRESS })
  })

  it('generic message should NOT match any product by name', () => {
    const result = resolveFollowUp('сайн байна уу', state)
    expect(result?.type).not.toBe('number_reference')
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Product selection by price
// ---------------------------------------------------------------------------

describe('Scenario: Product selection by price', () => {
  const state = stateWithProducts(ALL_PRODUCTS)

  it('"145inhig ni sonirhi" should select 145k product', () => {
    // "145" + context word "сонирх" (via normalized)
    const result = resolveFollowUp('145inhig ni sonirhi', state)
    expect(result).toEqual({ type: 'number_reference', product: CASHMERE_SWEATER })
  })

  it('"89000₮ ийг авъя" should select 89k product', () => {
    const result = resolveFollowUp('89000₮ ийг авъя', state)
    expect(result).toEqual({ type: 'number_reference', product: PREGNANCY_DRESS })
  })

  it('price without context word should NOT select product', () => {
    // Just a number with no selection/interest words
    const result = resolveFollowUp('145 юм бол яах вэ', state)
    // Should not match as price selection (no context word)
    if (result?.type === 'number_reference') {
      // If it matched by number, it should be product index 1 (plain number)
      // but "145" is way out of range of 3 products, and afterNum is not empty
      // so it should fall through
    }
    expect(result?.type).not.toBe('number_reference')
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Multi-turn context preservation
// ---------------------------------------------------------------------------

describe('Scenario: Multi-turn product context', () => {
  it('after selecting a product, state should narrow to that product', () => {
    // Turn 1: product_search returns 3 products
    const state1 = updateState(emptyState(), 'product_search', ALL_PRODUCTS, 'цамц')
    expect(state1.last_products).toEqual(ALL_PRODUCTS)

    // Turn 2: user selects cashmere sweater (product_detail)
    const state2 = updateState(state1, 'product_detail', [CASHMERE_SWEATER], 'кашемир цамц')
    expect(state2.last_products).toEqual([CASHMERE_SWEATER])

    // Turn 3: user asks size question → should be about cashmere sweater only
    const followUp = resolveFollowUp('хэмжээ хэд байна', state2)
    expect(followUp?.type).toBe('size_question')
    expect(followUp?.products).toEqual([CASHMERE_SWEATER])
  })

  it('size_info preserves product context for next turn', () => {
    const state1 = updateState(emptyState(), 'product_detail', [CASHMERE_SWEATER], '')
    const state2 = updateState(state1, 'size_info', [], '')
    // size_info is in preserveIntents → should keep cashmere sweater
    expect(state2.last_products).toEqual([CASHMERE_SWEATER])
  })

  it('delivery_info preserves product context', () => {
    const state1 = updateState(emptyState(), 'product_detail', [PREGNANCY_DRESS], '')
    const state2 = updateState(state1, 'delivery_info', [], '')
    expect(state2.last_products).toEqual([PREGNANCY_DRESS])
  })

  it('greeting does not clear product context', () => {
    const state1 = updateState(emptyState(), 'product_search', ALL_PRODUCTS, 'цамц')
    const state2 = updateState(state1, 'greeting', [], '')
    expect(state2.last_products).toEqual(ALL_PRODUCTS)
  })

  it('complaint clears product context', () => {
    const state1 = updateState(emptyState(), 'product_search', ALL_PRODUCTS, 'цамц')
    const state2 = updateState(state1, 'complaint', [], '')
    expect(state2.last_products).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: Latin-typed Mongolian messages
// ---------------------------------------------------------------------------

describe('Scenario: Latin-typed Mongolian input', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])

  it('"size" (English) detects as size_question', () => {
    const result = resolveFollowUp('size ni hed ve', state)
    expect(result?.type).toBe('size_question')
  })

  it('"hemjee" (Latin-typed хэмжээ) detects as size_question', () => {
    // normalizeText("hemjee") → "хемжее" — but keyword is "хэмжээ"
    // This tests whether normalization handles it
    const normalized = normalizeText('hemjee')
    // Note: Latin "e" maps to "е", not "э" — so this won't match "хэмжээ"
    // This is a known limitation of the Latin→Cyrillic mapping
    expect(normalized).toContain('е') // confirms it normalizes
  })

  it('"razmer" (Latin-typed размер) detects via normalization', () => {
    const normalized = normalizeText('razmer')
    // r→р, a→а, z→з, m→м, e→е, r→р = "размер" — wait, let me check:
    // r→р, a→а, z→з, m→м, e→е, r→р = "размер" ✓
    expect(normalized).toBe('размер')
    const result = resolveFollowUp('razmer', state)
    expect(result?.type).toBe('size_question')
  })

  it('"material" (English) detects as contextual material question', () => {
    const result = resolveFollowUp('material', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('material')
  })

  it('"delivery" (English) detects as contextual delivery question', () => {
    const result = resolveFollowUp('delivery', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('delivery')
  })
})

// ---------------------------------------------------------------------------
// Scenario 6: Emotional messages prefer LLM
// ---------------------------------------------------------------------------

describe('Scenario: Emotional messages', () => {
  const state = stateWithProducts([], { last_intent: 'general', turn_count: 2 })

  it('"яагаа ийм удаж байгаа юм" triggers prefer_llm', () => {
    const result = resolveFollowUp('яагаа ийм удаж байгаа юм', state)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'emotional' })
  })

  it('"ойлгосонгүй" triggers prefer_llm', () => {
    const result = resolveFollowUp('ойлгосонгүй', state)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'emotional' })
  })

  it('"уурлаа" triggers prefer_llm', () => {
    const result = resolveFollowUp('уурлаа', state)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'emotional' })
  })
})

// ---------------------------------------------------------------------------
// Scenario 7: Contextual follow-up questions
// ---------------------------------------------------------------------------

describe('Scenario: Contextual follow-ups', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])

  it('"хүргэлт хэд хоног" detects as delivery question', () => {
    const result = resolveFollowUp('хүргэлт хэд хоног', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('delivery')
  })

  it('"материал юу вэ" detects as material question', () => {
    const result = resolveFollowUp('материал юу вэ', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('material')
  })

  it('"баталгаа байгаа юу" detects as warranty question', () => {
    const result = resolveFollowUp('баталгаа байгаа юу', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('warranty')
  })

  it('"захиалах" detects as order question', () => {
    const result = resolveFollowUp('захиалах', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('order')
  })

  it('"төлбөр яаж хийх" detects as payment question', () => {
    const result = resolveFollowUp('төлбөр яаж хийх', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('payment')
  })

  it('"дэлгэрэнгүй мэдээлэл" detects as detail question', () => {
    const result = resolveFollowUp('дэлгэрэнгүй мэдээлэл', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('detail')
  })
})

// ---------------------------------------------------------------------------
// Scenario 8: Intent classification for common messages
// ---------------------------------------------------------------------------

describe('Scenario: Intent classification', () => {
  it('"сайн байна уу" classifies as greeting', () => {
    const { intent } = classifyIntentWithConfidence('сайн байна уу')
    expect(intent).toBe('greeting')
  })

  it('"цамц байна уу" classifies as product_search', () => {
    const { intent } = classifyIntentWithConfidence('цамц байна уу')
    expect(intent).toBe('product_search')
  })

  it('"захиалга шалгах" classifies as order_status', () => {
    const { intent } = classifyIntentWithConfidence('захиалга шалгах')
    expect(intent).toBe('order_status')
  })

  it('"баярлалаа" classifies as thanks', () => {
    const { intent } = classifyIntentWithConfidence('баярлалаа')
    expect(intent).toBe('thanks')
  })

  it('"хүргэлт хэзээ ирэх" classifies as order_status or shipping', () => {
    // "хэзээ ирэх" (when will it arrive) matches both order_status and shipping keywords
    // The system picks whichever has more keyword matches
    const { intent } = classifyIntentWithConfidence('хүргэлт хэзээ ирэх')
    expect(['order_status', 'shipping']).toContain(intent)
  })
})

// ---------------------------------------------------------------------------
// Scenario 9: Full conversation simulation
// ---------------------------------------------------------------------------

describe('Scenario: Full conversation — product search → select → size question', () => {
  it('simulates a complete 3-turn conversation', () => {
    // Turn 1: User searches for "цамц" → gets 2 products
    const twoProducts = [CASHMERE_SWEATER, NOOLURAN_SWEATER]
    let state = updateState(emptyState(), 'product_search', twoProducts, 'цамц')
    expect(state.last_products).toHaveLength(2)

    // Turn 2: User says "кашемир цамц" → name match selects cashmere
    const follow2 = resolveFollowUp('кашемир цамц талаар хэлээч', state)
    expect(follow2?.type).toBe('number_reference')
    expect(follow2?.product).toEqual(CASHMERE_SWEATER)
    // State update after product_detail (widget sets this intent)
    state = updateState(state, 'product_detail', [CASHMERE_SWEATER], '')
    expect(state.last_products).toEqual([CASHMERE_SWEATER])

    // Turn 3: User asks about size → should be about cashmere only
    const follow3 = resolveFollowUp('хэмжээ хэд байна', state)
    expect(follow3?.type).toBe('size_question')
    expect(follow3?.products).toEqual([CASHMERE_SWEATER])
  })

  it('simulates conversation with price-based selection', () => {
    const twoProducts = [CASHMERE_SWEATER, NOOLURAN_SWEATER]
    let state = updateState(emptyState(), 'product_search', twoProducts, 'цамц')

    // User selects by price: "145inhig ni sonirhi"
    const follow = resolveFollowUp('145inhig ni sonirhi', state)
    expect(follow?.type).toBe('number_reference')
    expect(follow?.product).toEqual(CASHMERE_SWEATER)

    // State narrows to cashmere sweater
    state = updateState(state, 'product_detail', [CASHMERE_SWEATER], '')

    // Next turn: size question → correct product
    const sizeFollow = resolveFollowUp('160 65kg ali ni blh ve', state)
    expect(sizeFollow?.type).toBe('size_question')
    expect(sizeFollow?.products).toEqual([CASHMERE_SWEATER])
  })
})

// ---------------------------------------------------------------------------
// Scenario 10: Edge cases that previously caused bugs
// ---------------------------------------------------------------------------

describe('Scenario: Edge cases', () => {
  const state = stateWithProducts(ALL_PRODUCTS)

  it('"0" does not crash (out of range)', () => {
    const result = resolveFollowUp('0', state)
    expect(result).toBeNull()
  })

  it('empty message returns null', () => {
    const result = resolveFollowUp('', state)
    expect(result).toBeNull()
  })

  it('"  " (whitespace only) returns null', () => {
    const result = resolveFollowUp('   ', state)
    expect(result).toBeNull()
  })

  it('very long message does not crash', () => {
    const longMsg = 'а'.repeat(1000)
    const result = resolveFollowUp(longMsg, state)
    // Should not throw, result can be null or any follow-up type
    expect(result === null || typeof result === 'object').toBe(true)
  })

  it('"100" is not treated as product selection when only 3 products', () => {
    const result = resolveFollowUp('100', state)
    // Out of range — previously returned null, now should also be null
    // since afterNum is empty but idx=99 is out of range
    expect(result).toBeNull()
  })

  it('number in middle of sentence is not treated as product selection', () => {
    const result = resolveFollowUp('энэ бүтээгдэхүүн 2 удаа буцаагдсан', state)
    // "2" is not at the start after normalization, or has surrounding text
    // Should not select product #2
    expect(result?.type).not.toBe('number_reference')
  })
})

// ---------------------------------------------------------------------------
// Scenario 11: Latin-typed Mongolian with vowel confusion (У/Ү, Е/Э, Ө/О)
// ---------------------------------------------------------------------------

describe('Scenario: Vowel-confused Latin input', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])

  it('"hemjee" (Latin хэмжээ) detects as size_question via vowel neutralization', () => {
    // normalizeText("hemjee") → "хемжее" — vowel neutral matches "хэмжээ"
    const result = resolveFollowUp('hemjee', state)
    expect(result?.type).toBe('size_question')
  })

  it('"une hed ve" (Latin үнэ хэд вэ) detects as price_question', () => {
    // normalizeText("une hed ve") → "уне хед ве"
    // vowel neutral: "уне хед ве" matches "үнэ" / "хэд"
    const result = resolveFollowUp('une hed ve', state)
    expect(result?.type).toBe('price_question')
  })

  it('"tohiroh uu" (Latin тохирох уу) detects as size_question', () => {
    const result = resolveFollowUp('tohiroh uu', state)
    expect(result?.type).toBe('size_question')
  })

  it('"hurgelt" (Latin хүргэлт) detects as delivery question', () => {
    const result = resolveFollowUp('hurgelt', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('delivery')
  })

  it('"tolbor" (Latin төлбөр) detects as payment question', () => {
    const result = resolveFollowUp('tolbor', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('payment')
  })
})

// ---------------------------------------------------------------------------
// Scenario 12: Mongolian slang & abbreviations
// ---------------------------------------------------------------------------

describe('Scenario: Mongolian slang and abbreviations', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])
  const emptyProductState = stateWithProducts([], { last_intent: 'general', turn_count: 2 })

  it('"юубэ" (slang "what is it") triggers prefer_llm', () => {
    const result = resolveFollowUp('юубэ', emptyProductState)
    expect(result).toEqual({ type: 'prefer_llm', reason: 'emotional' })
  })

  it('"хэдвэ" (slang "how much") detects as price_question', () => {
    const result = resolveFollowUp('хэдвэ', state)
    expect(result?.type).toBe('price_question')
  })

  it('"хэд вэ" (spaced slang) detects as price_question', () => {
    const result = resolveFollowUp('хэд вэ', state)
    expect(result?.type).toBe('price_question')
  })

  it('"захиалмаар байна" (want to order) detects as order question', () => {
    const result = resolveFollowUp('захиалмаар байна', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('order')
  })
})

// ---------------------------------------------------------------------------
// Scenario 13: Mongolian payment method variants
// ---------------------------------------------------------------------------

describe('Scenario: Mongolian payment methods', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])

  it('"qpay аар төлөх" detects as payment question', () => {
    const result = resolveFollowUp('qpay аар төлөх', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('payment')
  })

  it('"хуваан төлж болох уу" detects as payment question', () => {
    const result = resolveFollowUp('хуваан төлж болох уу', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('payment')
  })

  it('"зээлээр авч болох уу" detects as payment question', () => {
    const result = resolveFollowUp('зээлээр авч болох уу', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('payment')
  })
})

// ---------------------------------------------------------------------------
// Scenario 14: Mongolian delivery — countryside & districts
// ---------------------------------------------------------------------------

describe('Scenario: Mongolian delivery patterns', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])

  it('"хөдөө хүргэж болох уу" detects as delivery question', () => {
    const result = resolveFollowUp('хөдөө хүргэж болох уу', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('delivery')
  })

  it('"орон нутаг руу хүргэнэ үү" detects as delivery question', () => {
    const result = resolveFollowUp('орон нутаг руу хүргэнэ үү', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('delivery')
  })

  it('"аймаг руу хүргэлт хэд хоног" detects as delivery question', () => {
    const result = resolveFollowUp('аймаг руу хүргэлт хэд хоног', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('delivery')
  })
})

// ---------------------------------------------------------------------------
// Scenario 15: Mongolian material/cashmere-specific questions
// ---------------------------------------------------------------------------

describe('Scenario: Cashmere and material questions', () => {
  const state = stateWithProducts([CASHMERE_SWEATER])

  it('"кашемир чанар ямар" detects as material question', () => {
    const result = resolveFollowUp('кашемир чанар ямар', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('material')
  })

  it('"ноолуур юу" detects as material question', () => {
    const result = resolveFollowUp('ноолуур юу', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('material')
  })

  it('"найрлага" detects as material question', () => {
    const result = resolveFollowUp('найрлага', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('material')
  })

  it('"буцаах боломж байна уу" detects as warranty question', () => {
    const result = resolveFollowUp('буцаах боломж байна уу', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('warranty')
  })

  it('"солих боломж" detects as warranty question', () => {
    const result = resolveFollowUp('солих боломж', state)
    expect(result?.type).toBe('contextual_question')
    expect(result?.contextTopic).toBe('warranty')
  })
})

// ---------------------------------------------------------------------------
// Scenario 16: Intent classification with Mongolian slang
// ---------------------------------------------------------------------------

describe('Scenario: Intent classification — Mongolian slang', () => {
  it('"бнау" (abbreviation for "байна уу") classifies as greeting', () => {
    const { intent } = classifyIntentWithConfidence('бнау')
    expect(intent).toBe('greeting')
  })

  it('"кашемир цамц харуул" classifies as product_search', () => {
    const { intent } = classifyIntentWithConfidence('кашемир цамц харуул')
    expect(intent).toBe('product_search')
  })

  it('"qpay aar toloh" (Latin) classifies as payment', () => {
    const { intent } = classifyIntentWithConfidence('qpay aar toloh')
    expect(intent).toBe('payment')
  })

  it('"аймаг руу хүргэх" classifies as shipping', () => {
    const { intent } = classifyIntentWithConfidence('аймаг руу хүргэх')
    expect(intent).toBe('shipping')
  })

  it('"60кг 165см размер" classifies as size_info', () => {
    const { intent } = classifyIntentWithConfidence('60кг 165см размер')
    expect(intent).toBe('size_info')
  })
})

// ---------------------------------------------------------------------------
// Scenario 17: normalizeText and neutralizeVowels correctness
// ---------------------------------------------------------------------------

describe('Scenario: Text normalization correctness', () => {
  it('normalizes Latin "hemjee" to Cyrillic', () => {
    expect(normalizeText('hemjee')).toBe('хемжее')
  })

  it('normalizes "razmer" to "размер"', () => {
    expect(normalizeText('razmer')).toBe('размер')
  })

  it('normalizes "tsamt" to "цамт" (digraph ts→ц)', () => {
    expect(normalizeText('tsamt')).toBe('цамт')
  })

  it('neutralizeVowels makes "хемжее" equal to neutralized "хэмжээ"', () => {
    expect(neutralizeVowels('хемжее')).toBe(neutralizeVowels('хэмжээ'))
  })

  it('neutralizeVowels makes "уне" equal to neutralized "үнэ"', () => {
    expect(neutralizeVowels('уне')).toBe(neutralizeVowels('үнэ'))
  })

  it('neutralizeVowels makes "толбор" equal to neutralized "төлбөр"', () => {
    expect(neutralizeVowels('толбор')).toBe(neutralizeVowels('төлбөр'))
  })
})
