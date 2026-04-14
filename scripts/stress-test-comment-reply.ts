#!/usr/bin/env npx tsx
/**
 * REAL-WORLD STRESS TEST for Comment Auto-Reply
 * Uses 12,647 real FB comments from a Mongolian e-commerce page.
 *
 * Tests:
 * 1. Rule matching accuracy (keyword, any, contains_question)
 * 2. Intent detection on real customer comments
 * 3. Performance (processing time per comment)
 * 4. Edge cases (empty, emoji-only, mixed language)
 *
 * Usage: npx tsx scripts/stress-test-comment-reply.ts
 */

import { readFileSync } from 'node:fs'

// Replicate the matching logic from comment-auto-reply.ts
interface FakeRule {
  id: string
  trigger_type: 'keyword' | 'any' | 'contains_question' | 'first_comment'
  keywords: string[] | null
  match_mode: 'any' | 'all'
}

function findMatchingRule(rules: FakeRule[], commentText: string): FakeRule | null {
  const text = commentText.toLowerCase()
  for (const rule of rules) {
    let matches = false
    switch (rule.trigger_type) {
      case 'any':
        matches = true
        break
      case 'keyword':
        if (rule.keywords && rule.keywords.length > 0) {
          const kws = rule.keywords.map(k => k.toLowerCase().trim())
          matches = rule.match_mode === 'all'
            ? kws.every(kw => text.includes(kw))
            : kws.some(kw => text.includes(kw))
        }
        break
      case 'contains_question':
        matches = /\?|юу|хэзээ|хаана|яаж|хэд|хэн|ямар|яагаад|хэдий|үнэ|хэчнээн|болох уу|bolhuu|hed|yaaj/i.test(text)
        break
      case 'first_comment':
        matches = true
        break
    }
    if (matches) return rule
  }
  return null
}

// ── Load real FB comments ────────────────────────────────────────────────────

const FB_COMMENTS_PATH = "/Users/nyamgerelshijir/Downloads/this_profile's_activity_across_facebook/comments_and_reactions/comments.json"

interface FBCommentEntry {
  data?: { comment?: { comment?: string; author?: string } }[]
  timestamp?: number
  title?: string
}
interface FBData { comments_v2: FBCommentEntry[] }

function fixEncoding(s: string): string {
  try { return Buffer.from(s, 'latin1').toString('utf-8') } catch { return s }
}

const raw = JSON.parse(readFileSync(FB_COMMENTS_PATH, 'utf-8')) as FBData
const comments: { text: string; title: string }[] = []
for (const entry of raw.comments_v2) {
  if (!entry.data?.[0]?.comment?.comment) continue
  comments.push({
    text: fixEncoding(entry.data[0].comment.comment),
    title: entry.title || '',
  })
}

console.log(`\n📊 Loaded ${comments.length} real FB comments from GOOD TRADE\n`)

// ── Realistic rules for a store ──────────────────────────────────────────────

// Enhanced rules based on real comment patterns observed
const rules: FakeRule[] = [
  { id: 'price', trigger_type: 'keyword', keywords: ['үнэ', 'une', 'hed', 'хэд', 'хичнээн', 'hichneen', 'price'], match_mode: 'any' },
  { id: 'order', trigger_type: 'keyword', keywords: ['захиалга', 'zahialga', 'order', 'авмаар', 'avmaar', 'авъя', 'avya', 'захиалъя'], match_mode: 'any' },
  { id: 'phone_request', trigger_type: 'keyword', keywords: ['утас', 'utas', 'дугаар', 'dugaar', 'phone', 'уулдээн'], match_mode: 'any' },
  { id: 'delivery', trigger_type: 'keyword', keywords: ['хүргэлт', 'hurgelt', 'hurgeh', 'delivery'], match_mode: 'any' },
  { id: 'greeting', trigger_type: 'keyword', keywords: ['сайн байна', 'sain baina', 'sain bn', 'hi', 'hello', 'сайн бн'], match_mode: 'any' },
  { id: 'available', trigger_type: 'keyword', keywords: ['байгаа', 'baigaa', 'байна уу', 'baina uu', 'bnuu', 'bga', 'бэлэн', 'belen'], match_mode: 'any' },
  { id: 'question', trigger_type: 'contains_question', keywords: null, match_mode: 'any' },
]

// ── Run stress test ──────────────────────────────────────────────────────────

const stats = {
  total: 0,
  matched: 0,
  byRule: {} as Record<string, number>,
  byLength: { short: 0, medium: 0, long: 0 },
  byScript: { cyrillic: 0, latin: 0, mixed: 0, emoji_only: 0 },
  unmatched: 0,
  emptyOrSkip: 0,
  sampleMatched: [] as { text: string; rule: string }[],
  sampleUnmatched: [] as string[],
}

const start = Date.now()
const SAMPLE_SIZE = Math.min(comments.length, 5000) // limit to 5000 for speed

for (let i = 0; i < SAMPLE_SIZE; i++) {
  const c = comments[i]
  if (!c.text || c.text.length < 2) { stats.emptyOrSkip++; continue }
  stats.total++

  // Length bucket
  if (c.text.length < 30) stats.byLength.short++
  else if (c.text.length < 150) stats.byLength.medium++
  else stats.byLength.long++

  // Script detection
  const hasCyrillic = /[\u0400-\u04FF]/.test(c.text)
  const hasLatin = /[a-zA-Z]/.test(c.text)
  const textNoEmoji = c.text.replace(/[\p{Emoji}\s]/gu, '')
  if (textNoEmoji.length < 2) stats.byScript.emoji_only++
  else if (hasCyrillic && hasLatin) stats.byScript.mixed++
  else if (hasCyrillic) stats.byScript.cyrillic++
  else stats.byScript.latin++

  // Try matching (exclude catch-all 'any' rule to see real match rate)
  const specificRules = rules.filter(r => r.trigger_type !== 'any')
  const match = findMatchingRule(specificRules, c.text)

  if (match) {
    stats.matched++
    stats.byRule[match.id] = (stats.byRule[match.id] || 0) + 1
    if (stats.sampleMatched.length < 5) {
      stats.sampleMatched.push({ text: c.text.substring(0, 100), rule: match.id })
    }
  } else {
    stats.unmatched++
    if (stats.sampleUnmatched.length < 5) {
      stats.sampleUnmatched.push(c.text.substring(0, 100))
    }
  }
}

const elapsed = Date.now() - start

// ── Report ───────────────────────────────────────────────────────────────────

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  COMMENT AUTO-REPLY STRESS TEST — REAL FB DATA')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log(`🚀 Performance: ${elapsed}ms for ${stats.total} comments`)
console.log(`   → ${(stats.total / (elapsed / 1000)).toFixed(0)} comments/sec\n`)

console.log(`📈 Match rate: ${stats.matched}/${stats.total} (${((stats.matched / stats.total) * 100).toFixed(1)}%)`)
console.log(`   Unmatched: ${stats.unmatched}`)
console.log(`   Empty/skip: ${stats.emptyOrSkip}\n`)

console.log('📏 Length distribution:')
console.log(`   Short (<30): ${stats.byLength.short}`)
console.log(`   Medium (30-150): ${stats.byLength.medium}`)
console.log(`   Long (>150): ${stats.byLength.long}\n`)

console.log('🔤 Script distribution:')
console.log(`   Cyrillic: ${stats.byScript.cyrillic}`)
console.log(`   Latin: ${stats.byScript.latin}`)
console.log(`   Mixed: ${stats.byScript.mixed}`)
console.log(`   Emoji-only: ${stats.byScript.emoji_only}\n`)

console.log('📋 By rule:')
for (const [rid, count] of Object.entries(stats.byRule).sort((a, b) => b[1] - a[1])) {
  const rule = rules.find(r => r.id === rid)
  console.log(`   ${rid} [${rule?.trigger_type}]: ${count}`)
}

console.log('\n✅ Sample MATCHED:')
for (const m of stats.sampleMatched) {
  console.log(`   [${m.rule}] "${m.text}"`)
}

console.log('\n❌ Sample UNMATCHED (no keyword/question):')
for (const u of stats.sampleUnmatched) {
  console.log(`   "${u}"`)
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// Exit code based on key metrics
const matchRate = (stats.matched / stats.total) * 100
if (matchRate < 20) {
  console.log(`\n⚠️  Match rate ${matchRate.toFixed(1)}% seems low — consider more rule keywords`)
  process.exit(1)
} else {
  console.log(`\n🏆 Match rate ${matchRate.toFixed(1)}% — realistic for this store's keyword rules`)
  process.exit(0)
}
