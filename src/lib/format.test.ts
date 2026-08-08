import { describe, it, expect } from 'vitest'
import { formatPrice, orderStatusLabel } from './format'

describe('formatPrice', () => {
  it('groups thousands and appends ₮', () => {
    expect(formatPrice(50000)).toBe('50,000₮')
  })

  it('renders null/undefined as 0₮ so callers need no guard', () => {
    expect(formatPrice(null)).toBe('0₮')
    expect(formatPrice(undefined)).toBe('0₮')
  })

  it('handles zero', () => {
    expect(formatPrice(0)).toBe('0₮')
  })
})

describe('orderStatusLabel', () => {
  it.each([
    ['pending', 'Хүлээгдэж буй'],
    ['confirmed', 'Баталгаажсан'],
    ['processing', 'Бэлтгэж буй'],
    ['shipped', 'Илгээсэн'],
    ['delivered', 'Хүргэсэн'],
    ['cancelled', 'Цуцлагдсан'],
  ])('translates %s', (status, label) => {
    expect(orderStatusLabel(status)).toBe(label)
  })

  it('passes through statuses outside the order enum', () => {
    // Delivery and appointment statuses share this helper.
    expect(orderStatusLabel('picked_up')).toBe('picked_up')
    expect(orderStatusLabel('')).toBe('')
  })

  // A bare `LABELS[status] || status` lookup resolves inherited members, so a
  // status named after one would return a function where the signature
  // promises a string.
  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'does not leak the Object.prototype member %s',
    (status) => {
      const result = orderStatusLabel(status)
      expect(typeof result).toBe('string')
      expect(result).toBe(status)
    }
  )
})
