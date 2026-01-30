/**
 * Tests for the smart escalation scoring engine.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateEscalation,
  scoreToLevel,
  detectRepeatedMessage,
  countConsecutiveAiOnly,
  type EscalationConfig,
  type RecentMessage,
} from './escalation'

const DEFAULT_CONFIG: EscalationConfig = { enabled: true, threshold: 60 }

function msg(content: string, fromCustomer: boolean, aiResponse: boolean): RecentMessage {
  return { content, is_from_customer: fromCustomer, is_ai_response: aiResponse }
}

// ---------------------------------------------------------------------------
// scoreToLevel
// ---------------------------------------------------------------------------

describe('scoreToLevel', () => {
  it('maps 0 to low', () => expect(scoreToLevel(0)).toBe('low'))
  it('maps 29 to low', () => expect(scoreToLevel(29)).toBe('low'))
  it('maps 30 to medium', () => expect(scoreToLevel(30)).toBe('medium'))
  it('maps 59 to medium', () => expect(scoreToLevel(59)).toBe('medium'))
  it('maps 60 to high', () => expect(scoreToLevel(60)).toBe('high'))
  it('maps 79 to high', () => expect(scoreToLevel(79)).toBe('high'))
  it('maps 80 to critical', () => expect(scoreToLevel(80)).toBe('critical'))
  it('maps 100 to critical', () => expect(scoreToLevel(100)).toBe('critical'))
})

// ---------------------------------------------------------------------------
// detectRepeatedMessage
// ---------------------------------------------------------------------------

describe('detectRepeatedMessage', () => {
  it('returns true for identical messages', () => {
    expect(detectRepeatedMessage('Сайн байна уу', ['Сайн байна уу'])).toBe(true)
  })

  it('returns true for near-identical messages', () => {
    expect(detectRepeatedMessage('Сайн байна уу?', ['Сайн байна уу'])).toBe(true)
  })

  it('returns false for different messages', () => {
    expect(detectRepeatedMessage('Бараа байна уу', ['Захиалга хаана байна'])).toBe(false)
  })

  it('returns false for empty recent messages', () => {
    expect(detectRepeatedMessage('Сайн байна уу', [])).toBe(false)
  })

  it('handles empty message', () => {
    expect(detectRepeatedMessage('', ['hello'])).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// countConsecutiveAiOnly
// ---------------------------------------------------------------------------

describe('countConsecutiveAiOnly', () => {
  it('counts 0 when last reply is from human agent', () => {
    const msgs = [
      msg('Сайн байна уу', true, false),
      msg('Тусалъя', false, false), // human
    ]
    expect(countConsecutiveAiOnly(msgs)).toBe(0)
  })

  it('counts customer messages after AI-only replies', () => {
    const msgs = [
      msg('Бараа байна уу', true, false),
      msg('Байна', false, true), // AI
      msg('Үнэ хэд вэ', true, false),
      msg('50000₮', false, true), // AI
      msg('Арай өөр бараа байна уу', true, false),
    ]
    expect(countConsecutiveAiOnly(msgs)).toBe(3)
  })

  it('stops counting at human agent reply', () => {
    const msgs = [
      msg('Асуулт 1', true, false),
      msg('Хариулт', false, false), // human
      msg('Асуулт 2', true, false),
      msg('AI хариулт', false, true), // AI
      msg('Асуулт 3', true, false),
    ]
    expect(countConsecutiveAiOnly(msgs)).toBe(2)
  })

  it('returns 0 for empty messages', () => {
    expect(countConsecutiveAiOnly([])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// evaluateEscalation
// ---------------------------------------------------------------------------

describe('evaluateEscalation', () => {
  it('returns low score for simple greeting', () => {
    const result = evaluateEscalation(0, 'Сайн байна уу', [], DEFAULT_CONFIG)
    expect(result.newScore).toBe(0)
    expect(result.level).toBe('low')
    expect(result.shouldEscalate).toBe(false)
    expect(result.signals).toHaveLength(0)
  })

  it('detects complaint keywords (+25)', () => {
    const result = evaluateEscalation(0, 'Гомдол гаргах гэсэн юм', [], DEFAULT_CONFIG)
    expect(result.newScore).toBe(25)
    expect(result.signals).toContain('complaint')
  })

  it('detects frustration language (+20)', () => {
    const result = evaluateEscalation(0, 'Яагаад хариулахгүй байна вэ', [], DEFAULT_CONFIG)
    expect(result.newScore).toBe(20)
    expect(result.signals).toContain('frustration')
  })

  it('detects return/exchange request (+20)', () => {
    const result = evaluateEscalation(0, 'Энэ барааг буцаах боломжтой юу', [], DEFAULT_CONFIG)
    expect(result.newScore).toBe(20)
    expect(result.signals).toContain('return_exchange')
  })

  it('detects payment dispute (+25)', () => {
    const result = evaluateEscalation(0, 'Давхар төлсөн байна шүү', [], DEFAULT_CONFIG)
    expect(result.newScore).toBe(25)
    expect(result.signals).toContain('payment_dispute')
  })

  it('detects repeated messages (+15)', () => {
    const history = [msg('Хариулна уу', true, false)]
    const result = evaluateEscalation(0, 'Хариулна уу', history, DEFAULT_CONFIG)
    expect(result.signals).toContain('repeated_message')
    expect(result.newScore).toBe(15)
  })

  it('detects AI-fail-to-resolve (+15)', () => {
    const history = [
      msg('Асуулт 1', true, false),
      msg('AI хариулт', false, true),
      msg('Асуулт 2', true, false),
      msg('AI хариулт 2', false, true),
      msg('Асуулт 3', true, false), // current message already in DB
    ]
    const result = evaluateEscalation(0, 'Асуулт 3', history, DEFAULT_CONFIG)
    expect(result.signals).toContain('ai_fail_to_resolve')
  })

  it('detects long unresolved thread (+10)', () => {
    const history = [
      msg('Msg 1', true, false),
      msg('AI', false, true),
      msg('Msg 2', true, false),
      msg('AI', false, true),
      msg('Msg 3', true, false),
      msg('AI', false, true),
      msg('Msg 4', true, false),
      msg('AI', false, true),
      msg('Msg 5', true, false),
      msg('AI', false, true),
      msg('Msg 6', true, false), // current message already in DB
    ]
    // 6 customer messages in history, no human reply
    const result = evaluateEscalation(0, 'Msg 6', history, DEFAULT_CONFIG)
    expect(result.signals).toContain('long_unresolved')
  })

  it('stacks multiple signals in one message', () => {
    // complaint (+25) + frustration (+20) = 45
    const result = evaluateEscalation(
      0,
      'Яагаад ийм муу бараа байна вэ, гомдол гаргая',
      [],
      DEFAULT_CONFIG
    )
    expect(result.signals).toContain('complaint')
    expect(result.signals).toContain('frustration')
    expect(result.newScore).toBe(45)
  })

  it('sets shouldEscalate=true when crossing threshold', () => {
    // Start at 40, complaint (+25) → 65 >= 60 threshold
    const result = evaluateEscalation(40, 'Энэ муу бараа байна', [], DEFAULT_CONFIG)
    expect(result.shouldEscalate).toBe(true)
    expect(result.level).toBe('high')
  })

  it('does not re-escalate when already above threshold', () => {
    // Start at 70 (already above 60) — should not trigger shouldEscalate
    const result = evaluateEscalation(70, 'Муу бараа', [], DEFAULT_CONFIG)
    expect(result.shouldEscalate).toBe(false)
    expect(result.newScore).toBeGreaterThanOrEqual(70)
  })

  it('caps score at 100', () => {
    const result = evaluateEscalation(
      90,
      'Яагаад ийм муу бараа, гомдол, буцаах, төлбөр буруу',
      [],
      DEFAULT_CONFIG
    )
    expect(result.newScore).toBeLessThanOrEqual(100)
  })

  it('does nothing when escalation is disabled', () => {
    const result = evaluateEscalation(
      0,
      'Гомдол гаргая',
      [],
      { enabled: false, threshold: 60 }
    )
    expect(result.newScore).toBe(0)
    expect(result.signals).toHaveLength(0)
    expect(result.shouldEscalate).toBe(false)
  })

  it('respects custom threshold', () => {
    // complaint = 25, threshold = 20 → should escalate
    const result = evaluateEscalation(
      0,
      'Энэ муу бараа байна',
      [],
      { enabled: true, threshold: 20 }
    )
    expect(result.shouldEscalate).toBe(true)
  })
})
