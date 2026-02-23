import { describe, it, expect } from 'vitest'
import {
  formatPurchaseConfirmation,
  inferPreferencesFromMessage,
  formatExtendedProfileForAI,
  type LatestPurchase,
  type ExtendedCustomerInfo,
} from '../customer-intelligence'

// ─────────────────────────────────────────────────────────────
// formatPurchaseConfirmation
// ─────────────────────────────────────────────────────────────

describe('formatPurchaseConfirmation', () => {
  const purchase: LatestPurchase = {
    order_id: 'order-1',
    order_number: 'ORD-12345',
    status: 'delivered',
    total_amount: 89000,
    created_at: '2026-02-20T10:00:00Z',
    items: [
      { product_name: 'Кашемир свитер', quantity: 1, price: 89000 },
    ],
  }

  it('formats single-item purchase', () => {
    const result = formatPurchaseConfirmation(purchase)
    expect(result).toContain('ORD-12345')
    expect(result).toContain('Кашемир свитер')
    expect(result).toContain('89,000₮')
    expect(result).toContain('Энэ захиалгатай холбоотой юу?')
  })

  it('formats multi-item purchase', () => {
    const multiPurchase: LatestPurchase = {
      ...purchase,
      total_amount: 178000,
      items: [
        { product_name: 'Кашемир свитер', quantity: 1, price: 89000 },
        { product_name: 'Ноолууран малгай', quantity: 2, price: 44500 },
      ],
    }
    const result = formatPurchaseConfirmation(multiPurchase)
    expect(result).toContain('1x Кашемир свитер')
    expect(result).toContain('2x Ноолууран малгай')
    expect(result).toContain('178,000₮')
  })
})

// ─────────────────────────────────────────────────────────────
// inferPreferencesFromMessage
// ─────────────────────────────────────────────────────────────

describe('inferPreferencesFromMessage', () => {
  it('detects size preferences', () => {
    const prefs = inferPreferencesFromMessage('M размер байна уу?')
    expect(prefs).toContainEqual(expect.objectContaining({ type: 'style', key: 'preferred_size' }))
  })

  it('detects budget preference — low', () => {
    const prefs = inferPreferencesFromMessage('хямд бараа байна уу?')
    expect(prefs).toContainEqual({ type: 'budget_range', key: 'budget', value: 'low' })
  })

  it('detects budget preference — high', () => {
    const prefs = inferPreferencesFromMessage('чанартай premium бараа хүсч байна')
    expect(prefs).toContainEqual({ type: 'budget_range', key: 'budget', value: 'high' })
  })

  it('detects dietary preferences', () => {
    const prefs = inferPreferencesFromMessage('веган хоол байна уу?')
    expect(prefs).toContainEqual({ type: 'dietary', key: 'vegan', value: 'true' })
  })

  it('detects halal preference', () => {
    const prefs = inferPreferencesFromMessage('халал хоол захиалмаар байна')
    expect(prefs).toContainEqual({ type: 'dietary', key: 'halal', value: 'true' })
  })

  it('detects gluten allergy', () => {
    const prefs = inferPreferencesFromMessage('глютенгүй хоол байна уу?')
    expect(prefs).toContainEqual({ type: 'allergy', key: 'gluten', value: 'true' })
  })

  it('detects interest categories', () => {
    const prefs = inferPreferencesFromMessage('гутал хайж байна')
    expect(prefs).toContainEqual({ type: 'interest', key: 'shoes' })
  })

  it('returns empty for neutral message', () => {
    const prefs = inferPreferencesFromMessage('Сайн байна уу')
    expect(prefs).toHaveLength(0)
  })

  it('detects multiple preferences in one message', () => {
    const prefs = inferPreferencesFromMessage('XL размер чанартай хувцас хайж байна')
    expect(prefs.length).toBeGreaterThanOrEqual(2)
    expect(prefs).toContainEqual(expect.objectContaining({ type: 'style', key: 'preferred_size' }))
    expect(prefs).toContainEqual(expect.objectContaining({ type: 'interest', key: 'clothing' }))
  })
})

// ─────────────────────────────────────────────────────────────
// formatExtendedProfileForAI
// ─────────────────────────────────────────────────────────────

describe('formatExtendedProfileForAI', () => {
  const baseInfo: ExtendedCustomerInfo = {
    birthday: null,
    gender: null,
    age_range: null,
    preferred_size: null,
    preferred_language: 'mn',
    address: null,
    phone: null,
    preferences: [],
    complaint_count: 0,
    return_count: 0,
    last_complaint_date: null,
  }

  it('returns empty string for minimal profile', () => {
    expect(formatExtendedProfileForAI(baseInfo)).toBe('')
  })

  it('includes gender in Mongolian', () => {
    const result = formatExtendedProfileForAI({ ...baseInfo, gender: 'female' })
    expect(result).toContain('Эмэгтэй')
  })

  it('includes age range', () => {
    const result = formatExtendedProfileForAI({ ...baseInfo, age_range: '25-34' })
    expect(result).toContain('25-34')
  })

  it('includes preferred size', () => {
    const result = formatExtendedProfileForAI({ ...baseInfo, preferred_size: 'L' })
    expect(result).toContain('Размер: L')
  })

  it('shows birthday alert on birthday month', () => {
    const today = new Date()
    const birthday = `2000-${String(today.getMonth() + 1).padStart(2, '0')}-15`
    const result = formatExtendedProfileForAI({ ...baseInfo, birthday })
    expect(result).toContain('🎂')
  })

  it('shows complaint warning', () => {
    const result = formatExtendedProfileForAI({
      ...baseInfo,
      complaint_count: 3,
      last_complaint_date: '2026-02-20T10:00:00Z',
    })
    expect(result).toContain('⚠️')
    expect(result).toContain('3 гомдол')
  })

  it('shows return count', () => {
    const result = formatExtendedProfileForAI({ ...baseInfo, return_count: 2 })
    expect(result).toContain('2 буцаалт')
  })

  it('includes preferences with sufficient confidence', () => {
    const result = formatExtendedProfileForAI({
      ...baseInfo,
      preferences: [
        { preference_type: 'interest', preference_key: 'shoes', preference_value: null, confidence: 0.8, source: 'observed' as const },
        { preference_type: 'budget_range', preference_key: 'budget', preference_value: 'high', confidence: 0.6, source: 'inferred' as const },
      ],
    })
    expect(result).toContain('shoes')
    expect(result).toContain('high бюджет')
  })

  it('excludes low-confidence preferences', () => {
    const result = formatExtendedProfileForAI({
      ...baseInfo,
      preferences: [
        { preference_type: 'interest', preference_key: 'food', preference_value: null, confidence: 0.3, source: 'inferred' as const },
      ],
    })
    expect(result).not.toContain('food')
  })

  it('includes address when available', () => {
    const result = formatExtendedProfileForAI({ ...baseInfo, address: 'БЗД 3-р хороо' })
    expect(result).toContain('БЗД 3-р хороо')
  })
})
