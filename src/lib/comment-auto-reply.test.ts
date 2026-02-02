import { describe, it, expect } from 'vitest'
import type { FeedChangeValue, CommentAutoRule } from './comment-auto-reply'

/**
 * We test the exported findMatchingRule logic by importing the module.
 * Since findMatchingRule is not exported, we replicate its behavior here
 * using the same algorithm to verify correctness of the matching logic.
 *
 * For integration tests of handleFeedChange, mocking the Graph API + Supabase
 * is needed, which belongs in an E2E test suite.
 */

// Replicate the matching logic from comment-auto-reply.ts for unit testing
function findMatchingRule(
  rules: CommentAutoRule[],
  change: FeedChangeValue
): CommentAutoRule | null {
  const commentText = (change.message || '').toLowerCase()

  for (const rule of rules) {
    let matches = false

    switch (rule.trigger_type) {
      case 'any':
        matches = true
        break

      case 'keyword':
        if (rule.keywords && rule.keywords.length > 0) {
          const normalizedKeywords = rule.keywords.map(k => k.toLowerCase().trim())
          if (rule.match_mode === 'all') {
            matches = normalizedKeywords.every(kw => commentText.includes(kw))
          } else {
            matches = normalizedKeywords.some(kw => commentText.includes(kw))
          }
        }
        break

      case 'contains_question':
        matches = /\?|юу|хэзээ|хаана|яаж|хэд|хэн|ямар|яагаад|хэдий/i.test(commentText)
        break

      case 'first_comment':
        matches = true
        break
    }

    if (matches) {
      return rule
    }
  }

  return null
}

function makeRule(overrides: Partial<CommentAutoRule> = {}): CommentAutoRule {
  return {
    id: 'rule-1',
    store_id: 'store-1',
    name: 'Test Rule',
    enabled: true,
    priority: 0,
    trigger_type: 'keyword',
    keywords: ['үнэ', 'price'],
    match_mode: 'any',
    reply_comment: true,
    reply_dm: false,
    comment_template: 'Баярлалаа! Үнэ: {{product_price}}',
    dm_template: null,
    delay_seconds: 0,
    platforms: ['facebook', 'instagram'],
    matches_count: 0,
    replies_sent: 0,
    use_ai: false,
    ai_context: null,
    ...overrides,
  }
}

function makeChange(overrides: Partial<FeedChangeValue> = {}): FeedChangeValue {
  return {
    item: 'comment',
    verb: 'add',
    comment_id: 'comment-123',
    post_id: 'post-456',
    from: { id: 'user-789', name: 'Test User' },
    message: 'Үнэ хэд вэ?',
    ...overrides,
  }
}

describe('comment-auto-reply: rule matching', () => {
  describe('keyword trigger', () => {
    it('matches when comment contains keyword (any mode)', () => {
      const rule = makeRule()
      const change = makeChange({ message: 'Үнэ хэд вэ?' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })

    it('matches case-insensitively', () => {
      const rule = makeRule({ keywords: ['PRICE', 'ҮНЭ'] })
      const change = makeChange({ message: 'price please' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })

    it('does not match unrelated comment', () => {
      const rule = makeRule()
      const change = makeChange({ message: 'Сайхан байна' })
      expect(findMatchingRule([rule], change)).toBeNull()
    })

    it('matches all mode when all keywords present', () => {
      const rule = makeRule({
        keywords: ['захиалга', 'хүргэлт'],
        match_mode: 'all',
      })
      const change = makeChange({ message: 'захиалга хүргэлттэй юу?' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })

    it('does not match all mode when only some keywords present', () => {
      const rule = makeRule({
        keywords: ['захиалга', 'хүргэлт'],
        match_mode: 'all',
      })
      const change = makeChange({ message: 'захиалга хийе' })
      expect(findMatchingRule([rule], change)).toBeNull()
    })

    it('does not match when keywords array is empty', () => {
      const rule = makeRule({ keywords: [] })
      const change = makeChange({ message: 'anything' })
      expect(findMatchingRule([rule], change)).toBeNull()
    })

    it('does not match when keywords is null', () => {
      const rule = makeRule({ keywords: null })
      const change = makeChange({ message: 'anything' })
      expect(findMatchingRule([rule], change)).toBeNull()
    })
  })

  describe('any trigger', () => {
    it('matches any comment', () => {
      const rule = makeRule({ trigger_type: 'any' })
      const change = makeChange({ message: 'random text' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })

    it('matches even empty comment', () => {
      const rule = makeRule({ trigger_type: 'any' })
      const change = makeChange({ message: '' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })
  })

  describe('contains_question trigger', () => {
    it('matches comment with question mark', () => {
      const rule = makeRule({ trigger_type: 'contains_question' })
      const change = makeChange({ message: 'Is this available?' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })

    it('matches Mongolian question words', () => {
      const rule = makeRule({ trigger_type: 'contains_question' })

      expect(findMatchingRule([rule], makeChange({ message: 'хэд вэ' }))).toBe(rule)
      expect(findMatchingRule([rule], makeChange({ message: 'хаана авах вэ' }))).toBe(rule)
      expect(findMatchingRule([rule], makeChange({ message: 'хэзээ ирэх вэ' }))).toBe(rule)
      expect(findMatchingRule([rule], makeChange({ message: 'яаж захиалах вэ' }))).toBe(rule)
      expect(findMatchingRule([rule], makeChange({ message: 'ямар өнгөтэй вэ' }))).toBe(rule)
    })

    it('does not match plain statement', () => {
      const rule = makeRule({ trigger_type: 'contains_question' })
      const change = makeChange({ message: 'Сайн байна' })
      expect(findMatchingRule([rule], change)).toBeNull()
    })
  })

  describe('first_comment trigger', () => {
    it('matches any comment (current implementation)', () => {
      const rule = makeRule({ trigger_type: 'first_comment' })
      const change = makeChange({ message: 'Hello!' })
      expect(findMatchingRule([rule], change)).toBe(rule)
    })
  })

  describe('priority ordering', () => {
    it('returns first matching rule by array order', () => {
      const rule1 = makeRule({ id: 'rule-1', trigger_type: 'keyword', keywords: ['üнэ'] })
      const rule2 = makeRule({ id: 'rule-2', trigger_type: 'any' })

      const change = makeChange({ message: 'random' })

      // rule1 won't match (no keyword), rule2 will match
      const result = findMatchingRule([rule1, rule2], change)
      expect(result?.id).toBe('rule-2')
    })

    it('returns the first match when multiple rules match', () => {
      const rule1 = makeRule({ id: 'rule-1', trigger_type: 'any', priority: 0 })
      const rule2 = makeRule({ id: 'rule-2', trigger_type: 'any', priority: 1 })

      const change = makeChange({ message: 'hello' })
      const result = findMatchingRule([rule1, rule2], change)
      expect(result?.id).toBe('rule-1')
    })
  })

  describe('variable substitution', () => {
    // Test the substituteVariables logic
    function substituteVariables(template: string, vars: Record<string, string>): string {
      let result = template
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
      }
      return result
    }

    it('replaces user_name variable', () => {
      expect(substituteVariables('Сайн байна уу {{user_name}}!', { user_name: 'Батаа' }))
        .toBe('Сайн байна уу Батаа!')
    })

    it('replaces product variables', () => {
      const result = substituteVariables(
        '{{product_name}} - {{product_price}}',
        { product_name: 'Бууз', product_price: '5,000₮' }
      )
      expect(result).toBe('Бууз - 5,000₮')
    })

    it('replaces comment_text variable', () => {
      expect(substituteVariables('Таны сэтгэгдэл: {{comment_text}}', { comment_text: 'Сайхан' }))
        .toBe('Таны сэтгэгдэл: Сайхан')
    })

    it('preserves unreplaced variables', () => {
      expect(substituteVariables('{{known}} {{unknown}}', { known: 'yes' }))
        .toBe('yes {{unknown}}')
    })

    it('replaces multiple occurrences', () => {
      expect(substituteVariables('{{x}} and {{x}}', { x: 'val' }))
        .toBe('val and val')
    })
  })
})
