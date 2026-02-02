/**
 * Escalation Scenario Tests — Phase 3
 *
 * Tests escalation signal detection and scoring for all universal escalation
 * scenarios from TEST-SCENARIOS-SUMMARY.md (E1-E8).
 *
 * Important: The escalation engine uses exact substring matching via
 * `lower.includes(keyword)`. Mongolian verb conjugations (e.g. "буцааж")
 * do NOT match infinitive keywords (e.g. "буцаах"). Tests must use
 * the exact keyword forms from escalation.ts.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateEscalation,
  detectRepeatedMessage,
  countConsecutiveAiOnly,
  scoreToLevel,
  type EscalationConfig,
  type RecentMessage,
} from '../escalation'

const DEFAULT_CONFIG: EscalationConfig = {
  enabled: true,
  threshold: 60,
}

const DISABLED_CONFIG: EscalationConfig = {
  enabled: false,
  threshold: 60,
}

// Helper: create recent messages array
function makeMessages(msgs: Array<{ content: string; customer: boolean; ai: boolean }>): RecentMessage[] {
  return msgs.map((m) => ({
    content: m.content,
    is_from_customer: m.customer,
    is_ai_response: m.ai,
  }))
}

// ---------------------------------------------------------------------------
// scoreToLevel
// ---------------------------------------------------------------------------

describe('scoreToLevel', () => {
  it('returns low for score < 30', () => {
    expect(scoreToLevel(0)).toBe('low')
    expect(scoreToLevel(15)).toBe('low')
    expect(scoreToLevel(29)).toBe('low')
  })

  it('returns medium for score 30-59', () => {
    expect(scoreToLevel(30)).toBe('medium')
    expect(scoreToLevel(45)).toBe('medium')
    expect(scoreToLevel(59)).toBe('medium')
  })

  it('returns high for score 60-79', () => {
    expect(scoreToLevel(60)).toBe('high')
    expect(scoreToLevel(70)).toBe('high')
    expect(scoreToLevel(79)).toBe('high')
  })

  it('returns critical for score >= 80', () => {
    expect(scoreToLevel(80)).toBe('critical')
    expect(scoreToLevel(100)).toBe('critical')
  })
})

// ---------------------------------------------------------------------------
// detectRepeatedMessage
// ---------------------------------------------------------------------------

describe('detectRepeatedMessage', () => {
  it('detects exact duplicate message', () => {
    expect(detectRepeatedMessage('Захиалга ирээгүй байна', ['Захиалга ирээгүй байна'])).toBe(true)
  })

  it('detects near-duplicate (≥0.8 Jaccard similarity)', () => {
    expect(detectRepeatedMessage(
      'Захиалга маань ирээгүй байна даа',
      ['Захиалга маань ирээгүй байна']
    )).toBe(true)
  })

  it('returns false for different messages', () => {
    expect(detectRepeatedMessage(
      'Сайн байна уу',
      ['Захиалга ирээгүй байна']
    )).toBe(false)
  })

  it('returns false for empty recent messages', () => {
    expect(detectRepeatedMessage('test message', [])).toBe(false)
  })

  it('returns false for empty current message', () => {
    expect(detectRepeatedMessage('', ['Захиалга ирээгүй байна'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// countConsecutiveAiOnly
// ---------------------------------------------------------------------------

describe('countConsecutiveAiOnly', () => {
  it('counts all customer messages backwards until a human agent reply', () => {
    const msgs = makeMessages([
      { content: 'Сайн байна уу', customer: true, ai: false },
      { content: 'Сайн уу!', customer: false, ai: true },
      { content: 'Захиалга шалгана уу', customer: true, ai: false },
      { content: 'Захиалга олдсонгүй', customer: false, ai: true },
      { content: 'Дахиад шалгана уу', customer: true, ai: false },
      { content: 'Олдсонгүй', customer: false, ai: true },
      { content: 'Яагаад олдохгүй байна?', customer: true, ai: false },
    ])
    // Walks backwards: customer(1), AI(skip), customer(2), AI(skip),
    // customer(3), AI(skip), customer(4) — no human agent break
    expect(countConsecutiveAiOnly(msgs)).toBe(4)
  })

  it('resets count when human agent replies', () => {
    const msgs = makeMessages([
      { content: 'Асуудалтай байна', customer: true, ai: false },
      { content: 'Би туслая', customer: false, ai: false }, // human agent
      { content: 'Баярлалаа', customer: true, ai: false },
    ])
    expect(countConsecutiveAiOnly(msgs)).toBe(1)
  })

  it('returns 0 for empty messages', () => {
    expect(countConsecutiveAiOnly([])).toBe(0)
  })

  it('counts multiple customer messages after human agent break', () => {
    const msgs = makeMessages([
      { content: 'Old msg', customer: true, ai: false },
      { content: 'Agent reply', customer: false, ai: false }, // human agent
      { content: 'New issue', customer: true, ai: false },
      { content: 'AI response', customer: false, ai: true },
      { content: 'Still broken', customer: true, ai: false },
    ])
    expect(countConsecutiveAiOnly(msgs)).toBe(2)
  })

  it('returns 0 when last message is from human agent', () => {
    const msgs = makeMessages([
      { content: 'Help', customer: true, ai: false },
      { content: 'Sure!', customer: false, ai: false }, // human agent
    ])
    expect(countConsecutiveAiOnly(msgs)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Universal Escalation Scenarios (E1-E8 from TEST-SCENARIOS-SUMMARY.md)
// ---------------------------------------------------------------------------

describe('Universal Escalation Scenarios', () => {
  // E1: complaint + return_exchange → score 45
  // Uses exact keywords: "асуудал" (complaint) + "буцаалт" (return_exchange)
  it('E1: complaint + return request detects both signals', () => {
    const result = evaluateEscalation(0, 'Энэ асуудалтай байна, буцаалт хийнэ', [], DEFAULT_CONFIG)
    expect(result.signals).toContain('complaint')    // "асуудал" in "асуудалтай"
    expect(result.signals).toContain('return_exchange') // "буцаалт"
    expect(result.newScore).toBe(45) // complaint(25) + return_exchange(20)
  })

  // E2: frustration keywords
  it('E2: "Хэзээ ч хариулахгүй, маш удаан хүлээсэн" detects frustration', () => {
    const result = evaluateEscalation(0, 'Хэзээ ч хариулахгүй, маш удаан хүлээсэн', [], DEFAULT_CONFIG)
    expect(result.signals).toContain('frustration') // "хэзээ ч" and "хариулахгүй"
    expect(result.newScore).toBe(20) // frustration(20)
  })

  // E3: payment dispute — exact keyword "төлбөр төлсөн ч"
  it('E3: "Төлбөр төлсөн ч юу ч болоогүй" detects payment_dispute', () => {
    const result = evaluateEscalation(0, 'Төлбөр төлсөн ч юу ч болоогүй', [], DEFAULT_CONFIG)
    expect(result.signals).toContain('payment_dispute') // "төлбөр төлсөн ч"
    expect(result.newScore).toBe(25) // payment_dispute(25)
  })

  // E4: return/exchange — uses exact keyword "буцаах"
  it('E4: "Буцаах хүсэлт байна" detects return_exchange', () => {
    const result = evaluateEscalation(0, 'Буцаах хүсэлт байна', [], DEFAULT_CONFIG)
    expect(result.signals).toContain('return_exchange') // "буцаах"
    expect(result.newScore).toBe(20) // return_exchange(20)
  })

  // E5: repeated message
  it('E5: same message sent 3 times triggers repeated_message', () => {
    const recentMsgs = makeMessages([
      { content: 'Захиалга ирээгүй байна', customer: true, ai: false },
      { content: 'Уучлаарай, шалгая', customer: false, ai: true },
      { content: 'Захиалга ирээгүй байна', customer: true, ai: false },
      { content: 'Шалгаж байна', customer: false, ai: true },
    ])
    const result = evaluateEscalation(
      0,
      'Захиалга ирээгүй байна',
      recentMsgs,
      DEFAULT_CONFIG
    )
    expect(result.signals).toContain('repeated_message')
    // Also triggers ai_fail_to_resolve (2 customer msgs in recent, >=3 with counting)
  })

  // E6: AI fails to resolve (3+ consecutive customer messages, AI only)
  it('E6: 3+ customer messages with only AI replies triggers ai_fail_to_resolve', () => {
    const recentMsgs = makeMessages([
      { content: 'Асуултад хариулна уу', customer: true, ai: false },
      { content: 'AI хариулт', customer: false, ai: true },
      { content: 'Хариулт буруу байна', customer: true, ai: false },
      { content: 'AI хариулт 2', customer: false, ai: true },
      { content: 'Дахиад хариулна уу', customer: true, ai: false },
      { content: 'AI хариулт 3', customer: false, ai: true },
    ])
    // countConsecutiveAiOnly returns 3 (all 3 customer messages, no human break)
    const result = evaluateEscalation(0, 'Хариулна уу', recentMsgs, DEFAULT_CONFIG)
    expect(result.signals).toContain('ai_fail_to_resolve')
    expect(result.newScore).toBeGreaterThanOrEqual(15) // ai_fail_to_resolve(15)
  })

  // E7: double charge — payment_dispute + complaint
  it('E7: "Давхар төлсөн байна! Энэ асуудалтай байна" detects payment_dispute and complaint', () => {
    const result = evaluateEscalation(0, 'Давхар төлсөн байна! Энэ асуудалтай байна', [], DEFAULT_CONFIG)
    expect(result.signals).toContain('payment_dispute') // "давхар төлсөн"
    expect(result.signals).toContain('complaint')       // "асуудал" in "асуудалтай"
    expect(result.newScore).toBe(50) // complaint(25) + payment_dispute(25)
  })

  // E8: compound scenario → ESCALATE
  it('E8: complaint + frustration + payment dispute triggers escalation at threshold', () => {
    const result = evaluateEscalation(
      0,
      'Гомдол байна, уурласан байна, давхар төлсөн!',
      [],
      DEFAULT_CONFIG
    )
    expect(result.signals).toContain('complaint')       // "гомдол"
    expect(result.signals).toContain('frustration')     // "уурласан"
    expect(result.signals).toContain('payment_dispute') // "давхар төлсөн"
    // complaint(25) + frustration(20) + payment_dispute(25) = 70 ≥ threshold(60)
    expect(result.newScore).toBe(70)
    expect(result.shouldEscalate).toBe(true)
    expect(result.level).toBe('high')
  })
})

// ---------------------------------------------------------------------------
// Individual keyword detection tests
// ---------------------------------------------------------------------------

describe('Keyword Detection Coverage', () => {
  describe('Complaint keywords', () => {
    const complaints = [
      ['гомдол', 'Гомдол байна'],
      ['асуудал', 'Асуудалтай байна'],
      ['муу', 'Маш муу'],
      ['буруу', 'Буруу бараа ирсэн'],
      ['алдаа', 'Алдаа гарсан'],
      ['сэтгэл ханамжгүй', 'Сэтгэл ханамжгүй байна'],
      ['чанар муу', 'Чанар муу бараа'],
      ['эвдэрсэн', 'Эвдэрсэн байна'],
      ['гэмтсэн', 'Гэмтсэн ирсэн'],
      ['хуурамч', 'Хуурамч бараа'],
      ['луйвар', 'Луйвар байна'],
      ['тохиромжгүй', 'Тохиромжгүй байна'],
    ] as const

    complaints.forEach(([keyword, message]) => {
      it(`detects complaint keyword "${keyword}"`, () => {
        const result = evaluateEscalation(0, message, [], DEFAULT_CONFIG)
        expect(result.signals).toContain('complaint')
        expect(result.newScore).toBeGreaterThanOrEqual(25)
      })
    })
  })

  describe('Frustration keywords', () => {
    const frustrations = [
      ['яагаад', 'Яагаад ингэж байна'],
      ['яаж ийм', 'Яаж ийм юм байна'],
      ['битгий', 'Битгий ийм юм хэл'],
      ['хэрэггүй', 'Хэрэггүй юм'],
      ['уурласан', 'Уурласан байна'],
      ['бухимдсан', 'Бухимдсан байна'],
      ['залхсан', 'Залхсан байна'],
      ['ичмээр', 'Ичмээр юм'],
      ['ямар ч', 'Ямар ч хариу алга'],
      ['хариулахгүй', 'Хариулахгүй байна'],
      ['хэзээ ч', 'Хэзээ ч хариу өгөхгүй'],
    ] as const

    frustrations.forEach(([keyword, message]) => {
      it(`detects frustration keyword "${keyword}"`, () => {
        const result = evaluateEscalation(0, message, [], DEFAULT_CONFIG)
        expect(result.signals).toContain('frustration')
        expect(result.newScore).toBeGreaterThanOrEqual(20)
      })
    })
  })

  describe('Return/exchange keywords', () => {
    const returns = [
      ['буцаах', 'Буцаах хүсэлтэй'],
      ['буцаалт', 'Буцаалт хийнэ'],
      ['солих', 'Солих боломжтой юу'],
      ['солилцох', 'Солилцох хүсэлтэй'],
      ['буцааж өгөх', 'Буцааж өгөх боломжтой юу'],
      ['мөнгө буцаах', 'Мөнгө буцаах хүсэлтэй'],
    ] as const

    returns.forEach(([keyword, message]) => {
      it(`detects return_exchange keyword "${keyword}"`, () => {
        const result = evaluateEscalation(0, message, [], DEFAULT_CONFIG)
        expect(result.signals).toContain('return_exchange')
        expect(result.newScore).toBeGreaterThanOrEqual(20)
      })
    })
  })

  describe('Payment dispute keywords', () => {
    const payments = [
      ['төлбөр буруу', 'Төлбөр буруу тооцсон'],
      ['давхар төлсөн', 'Давхар төлсөн байна'],
      ['мөнгө ирээгүй', 'Мөнгө ирээгүй байна'],
      ['залилсан', 'Залилсан байна'],
      ['хуурсан', 'Хуурсан байна шүү'],
      ['төлбөр төлсөн ч', 'Төлбөр төлсөн ч юу ч болсонгүй'],
    ] as const

    payments.forEach(([keyword, message]) => {
      it(`detects payment_dispute keyword "${keyword}"`, () => {
        const result = evaluateEscalation(0, message, [], DEFAULT_CONFIG)
        expect(result.signals).toContain('payment_dispute')
        expect(result.newScore).toBeGreaterThanOrEqual(25)
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Configuration tests
// ---------------------------------------------------------------------------

describe('Escalation Configuration', () => {
  it('disabled config never escalates', () => {
    const result = evaluateEscalation(
      0,
      'Гомдол байна, давхар төлсөн, уурласан байна!',
      [],
      DISABLED_CONFIG
    )
    expect(result.shouldEscalate).toBe(false)
    expect(result.newScore).toBe(0) // returns currentScore unchanged when disabled
  })

  it('does not escalate if already above threshold', () => {
    // wasBelow && isAbove — only escalates on first crossing
    const result = evaluateEscalation(
      70, // already above 60
      'Гомдол байна',
      [],
      DEFAULT_CONFIG
    )
    expect(result.shouldEscalate).toBe(false) // wasBelow is false
    expect(result.newScore).toBe(95) // 70 + complaint(25)
  })

  it('score is capped at 100', () => {
    const result = evaluateEscalation(
      90,
      'Гомдол байна, давхар төлсөн, уурласан байна',
      [],
      DEFAULT_CONFIG
    )
    // 90 + complaint(25) + payment_dispute(25) + frustration(20) = 160, capped at 100
    expect(result.newScore).toBe(100)
  })

  it('escalates exactly at threshold crossing', () => {
    // currentScore=40, add complaint(25) → 65 ≥ 60
    const result = evaluateEscalation(40, 'Гомдол байна', [], DEFAULT_CONFIG)
    expect(result.shouldEscalate).toBe(true)
    expect(result.newScore).toBe(65)
    expect(result.level).toBe('high')
  })

  it('custom threshold works correctly', () => {
    const highThreshold: EscalationConfig = { enabled: true, threshold: 90 }
    // complaint(25) + frustration(20) + payment(25) = 70 < 90 threshold
    const result = evaluateEscalation(
      0,
      'Гомдол байна, уурласан байна, давхар төлсөн',
      [],
      highThreshold
    )
    expect(result.shouldEscalate).toBe(false)
    expect(result.newScore).toBe(70)
  })
})

// ---------------------------------------------------------------------------
// Long unresolved thread
// ---------------------------------------------------------------------------

describe('Long Unresolved Thread', () => {
  it('6+ customer messages with no human reply triggers long_unresolved', () => {
    // Need 6 customer messages in recentMessages (totalCustomerMsgs >= 6)
    const msgs = makeMessages([
      { content: 'Msg 1', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 2', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 3', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 4', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 5', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 6', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
    ])
    const result = evaluateEscalation(0, 'Msg 7', msgs, DEFAULT_CONFIG)
    expect(result.signals).toContain('long_unresolved')
    // Also triggers ai_fail_to_resolve since countConsecutiveAiOnly >= 3
    expect(result.signals).toContain('ai_fail_to_resolve')
  })

  it('does NOT trigger long_unresolved with fewer than 6 customer messages', () => {
    const msgs = makeMessages([
      { content: 'Msg 1', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 2', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 3', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 4', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 5', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
    ])
    const result = evaluateEscalation(0, 'Msg 6', msgs, DEFAULT_CONFIG)
    expect(result.signals).not.toContain('long_unresolved')
  })

  it('human agent reply prevents long_unresolved', () => {
    const msgs = makeMessages([
      { content: 'Msg 1', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 2', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 3', customer: true, ai: false },
      { content: 'Human agent', customer: false, ai: false }, // human reply
      { content: 'Msg 4', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 5', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
      { content: 'Msg 6', customer: true, ai: false },
      { content: 'AI', customer: false, ai: true },
    ])
    const result = evaluateEscalation(0, 'Msg 7', msgs, DEFAULT_CONFIG)
    // hasHumanReply = true, so long_unresolved won't trigger
    expect(result.signals).not.toContain('long_unresolved')
  })
})

// ---------------------------------------------------------------------------
// Score accumulation across turns
// ---------------------------------------------------------------------------

describe('Score Accumulation', () => {
  it('score accumulates over multiple evaluations', () => {
    // Turn 1: complaint
    const r1 = evaluateEscalation(0, 'Асуудалтай байна', [], DEFAULT_CONFIG)
    expect(r1.newScore).toBe(25)
    expect(r1.shouldEscalate).toBe(false)

    // Turn 2: frustration (score continues from r1)
    const r2 = evaluateEscalation(r1.newScore, 'Уурласан байна', [], DEFAULT_CONFIG)
    expect(r2.newScore).toBe(45)
    expect(r2.shouldEscalate).toBe(false)

    // Turn 3: payment dispute (crosses threshold)
    const r3 = evaluateEscalation(r2.newScore, 'Давхар төлсөн байна', [], DEFAULT_CONFIG)
    expect(r3.newScore).toBe(70) // 45 + 25
    expect(r3.shouldEscalate).toBe(true)
    expect(r3.level).toBe('high')
  })

  it('no signals means score stays the same', () => {
    const result = evaluateEscalation(30, 'Сайн байна уу', [], DEFAULT_CONFIG)
    expect(result.signals).toEqual([])
    expect(result.newScore).toBe(30)
    expect(result.shouldEscalate).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Known Limitations (documented, not bugs)
// ---------------------------------------------------------------------------

describe('Known Limitations — Verb Conjugation', () => {
  it('conjugated "буцааж" does NOT match infinitive "буцаах"', () => {
    const result = evaluateEscalation(0, 'Буцааж өгнө үү', [], DEFAULT_CONFIG)
    // "буцааж" ≠ "буцаах", "буцааж өгнө" ≠ "буцааж өгөх"
    expect(result.signals).not.toContain('return_exchange')
  })

  it('conjugated "мөнгөө" does NOT match "мөнгө буцаах"', () => {
    const result = evaluateEscalation(0, 'Мөнгөө буцааж өг', [], DEFAULT_CONFIG)
    // "мөнгөө" ≠ "мөнгө", substring check fails
    expect(result.signals).not.toContain('return_exchange')
  })
})
