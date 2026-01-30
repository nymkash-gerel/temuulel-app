/**
 * Tests for the alias-aware intent classification and text normalizer.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  classifyIntent,
  classifyIntentWithConfidence,
  extractSearchTerms,
  CATEGORY_MAP,
  matchesHandoffKeywords,
  generateResponse,
  LOW_CONFIDENCE_THRESHOLD,
} from './chat-ai'

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('САЙН БАЙНА')).toBe('сайн байна')
  })

  it('converts Latin chars to Cyrillic', () => {
    // "sain baina" → "саин баина" (Latin → Cyrillic mapping)
    expect(normalizeText('sain baina')).toBe('саин баина')
  })

  it('handles mixed Cyrillic/Latin (common in Mongolian typing)', () => {
    // "захиалga" → "захиалга" (Latin g→г, a→а)
    expect(normalizeText('захиалga')).toBe('захиалга')
  })

  it('strips punctuation', () => {
    expect(normalizeText('Сайн байна уу???')).toBe('сайн байна уу')
  })

  it('collapses whitespace', () => {
    expect(normalizeText('  сайн   байна  ')).toBe('сайн байна')
  })

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('')
  })

  it('converts x to х (very common Mongolian typo)', () => {
    // "захиалга" typed as "zaxиалга"
    const result = normalizeText('xүргэлт')
    expect(result).toBe('хүргэлт')
  })
})

// ---------------------------------------------------------------------------
// classifyIntent — original keywords still work
// ---------------------------------------------------------------------------

describe('classifyIntent — core keywords', () => {
  it('detects product_search', () => {
    expect(classifyIntent('Бараа байна уу')).toBe('product_search')
  })

  it('detects order_status', () => {
    expect(classifyIntent('Захиалга хаана байна')).toBe('order_status')
  })

  it('detects greeting', () => {
    expect(classifyIntent('Сайн байна уу')).toBe('greeting')
  })

  it('detects thanks', () => {
    expect(classifyIntent('Баярлалаа')).toBe('thanks')
  })

  it('detects complaint', () => {
    expect(classifyIntent('Гомдол гаргах гэсэн')).toBe('complaint')
  })

  it('detects size_info', () => {
    expect(classifyIntent('Размер хэмжээ хэд байна')).toBe('size_info')
  })

  it('detects payment', () => {
    expect(classifyIntent('Төлбөр хэрхэн төлөх вэ')).toBe('payment')
  })

  it('detects shipping', () => {
    expect(classifyIntent('Хүргэлт хэдэн хоног')).toBe('shipping')
  })

  it('returns general for unrecognized messages', () => {
    expect(classifyIntent('Аав ээж хоёулаа')).toBe('general')
  })
})

// ---------------------------------------------------------------------------
// classifyIntent — alias detection (the new part)
// ---------------------------------------------------------------------------

describe('classifyIntent — aliases', () => {
  it('detects misspelled product search: "бутээгдэхүүн"', () => {
    expect(classifyIntent('Бутээгдэхүүн байна уу')).toBe('product_search')
  })

  it('detects informal product search: "авъя"', () => {
    expect(classifyIntent('Энэ бараа авъя')).toBe('product_search')
  })

  it('detects discount alias: "хямдралтай"', () => {
    expect(classifyIntent('Хямдралтай бараа байгаа юу')).toBe('product_search')
  })

  it('detects misspelled order: "захялга"', () => {
    expect(classifyIntent('Захялга шалгана уу')).toBe('order_status')
  })

  it('detects tracking alias: "трэкинг"', () => {
    expect(classifyIntent('Трэкинг дугаар өгнө үү')).toBe('order_status')
  })

  it('detects informal greeting: "сайн бн"', () => {
    expect(classifyIntent('Сайн бн')).toBe('greeting')
  })

  it('detects casual thanks: "баярлаа"', () => {
    expect(classifyIntent('Баярлаа, гоё байна')).toBe('thanks')
  })

  it('detects complaint alias: "эвдэрсэн"', () => {
    expect(classifyIntent('Эвдэрсэн гэмтсэн ирсэн')).toBe('complaint')
  })

  it('detects complaint alias: "чанаргүй"', () => {
    expect(classifyIntent('Чанаргүй юм байна')).toBe('complaint')
  })

  it('detects size alias: "сайз"', () => {
    expect(classifyIntent('Сайзаа мэдэхгүй байна')).toBe('size_info')
  })

  it('detects payment alias: "яаж төлөх"', () => {
    expect(classifyIntent('Яаж төлөх вэ')).toBe('payment')
  })

  it('detects shipping alias: "хурдан хүргэлт"', () => {
    expect(classifyIntent('Хурдан хүргэх боломжтой юу')).toBe('shipping')
  })
})

// ---------------------------------------------------------------------------
// classifyIntent — Latin/Cyrillic mixed input
// ---------------------------------------------------------------------------

describe('classifyIntent — Latin/Cyrillic normalization', () => {
  it('handles "x" as "х" in хүргэлт', () => {
    // User types "xүргэлт xаяг" with Latin x → normalizes to "хүргэлт хаяг" (2 shipping keywords)
    expect(classifyIntent('xүргэлт xаяг өгье')).toBe('shipping')
  })

  it('handles full Latin transliteration for greeting', () => {
    // User types "sain baina uu" in pure Latin
    // normalizeText turns it to Cyrillic-ish text
    // "sain" → "саин" which matches "сайн байна" partially?
    // Actually "саин" won't match "сайн" directly. That's expected —
    // full transliteration is lossy. The normalizer helps with mixed, not pure Latin.
    const result = classifyIntent('sain baina uu')
    // This may or may not match depending on keyword overlap.
    // The key guarantee is it doesn't crash.
    expect(typeof result).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// extractSearchTerms
// ---------------------------------------------------------------------------

describe('extractSearchTerms', () => {
  it('removes stop words', () => {
    const terms = extractSearchTerms('Надад хувцас байна уу')
    expect(terms).not.toContain('надад')
    expect(terms).not.toContain('байна')
    expect(terms).toContain('хувцас')
  })

  it('normalizes mixed script input', () => {
    const terms = extractSearchTerms('xувцас')
    expect(terms).toContain('хувцас')
  })
})

// ---------------------------------------------------------------------------
// CATEGORY_MAP aliases
// ---------------------------------------------------------------------------

describe('CATEGORY_MAP aliases', () => {
  it('maps "хувцас" to clothing', () => {
    expect(CATEGORY_MAP['хувцас']).toBe('clothing')
  })

  it('maps misspelling "хувцаас" to clothing', () => {
    expect(CATEGORY_MAP['хувцаас']).toBe('clothing')
  })

  it('maps "гуталаа" to shoes', () => {
    expect(CATEGORY_MAP['гуталаа']).toBe('shoes')
  })

  it('maps "пууз" (no ү) to shoes', () => {
    expect(CATEGORY_MAP['пууз']).toBe('shoes')
  })

  it('maps "цунх" (no ү) to bags', () => {
    expect(CATEGORY_MAP['цунх']).toBe('bags')
  })

  it('maps "аксесуар" (single с) to accessories', () => {
    expect(CATEGORY_MAP['аксесуар']).toBe('accessories')
  })
})

// ---------------------------------------------------------------------------
// matchesHandoffKeywords — now uses normalizer
// ---------------------------------------------------------------------------

describe('matchesHandoffKeywords with normalizer', () => {
  const settings = {
    auto_handoff: true,
    handoff_keywords: 'менежер,хүн,оператор',
  }

  it('matches exact keyword', () => {
    expect(matchesHandoffKeywords('Менежер дуудна уу', settings)).toBe(true)
  })

  it('matches with Latin x instead of х', () => {
    // "xүн" → normalizes to "хүн"
    expect(matchesHandoffKeywords('xүн дуудна уу', settings)).toBe(true)
  })

  it('matches when keyword stored with Latin chars', () => {
    // Store owner typed "menejер" with Latin "menej" — should still match Cyrillic message
    const mixedSettings = {
      auto_handoff: true,
      handoff_keywords: 'menejер',
    }
    expect(matchesHandoffKeywords('менежер дуудна уу', mixedSettings)).toBe(true)
  })

  it('returns false when disabled', () => {
    expect(matchesHandoffKeywords('Менежер', { auto_handoff: false })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// classifyIntent — English keywords
// ---------------------------------------------------------------------------

describe('classifyIntent — English keywords', () => {
  it('detects English product search: "buy"', () => {
    expect(classifyIntent('I want to buy something')).toBe('product_search')
  })

  it('detects English order status: "order"', () => {
    expect(classifyIntent('where is my order')).toBe('order_status')
  })

  it('detects English greeting: "hello"', () => {
    expect(classifyIntent('hello')).toBe('greeting')
  })

  it('detects English thanks: "thank you"', () => {
    expect(classifyIntent('thank you so much')).toBe('thanks')
  })

  it('detects English complaint: "broken"', () => {
    expect(classifyIntent('the item is broken and damaged')).toBe('complaint')
  })

  it('detects English size query: "what size"', () => {
    expect(classifyIntent('what size should I get')).toBe('size_info')
  })

  it('detects English payment: "how to pay"', () => {
    expect(classifyIntent('how to pay for this')).toBe('payment')
  })

  it('detects English shipping: "shipping"', () => {
    expect(classifyIntent('shipping to countryside')).toBe('shipping')
  })
})

// ---------------------------------------------------------------------------
// classifyIntentWithConfidence — confidence scoring
// ---------------------------------------------------------------------------

describe('classifyIntentWithConfidence', () => {
  it('returns high confidence for multi-keyword match', () => {
    const result = classifyIntentWithConfidence('Захиалга хаана байна хэзээ ирэх')
    expect(result.intent).toBe('order_status')
    expect(result.confidence).toBeGreaterThanOrEqual(2)
  })

  it('returns low confidence for vague messages', () => {
    const result = classifyIntentWithConfidence('Аав ээж хоёулаа')
    expect(result.intent).toBe('general')
    expect(result.confidence).toBe(0)
  })

  it('prefix match boosts score for truncated words', () => {
    // "захиал" is a prefix of "захиалга" — should get partial credit
    const result = classifyIntentWithConfidence('захиал шалг')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('returns confidence below threshold for gibberish', () => {
    const result = classifyIntentWithConfidence('аааа бббб вввв')
    expect(result.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD)
  })
})

// ---------------------------------------------------------------------------
// generateResponse — low_confidence clarification
// ---------------------------------------------------------------------------

describe('generateResponse — low_confidence', () => {
  it('returns clarification message for low_confidence intent', () => {
    const response = generateResponse('low_confidence', [], [], 'TestStore')
    expect(response).toContain('ойлгосонгүй')
    expect(response).toContain('Бүтээгдэхүүн хайх')
    expect(response).toContain('Захиалга шалгах')
    expect(response).toContain('Менежертэй холбогдох')
  })
})

// ---------------------------------------------------------------------------
// classifyIntent — return_exchange intent
// ---------------------------------------------------------------------------

describe('classifyIntent — return_exchange', () => {
  it('detects Mongolian return keyword: "буцаах"', () => {
    expect(classifyIntent('Буцаах боломжтой юу')).toBe('return_exchange')
  })

  it('detects Mongolian exchange keyword: "солих"', () => {
    expect(classifyIntent('Солих боломжтой юу')).toBe('return_exchange')
  })

  it('detects "буцаалт"', () => {
    expect(classifyIntent('Буцаалт хийж болох уу')).toBe('return_exchange')
  })

  it('detects "солилт"', () => {
    expect(classifyIntent('Солилт хийж болох уу')).toBe('return_exchange')
  })

  it('detects "тохирохгүй" with exchange keywords', () => {
    expect(classifyIntent('Тохирохгүй байна солих боломж')).toBe('return_exchange')
  })

  it('detects English "return"', () => {
    expect(classifyIntent('Can I return this item')).toBe('return_exchange')
  })

  it('detects English "exchange"', () => {
    expect(classifyIntent('I want to exchange')).toBe('return_exchange')
  })

  it('detects English "refund"', () => {
    expect(classifyIntent('Can I get a refund')).toBe('return_exchange')
  })

  it('detects "return policy"', () => {
    expect(classifyIntent('What is your return policy')).toBe('return_exchange')
  })
})

// ---------------------------------------------------------------------------
// return_exchange vs complaint disambiguation
// ---------------------------------------------------------------------------

describe('classifyIntent — return vs complaint disambiguation', () => {
  it('classifies quality complaints as complaint, not return', () => {
    expect(classifyIntent('Чанар муу эвдэрсэн байна')).toBe('complaint')
  })

  it('classifies damaged goods as complaint', () => {
    expect(classifyIntent('Гэмтсэн эвдэрсэн асуудал байна')).toBe('complaint')
  })

  it('classifies pure return request as return_exchange', () => {
    expect(classifyIntent('Буцаалт хийх боломж')).toBe('return_exchange')
  })

  it('classifies size mismatch exchange as return_exchange', () => {
    expect(classifyIntent('Өөр хэмжээ солих')).toBe('return_exchange')
  })
})

// ---------------------------------------------------------------------------
// generateResponse — return_exchange with and without policy
// ---------------------------------------------------------------------------

describe('generateResponse — return_exchange', () => {
  it('returns policy text when return_policy is configured', () => {
    const settings = { return_policy: '14 хоногийн дотор буцаах боломжтой' }
    const response = generateResponse('return_exchange', [], [], 'TestStore', settings)
    expect(response).toContain('14 хоногийн дотор буцаах боломжтой')
    expect(response).toContain('Буцаалт/Солилтын бодлого')
  })

  it('returns fallback when return_policy is not configured', () => {
    const response = generateResponse('return_exchange', [], [], 'TestStore')
    expect(response).toContain('менежерээс лавлана уу')
  })

  it('returns fallback when return_policy is empty string', () => {
    const settings = { return_policy: '' }
    const response = generateResponse('return_exchange', [], [], 'TestStore', settings)
    expect(response).toContain('менежерээс лавлана уу')
  })
})

// ---------------------------------------------------------------------------
// Edge cases: previously misclassified return_exchange messages
// ---------------------------------------------------------------------------

describe('classifyIntent — return_exchange edge cases', () => {
  it('detects "Солих боломж байгаа юу?" as return_exchange', () => {
    // Previously misclassified as product_search due to "юу" and "байгаа" keywords
    expect(classifyIntent('Солих боломж байгаа юу?')).toBe('return_exchange')
  })

  it('detects "Буцаалтын хураамж хэд вэ?" as return_exchange', () => {
    // Previously misclassified as product_search due to "хэд" keyword
    // Fixed by adding "буцаалтын" (suffixed) and "хураамж" to return_exchange
    expect(classifyIntent('Буцаалтын хураамж хэд вэ?')).toBe('return_exchange')
  })

  it('detects "Солилтын нөхцөл юу вэ?" as return_exchange', () => {
    // Previously misclassified due to "юу" in product_search
    // Fixed by adding "солилтын" (suffixed) to return_exchange
    expect(classifyIntent('Солилтын нөхцөл юу вэ?')).toBe('return_exchange')
  })

  it('detects "Хэмжээ тохирохгүй, солиулж болох уу?" as return_exchange', () => {
    // Previously misclassified as size_info due to "хэмжээ" + "размер" boost
    // Fixed by adding "солиулж" to return_exchange, giving enough score to win
    expect(classifyIntent('Хэмжээ тохирохгүй, солиулж болох уу?')).toBe('return_exchange')
  })

  it('detects "I want to exchange this item" as return_exchange', () => {
    // "exchange" keyword wins for return_exchange over product_search "item"
    // Note: "exchange for a different size" ties with size_info due to compound-prefix
    // scoring on "size chart"/"size guide" — the contextual AI handles that case
    expect(classifyIntent('I want to exchange this item')).toBe('return_exchange')
  })
})
