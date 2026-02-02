/**
 * Tests for the delivery fee calculator.
 */
import { describe, it, expect } from 'vitest'
import { calculateDeliveryFee, getDeliveryZones } from './delivery-fee-calculator'

describe('calculateDeliveryFee', () => {
  // Central zone tests
  it('returns 3000 for Сүхбаатар district', () => {
    const result = calculateDeliveryFee('Сүхбаатар дүүрэг, 1-р хороо')
    expect(result.fee).toBe(3000)
    expect(result.zone).toBe('Central')
    expect(result.district).toBe('Сүхбаатар')
  })

  it('returns 3000 for Чингэлтэй district', () => {
    const result = calculateDeliveryFee('Чингэлтэй дүүрэг, Хуучин нарны зам')
    expect(result.fee).toBe(3000)
    expect(result.zone).toBe('Central')
    expect(result.district).toBe('Чингэлтэй')
  })

  it('returns 3000 for Баянгол district', () => {
    const result = calculateDeliveryFee('Баянгол дүүрэг, 14-р хороо')
    expect(result.fee).toBe(3000)
    expect(result.zone).toBe('Central')
    expect(result.district).toBe('Баянгол')
  })

  // Mid zone tests
  it('returns 5000 for Хан-Уул district', () => {
    const result = calculateDeliveryFee('Хан-Уул дүүрэг, Зайсан')
    expect(result.fee).toBe(5000)
    expect(result.zone).toBe('Mid')
    expect(result.district).toBe('Хан-Уул')
  })

  it('returns 5000 for Баянзүрх district', () => {
    const result = calculateDeliveryFee('Баянзүрх дүүрэг, 13-р хороолол')
    expect(result.fee).toBe(5000)
    expect(result.zone).toBe('Mid')
    expect(result.district).toBe('Баянзүрх')
  })

  it('returns 5000 for Сонгинохайрхан district', () => {
    const result = calculateDeliveryFee('Сонгинохайрхан дүүрэг')
    expect(result.fee).toBe(5000)
    expect(result.zone).toBe('Mid')
    expect(result.district).toBe('Сонгинохайрхан')
  })

  // Outer zone tests
  it('returns 8000 for Налайх district', () => {
    const result = calculateDeliveryFee('Налайх дүүрэг, 1-р хороо')
    expect(result.fee).toBe(8000)
    expect(result.zone).toBe('Outer')
    expect(result.district).toBe('Налайх')
  })

  it('returns 8000 for Багануур district', () => {
    const result = calculateDeliveryFee('Багануур дүүрэг, Үйлдвэрийн')
    expect(result.fee).toBe(8000)
    expect(result.zone).toBe('Outer')
    expect(result.district).toBe('Багануур')
  })

  it('returns 8000 for Багахангай district', () => {
    const result = calculateDeliveryFee('Багахангай дүүрэг')
    expect(result.fee).toBe(8000)
    expect(result.zone).toBe('Outer')
    expect(result.district).toBe('Багахангай')
  })

  // Default / unknown
  it('returns default 5000 for unknown district', () => {
    const result = calculateDeliveryFee('Дархан хот, 1-р хороолол')
    expect(result.fee).toBe(5000)
    expect(result.zone).toBe('Default')
    expect(result.district).toBeNull()
  })

  it('returns default 5000 for empty-like address', () => {
    const result = calculateDeliveryFee('гэр хороо')
    expect(result.fee).toBe(5000)
    expect(result.zone).toBe('Default')
  })

  // Case insensitive
  it('is case insensitive for district matching', () => {
    const result = calculateDeliveryFee('сүхбаатар дүүрэг')
    expect(result.fee).toBe(3000)
    expect(result.district).toBe('Сүхбаатар')
  })
})

describe('getDeliveryZones', () => {
  it('returns all 3 zones', () => {
    const zones = getDeliveryZones()
    expect(zones).toHaveLength(3)
  })

  it('includes Central, Mid, and Outer zones', () => {
    const zones = getDeliveryZones()
    const names = zones.map(z => z.name)
    expect(names).toContain('Central')
    expect(names).toContain('Mid')
    expect(names).toContain('Outer')
  })

  it('Central zone has 3 districts', () => {
    const zones = getDeliveryZones()
    const central = zones.find(z => z.name === 'Central')!
    expect(central.districts).toHaveLength(3)
    expect(central.fee).toBe(3000)
  })

  it('Outer zone has highest fee', () => {
    const zones = getDeliveryZones()
    const outer = zones.find(z => z.name === 'Outer')!
    expect(outer.fee).toBe(8000)
  })
})
