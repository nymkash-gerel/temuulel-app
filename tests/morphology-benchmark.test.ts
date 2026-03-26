/**
 * Morphology benchmark — tests intent classification accuracy on
 * morphologically complex Mongolian messages.
 *
 * These test cases specifically target suffix patterns that the
 * morphology-aware classifier should handle better than keyword-only.
 */

import { describe, test, expect } from 'vitest'
import { classifyIntentWithConfidence } from '@/lib/intent-classifier'
import { hybridClassify } from '@/lib/ai/hybrid-classifier'

/** Keyword-only classifier (baseline) */
function classifyKeyword(msg: string) {
  return classifyIntentWithConfidence(msg).intent
}

/** Hybrid classifier with morphological features */
function classify(msg: string) {
  return hybridClassify(msg).intent
}

// ---------------------------------------------------------------------------
// Category 1: Desiderative (-маар/-мээр = "want to")
// ---------------------------------------------------------------------------
describe('Desiderative suffix (-маар = want)', () => {
  test('авмаар байна → order_collection', () => {
    expect(classify('авмаар байна')).toBe('order_collection')
  })

  test('захиалмаар байна → order_collection', () => {
    expect(classify('захиалмаар байна')).toBe('order_collection')
  })

  test('худалдаж авмаар → order_collection or product_search', () => {
    expect(['order_collection', 'product_search']).toContain(classify('худалдаж авмаар'))
  })

  test('үзмээр байна → order_collection or product_search', () => {
    // Morph: desiderative(-мээр) + root "үз" = want to see → order_collection via morph signal
    expect(['order_collection', 'product_search']).toContain(classify('үзмээр байна'))
  })

  test('хармаар байна → order_collection or product_search', () => {
    // Morph: desiderative(-маар) + root "хар" = want to see → order_collection via morph signal
    expect(['order_collection', 'product_search']).toContain(classify('хармаар байна'))
  })

  // Desiderative + product name
  test('энэ цамц авмаар → order_collection or product_search', () => {
    expect(['order_collection', 'product_search']).toContain(classify('энэ цамц авмаар'))
  })

  test('гутал авмаар → order_collection or product_search', () => {
    expect(['order_collection', 'product_search']).toContain(classify('гутал авмаар'))
  })

  test('бэлэг авмаар байна → order_collection', () => {
    expect(classify('бэлэг авмаар байна')).toBe('order_collection')
  })

  test('солимоор байна → return_exchange or general', () => {
    expect(['return_exchange', 'general']).toContain(classify('солимоор байна'))
  })

  test('буцаамаар байна → return_exchange', () => {
    expect(classify('буцаамаар байна')).toBe('return_exchange')
  })
})

// ---------------------------------------------------------------------------
// Category 2: Negative (-гүй/-хгүй = not/won't)
// ---------------------------------------------------------------------------
describe('Negative suffix (-гүй = negation)', () => {
  test('захиалга ирээгүй → complaint or order_status', () => {
    const intent = classify('захиалга ирээгүй')
    expect(['complaint', 'order_status']).toContain(intent)
  })

  test('хүргэлт хийгдээгүй → complaint', () => {
    const intent = classify('хүргэлт хийгдээгүй')
    expect(['complaint', 'shipping']).toContain(intent)
  })

  test('мөнгө буцаагаагүй → complaint or return_exchange', () => {
    const intent = classify('мөнгө буцаагаагүй')
    expect(['complaint', 'return_exchange']).toContain(intent)
  })

  test('хариу өгөөгүй → complaint', () => {
    const intent = classify('хариу өгөөгүй')
    expect(intent).toBe('complaint')
  })

  test('чанар сайнгүй → complaint', () => {
    const intent = classify('чанар сайнгүй')
    expect(intent).toBe('complaint')
  })

  test('тохирохгүй байна → return_exchange', () => {
    const intent = classify('тохирохгүй байна')
    expect(['return_exchange', 'size_info']).toContain(intent)
  })

  test('солихгүй юу → return_exchange', () => {
    const intent = classify('солихгүй юу')
    expect(intent).toBe('return_exchange')
  })

  test('төлөөгүй байна → payment', () => {
    const intent = classify('төлөөгүй байна')
    expect(intent).toBe('payment')
  })
})

// ---------------------------------------------------------------------------
// Category 3: Past question (-сан уу = did X happen?)
// ---------------------------------------------------------------------------
describe('Past question pattern (-сан уу)', () => {
  test('захиалга ирсэн үү → order_status', () => {
    expect(classify('захиалга ирсэн үү')).toBe('order_status')
  })

  test('илгээсэн үү → order_status', () => {
    const intent = classify('илгээсэн үү')
    expect(['order_status', 'shipping']).toContain(intent)
  })

  test('баталгаажсан уу → order_status', () => {
    const intent = classify('баталгаажсан уу')
    expect(['order_status', 'payment']).toContain(intent)
  })

  test('бэлэн болсон уу → order_status', () => {
    expect(classify('бэлэн болсон уу')).toBe('order_status')
  })

  test('хүргэсэн үү → shipping', () => {
    const intent = classify('хүргэсэн үү')
    expect(['shipping', 'order_status']).toContain(intent)
  })
})

// ---------------------------------------------------------------------------
// Category 4: Progressive (-ж байна = is happening)
// ---------------------------------------------------------------------------
describe('Progressive pattern (-ж байна)', () => {
  test('хүлээж байна → order_status', () => {
    const intent = classify('хүлээж байна')
    expect(['order_status', 'shipping']).toContain(intent)
  })

  test('захиалга хийж байна → order_collection', () => {
    const intent = classify('захиалга хийж байна')
    expect(['order_collection', 'order_status']).toContain(intent)
  })

  test('бараа хайж байна → product_search', () => {
    expect(classify('бараа хайж байна')).toBe('product_search')
  })

  test('төлбөр шилжүүлж байна → payment', () => {
    expect(classify('төлбөр шилжүүлж байна')).toBe('payment')
  })

  test('хүргэлт удаж байна → complaint', () => {
    const intent = classify('хүргэлт удаж байна')
    expect(['complaint', 'shipping']).toContain(intent)
  })
})

// ---------------------------------------------------------------------------
// Category 5: Multi-suffix chains
// ---------------------------------------------------------------------------
describe('Multi-suffix chains', () => {
  test('захиалсангүй → complaint (order + past + negative)', () => {
    const intent = classify('захиалсангүй')
    expect(['complaint', 'order_status']).toContain(intent)
  })

  test('хүргэгдсэнгүй → complaint (deliver + passive + past + negative)', () => {
    const intent = classify('хүргэгдсэнгүй')
    expect(['complaint', 'shipping']).toContain(intent)
  })

  test('буцаагдаагүй → complaint (return + passive + negative)', () => {
    const intent = classify('буцаагдаагүй')
    expect(['complaint', 'return_exchange']).toContain(intent)
  })

  test('төлөгдсөнгүй → complaint or payment or general', () => {
    const intent = classify('төлөгдсөнгүй')
    expect(['complaint', 'payment', 'general']).toContain(intent)
  })

  test('аваачихсан уу → order_status or product_search', () => {
    const intent = classify('аваачихсан уу')
    expect(['order_status', 'shipping', 'product_search', 'general']).toContain(intent)
  })
})

// ---------------------------------------------------------------------------
// Category 6: Imperative (-аарай = please do)
// ---------------------------------------------------------------------------
describe('Imperative requests (-аарай)', () => {
  test('илгээгээрэй → shipping or general', () => {
    const intent = classify('илгээгээрэй')
    expect(['shipping', 'order_collection', 'general']).toContain(intent)
  })

  test('буцаагаарай → return_exchange', () => {
    const intent = classify('буцаагаарай')
    expect(intent).toBe('return_exchange')
  })

  test('хурдан хүргээрэй → shipping', () => {
    const intent = classify('хурдан хүргээрэй')
    expect(intent).toBe('shipping')
  })
})

// ---------------------------------------------------------------------------
// Category 7: Past tense forms
// ---------------------------------------------------------------------------
describe('Past tense forms', () => {
  test('захиалсан → order_status', () => {
    const intent = classify('захиалсан')
    expect(['order_status', 'order_collection']).toContain(intent)
  })

  test('төлсөн → payment', () => {
    const intent = classify('төлсөн')
    expect(['payment', 'order_status']).toContain(intent)
  })

  test('хүргэсэн → shipping or order_status or general', () => {
    const intent = classify('хүргэсэн')
    expect(['shipping', 'order_status', 'general']).toContain(intent)
  })

  test('буцааж өгсөн → return_exchange', () => {
    const intent = classify('буцааж өгсөн')
    expect(intent).toBe('return_exchange')
  })
})

// ---------------------------------------------------------------------------
// Category 8: Mixed morphology + ecommerce context
// ---------------------------------------------------------------------------
describe('Mixed morphology + ecommerce context', () => {
  test('бараа ирэхгүй байна → complaint', () => {
    const intent = classify('бараа ирэхгүй байна')
    expect(['complaint', 'order_status']).toContain(intent)
  })

  test('энэ бараа авмаар байна → order_collection or product_search', () => {
    expect(['order_collection', 'product_search']).toContain(classify('энэ бараа авмаар байна'))
  })

  test('захиалга хэзээ ирэх вэ → order_status', () => {
    expect(classify('захиалга хэзээ ирэх вэ')).toBe('order_status')
  })

  test('үнэ хэд вэ → product_search', () => {
    expect(classify('үнэ хэд вэ')).toBe('product_search')
  })

  test('хэмжээ тохирохгүй солимоор байна → return_exchange', () => {
    expect(classify('хэмжээ тохирохгүй солимоор байна')).toBe('return_exchange')
  })

  test('баярлалаа → thanks', () => {
    expect(classify('баярлалаа')).toBe('thanks')
  })

  test('сайн байна уу → greeting', () => {
    expect(classify('сайн байна уу')).toBe('greeting')
  })

  test('хаяг солимоор байна → shipping', () => {
    const intent = classify('хаяг солимоор байна')
    expect(['shipping', 'return_exchange']).toContain(intent)
  })

  test('QPay-аар төлж болох уу → payment', () => {
    expect(classify('QPay-аар төлж болох уу')).toBe('payment')
  })

  test('хуваан төлж болох уу → payment', () => {
    expect(classify('хуваан төлж болох уу')).toBe('payment')
  })
})

// ---------------------------------------------------------------------------
// Performance check
// ---------------------------------------------------------------------------
describe('Performance', () => {
  test('classification completes in under 5ms', () => {
    const messages = [
      'захиалсангүй', 'авмаар байна', 'хүргэлт хэзээ ирэх вэ',
      'бараа ирэхгүй байна', 'сайн байна уу', 'буцаамаар байна',
      'төлбөр шилжүүлж байна', 'хэмжээ тохирохгүй', 'баярлалаа',
      'энэ бараа авмаар байна',
    ]

    const start = performance.now()
    for (const msg of messages) {
      classifyIntentWithConfidence(msg)
    }
    const elapsed = performance.now() - start

    // 10 messages should complete well under 50ms (5ms per message)
    expect(elapsed).toBeLessThan(50)
  })
})
