import { describe, it, expect } from 'vitest'
import { scoreAIResponse } from './quality-scorer'

describe('quality-scorer', () => {
  const baseInput = {
    confidence: 0.8,
    detectedIssues: [],
    requiresHumanReview: false,
    intent: 'product_search',
    responseText: 'Байна! 👇',
    customerMessage: 'Цамц байна уу?',
  }

  it('scores high-confidence response highly', () => {
    const result = scoreAIResponse({ ...baseInput, confidence: 0.95 })
    expect(result.score).toBeGreaterThanOrEqual(90)
    expect(result.isUnanswered).toBe(false)
  })

  it('penalizes requires_human_review by 20 points', () => {
    const a = scoreAIResponse(baseInput)
    const b = scoreAIResponse({ ...baseInput, requiresHumanReview: true })
    expect(a.score - b.score).toBe(20)
  })

  it('penalizes 10 points per detected issue', () => {
    const result = scoreAIResponse({
      ...baseInput,
      detectedIssues: ['complaint', 'delivery_delay', 'wrong_item'],
    })
    expect(result.score).toBe(80 - 30) // 0.8 * 100 - 3*10
  })

  it('marks response as unanswered when contains "олдсонгүй"', () => {
    const result = scoreAIResponse({
      ...baseInput,
      responseText: 'Уучлаарай, яг тэр бараа олдсонгүй',
    })
    expect(result.isUnanswered).toBe(true)
    expect(result.score).toBeLessThanOrEqual(50) // confidence 80 - 30 penalty = 50
  })

  it('marks response as unanswered when contains "мэдэхгүй"', () => {
    const result = scoreAIResponse({
      ...baseInput,
      responseText: 'Энэ асуултад мэдэхгүй байна',
    })
    expect(result.isUnanswered).toBe(true)
  })

  it('marks response as unanswered when contains "дэлгүүртэй холбогдоно уу"', () => {
    const result = scoreAIResponse({
      ...baseInput,
      responseText: 'Дэлгүүртэй холбогдоно уу',
    })
    expect(result.isUnanswered).toBe(true)
  })

  it('marks low-score responses as unanswered (score < 30)', () => {
    const result = scoreAIResponse({
      ...baseInput,
      confidence: 0.2,
      detectedIssues: ['a', 'b'],
    })
    expect(result.score).toBeLessThan(30)
    expect(result.isUnanswered).toBe(true)
  })

  it('clamps score to 0-100 range', () => {
    const low = scoreAIResponse({
      ...baseInput,
      confidence: 0.0,
      detectedIssues: ['a', 'b', 'c', 'd', 'e'],
      requiresHumanReview: true,
    })
    expect(low.score).toBe(0)

    const high = scoreAIResponse({ ...baseInput, confidence: 1.0 })
    expect(high.score).toBe(100)
  })

  it('returns false for isUnanswered when no markers AND score >= 30', () => {
    const result = scoreAIResponse({
      ...baseInput,
      confidence: 0.5,
      responseText: 'Сайн байна уу! Танд юугаар туслах вэ?',
    })
    expect(result.isUnanswered).toBe(false)
  })
})
