import { describe, it, expect } from 'vitest'
import { interpolateVariables, validateInput } from './flow-executor'

describe('flow-executor', () => {
  describe('interpolateVariables', () => {
    it('replaces single variable', () => {
      expect(interpolateVariables('Hello {{name}}!', { name: 'Bat' }))
        .toBe('Hello Bat!')
    })

    it('replaces multiple variables', () => {
      expect(interpolateVariables('{{item}} x{{qty}} = {{total}}₮', {
        item: 'Бууз', qty: 2, total: 24000,
      })).toBe('Бууз x2 = 24000₮')
    })

    it('preserves unknown variables', () => {
      expect(interpolateVariables('{{name}} - {{phone}}', { name: 'Bat' }))
        .toBe('Bat - {{phone}}')
    })

    it('handles null/undefined values', () => {
      expect(interpolateVariables('Val: {{x}}', { x: null }))
        .toBe('Val: {{x}}')
    })

    it('handles empty variables object', () => {
      expect(interpolateVariables('No {{vars}} here', {}))
        .toBe('No {{vars}} here')
    })

    it('handles text without variables', () => {
      expect(interpolateVariables('Plain text', { name: 'X' }))
        .toBe('Plain text')
    })
  })

  describe('validateInput', () => {
    describe('phone validation', () => {
      it('accepts valid phone numbers', () => {
        expect(validateInput('99001122', 'phone')).toBe(true)
        expect(validateInput('+97699001122', 'phone')).toBe(true)
        expect(validateInput('9900 1122', 'phone')).toBe(true)
      })

      it('rejects invalid phone numbers', () => {
        expect(validateInput('abc', 'phone')).toBe(false)
        expect(validateInput('12', 'phone')).toBe(false)
        expect(validateInput('', 'phone')).toBe(false)
      })
    })

    describe('email validation', () => {
      it('accepts valid emails', () => {
        expect(validateInput('test@example.com', 'email')).toBe(true)
        expect(validateInput('user+tag@domain.mn', 'email')).toBe(true)
      })

      it('rejects invalid emails', () => {
        expect(validateInput('notanemail', 'email')).toBe(false)
        expect(validateInput('no@', 'email')).toBe(false)
        expect(validateInput('', 'email')).toBe(false)
      })
    })

    describe('number validation', () => {
      it('accepts valid numbers', () => {
        expect(validateInput('42', 'number')).toBe(true)
        expect(validateInput('3.5', 'number')).toBe(true)
        expect(validateInput('100', 'number')).toBe(true)
      })

      it('rejects non-numbers', () => {
        expect(validateInput('abc', 'number')).toBe(false)
        expect(validateInput('', 'number')).toBe(false)
      })
    })

    describe('date validation', () => {
      it('accepts numeric date strings', () => {
        expect(validateInput('2024-02-15', 'date')).toBe(true)
        expect(validateInput('маргааш 10 цагт', 'date')).toBe(true)
        expect(validateInput('02/15', 'date')).toBe(true)
        expect(validateInput('3-р сарын 10', 'date')).toBe(true)
      })

      it('accepts Mongolian text dates (no digits)', () => {
        expect(validateInput('маргааш', 'date')).toBe(true)
        expect(validateInput('өнөөдөр', 'date')).toBe(true)
        expect(validateInput('нөгөөдөр', 'date')).toBe(true)
        expect(validateInput('даваа', 'date')).toBe(true)
        expect(validateInput('мягмар', 'date')).toBe(true)
        expect(validateInput('лхагва', 'date')).toBe(true)
        expect(validateInput('пүрэв', 'date')).toBe(true)
        expect(validateInput('баасан', 'date')).toBe(true)
        expect(validateInput('бямба', 'date')).toBe(true)
        expect(validateInput('ням', 'date')).toBe(true)
        expect(validateInput('даваа гараг', 'date')).toBe(true)
        expect(validateInput('ирэх долоо хоног', 'date')).toBe(true)
      })

      it('rejects random text without digits or known date words', () => {
        expect(validateInput('abc', 'date')).toBe(false)
        expect(validateInput('x', 'date')).toBe(false)
        expect(validateInput('', 'date')).toBe(false)
      })
    })

    describe('text validation', () => {
      it('accepts non-empty text', () => {
        expect(validateInput('hello', 'text')).toBe(true)
        expect(validateInput('a', 'text')).toBe(true)
      })

      it('rejects empty text', () => {
        expect(validateInput('', 'text')).toBe(false)
        expect(validateInput('   ', 'text')).toBe(false)
      })
    })

    it('accepts anything when no rule specified', () => {
      expect(validateInput('anything', undefined)).toBe(true)
    })
  })
})
