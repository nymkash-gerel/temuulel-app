/**
 * Tests for i18n translation system.
 * Verifies key parity between languages and translation function behavior.
 */
import { describe, it, expect } from 'vitest'
import { translations } from './translations'

describe('translations', () => {
  const mnKeys = Object.keys(translations.mn)
  const enKeys = Object.keys(translations.en)

  it('has Mongolian translations', () => {
    expect(mnKeys.length).toBeGreaterThan(0)
  })

  it('has English translations', () => {
    expect(enKeys.length).toBeGreaterThan(0)
  })

  it('every Mongolian key has an English equivalent', () => {
    const missingInEn = mnKeys.filter(key => !(key in translations.en))
    expect(missingInEn).toEqual([])
  })

  it('every English key has a Mongolian equivalent', () => {
    const missingInMn = enKeys.filter(key => !(key in translations.mn))
    expect(missingInMn).toEqual([])
  })

  it('Mongolian and English have the same number of keys', () => {
    expect(mnKeys.length).toBe(enKeys.length)
  })

  it('no Mongolian value is empty', () => {
    const emptyKeys = mnKeys.filter(key => translations.mn[key].trim() === '')
    expect(emptyKeys).toEqual([])
  })

  it('no English value is empty', () => {
    const emptyKeys = enKeys.filter(key => translations.en[key].trim() === '')
    expect(emptyKeys).toEqual([])
  })

  it('Mongolian and English values are different (not just copies)', () => {
    // At least 80% of keys should have different values between languages
    const sameValues = mnKeys.filter(key => translations.mn[key] === translations.en[key])
    // Some keys like "Excel", "CSV", "SKU" may be the same — that's fine
    const differentRatio = (mnKeys.length - sameValues.length) / mnKeys.length
    expect(differentRatio).toBeGreaterThan(0.8)
  })

  it('contains navigation keys', () => {
    expect(translations.mn['nav.overview']).toBeDefined()
    expect(translations.en['nav.overview']).toBe('Dashboard')
  })

  it('contains common button keys', () => {
    expect(translations.mn['common.save']).toBe('Хадгалах')
    expect(translations.en['common.save']).toBe('Save')
  })

  it('contains status labels', () => {
    expect(translations.mn['status.pending']).toBeDefined()
    expect(translations.en['status.delivered']).toBe('Delivered')
  })

  it('contains error messages', () => {
    expect(translations.mn['error.notFound']).toBeDefined()
    expect(translations.en['error.notFound']).toBe('Not found')
  })

  it('contains delivery-related keys', () => {
    expect(translations.mn['delivery.title']).toBeDefined()
    expect(translations.en['delivery.scheduledDate']).toBe('Scheduled Date')
    expect(translations.en['delivery.timeSlot']).toBe('Time Slot')
  })

  it('contains chat-related keys', () => {
    expect(translations.mn['chat.driverChat']).toBeDefined()
    expect(translations.en['chat.sendMessage']).toBe('Send Message')
  })
})
