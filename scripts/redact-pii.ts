/**
 * redact-pii.ts — Remove personally identifiable information from dataset texts.
 *
 * Redacts: phone numbers, addresses, names, emails, card numbers, order codes.
 * Preserves: intent-bearing words, product names, general queries.
 *
 * Run: npx tsx scripts/redact-pii.ts
 * Input: ~/Desktop/research/MongolIntent-Ecom/all.jsonl
 * Output: ~/Desktop/research/MongolIntent-Ecom/all_redacted.jsonl + train/test splits
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const DATASET_DIR = join(process.env.HOME!, 'Desktop/research/MongolIntent-Ecom')

// ── Phone number patterns ────────────────────────────────────────────────
// Mongolian phones: 8 digits starting with 8/9, or with country code +976
const PHONE_PATTERNS = [
  /\+?976[\s-]?\d{4}[\s-]?\d{4}/g,       // +976 9911 2233
  /(?<!\d)\d{4}[\s-]\d{4}(?!\d)/g,        // 9911 2233
  /(?<!\d)[89]\d{7}(?!\d)/g,              // 99112233
  /(?<!\d)\d{2}[\s-]\d{2}[\s-]\d{2}[\s-]\d{2}(?!\d)/g, // 99 11 22 33
]

// ── Email pattern ────────────────────────────────────────────────────────
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// ── Address keywords (if message contains these + numbers, likely address)
const ADDRESS_KEYWORDS = [
  'дүүрэг', 'хороо', 'байр', 'тоот', 'гудамж', 'хороолол',
  'баянгол', 'сүхбаатар', 'чингэлтэй', 'хан-уул', 'баянзүрх',
  'сонгинохайрхан', 'налайх', 'орон сууц', 'гэр хороолол',
  'bzd', 'bbd', 'sbd', 'chd', 'sgd', 'hhd',
  'horoo', 'khoroo', 'bair', 'toot', 'duureg',
  'байрны', 'давхар', 'тоотод', 'хорооны',
]

// ── Name patterns (Mongolian first names are hard to detect, so we redact
//    messages that look like standalone names: 2-15 chars, Cyrillic, no keywords)
const MONGOLIAN_NAME_PATTERN = /^[А-ЯӨҮЁа-яөүё]{2,15}$/

// ── Order/gift card codes ────────────────────────────────────────────────
const CODE_PATTERNS = [
  /ORD-\d+/gi,
  /DEL-\d+/gi,
  /GC-[A-Z0-9]+/gi,
  /INV-[A-Z0-9]+/gi,
]

// ── Card/account numbers ─────────────────────────────────────────────────
const CARD_PATTERN = /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g
const ACCOUNT_PATTERN = /\d{10,16}/g

/**
 * Redact PII from a single text message.
 * Returns redacted text and list of what was redacted.
 */
function redactPII(text: string): { redacted: string; piiTypes: string[] } {
  let result = text
  const piiTypes: string[] = []

  // 1. Emails
  if (EMAIL_PATTERN.test(result)) {
    result = result.replace(EMAIL_PATTERN, '[EMAIL]')
    piiTypes.push('email')
  }

  // 2. Card/account numbers (before phone, since they're longer)
  if (CARD_PATTERN.test(result)) {
    result = result.replace(CARD_PATTERN, '[CARD]')
    piiTypes.push('card')
  }

  // 3. Phone numbers
  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(result)) {
      pattern.lastIndex = 0
      result = result.replace(pattern, '[PHONE]')
      piiTypes.push('phone')
    }
  }

  // 4. Order/gift card codes
  for (const pattern of CODE_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(result)) {
      pattern.lastIndex = 0
      result = result.replace(pattern, '[CODE]')
      piiTypes.push('code')
    }
  }

  // 5. Long account numbers (10-16 digits standalone)
  if (/(?<!\d)\d{10,16}(?!\d)/.test(result)) {
    result = result.replace(/(?<!\d)\d{10,16}(?!\d)/g, '[ACCOUNT]')
    piiTypes.push('account')
  }

  // 6. Address detection (message with address keywords + substantial text)
  const lower = result.toLowerCase()
  const hasAddressKeyword = ADDRESS_KEYWORDS.some(kw => lower.includes(kw))
  if (hasAddressKeyword && result.length > 15) {
    // Keep the intent-bearing part but redact specific location details
    // Replace number+байр/тоот patterns
    result = result.replace(/\d+[\s-]?(?:р|-)?\s*(?:байр|тоот|давхар|өрөө)/gi, '[ADDR_NUM]')
    result = result.replace(/\d+[\s-]?(?:хороо|хороолол)/gi, '[ADDR_DISTRICT]')
    if (result !== text) piiTypes.push('address')
  }

  // 7. Standalone name detection (single Cyrillic word, 2-15 chars, looks like a name)
  // Only if the message is JUST a name (during order collection "name" step)
  if (MONGOLIAN_NAME_PATTERN.test(result.trim()) && !hasIntentWords(result)) {
    result = '[NAME]'
    piiTypes.push('name')
  }

  return { redacted: result, piiTypes }
}

/** Check if text contains intent-bearing words (not just a name). */
function hasIntentWords(text: string): boolean {
  const intentWords = [
    'бараа', 'байна', 'захиал', 'авмаар', 'хайх', 'үнэ', 'хэд',
    'сайн', 'баярл', 'гомдол', 'буцаа', 'хүрг', 'төлб', 'хэмж',
    'уу', 'юу', 'вэ', 'бну', 'bnu', 'bga',
  ]
  const lower = text.toLowerCase()
  return intentWords.some(w => lower.includes(w))
}

// ── Main ─────────────────────────────────────────────────────────────────

interface DatasetEntry {
  text: string
  intent: string
  confidence: number
  source: string
  morphological_features: Record<string, boolean>
}

function main() {
  const inputPath = join(DATASET_DIR, 'all.jsonl')
  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`)
    process.exit(1)
  }

  const lines = readFileSync(inputPath, 'utf-8').trim().split('\n')
  const entries: DatasetEntry[] = lines.map(l => JSON.parse(l))

  console.log(`Input: ${entries.length} entries`)

  let redactedCount = 0
  let phoneCount = 0
  let addressCount = 0
  let nameCount = 0
  let emailCount = 0
  const piiDistribution: Record<string, number> = {}

  const redactedEntries = entries.map(entry => {
    const { redacted, piiTypes } = redactPII(entry.text)
    if (piiTypes.length > 0) {
      redactedCount++
      for (const t of piiTypes) {
        piiDistribution[t] = (piiDistribution[t] || 0) + 1
        if (t === 'phone') phoneCount++
        if (t === 'address') addressCount++
        if (t === 'name') nameCount++
        if (t === 'email') emailCount++
      }
    }
    return { ...entry, text: redacted }
  })

  // Filter out entries that are now just placeholders
  const filtered = redactedEntries.filter(e => {
    const t = e.text.trim()
    // Remove entries that are ONLY placeholders
    if (t === '[PHONE]' || t === '[NAME]' || t === '[EMAIL]' || t === '[CARD]' || t === '[ACCOUNT]') return false
    // Remove very short entries after redaction
    if (t.length < 3) return false
    return true
  })

  console.log(`\nRedaction stats:`)
  console.log(`  Entries with PII: ${redactedCount}`)
  console.log(`  Phones: ${phoneCount}`)
  console.log(`  Addresses: ${addressCount}`)
  console.log(`  Names: ${nameCount}`)
  console.log(`  Emails: ${emailCount}`)
  console.log(`  PII distribution:`, piiDistribution)
  console.log(`  Filtered (removed): ${redactedEntries.length - filtered.length}`)
  console.log(`  Final count: ${filtered.length}`)

  // Save redacted dataset
  writeFileSync(
    join(DATASET_DIR, 'all_redacted.jsonl'),
    filtered.map(e => JSON.stringify(e)).join('\n') + '\n'
  )

  // Train/test split (80/20)
  const shuffled = filtered.sort(() => 0.5 - Math.random())
  const splitIdx = Math.floor(shuffled.length * 0.8)
  const train = shuffled.slice(0, splitIdx)
  const test = shuffled.slice(splitIdx)

  writeFileSync(
    join(DATASET_DIR, 'train_redacted.jsonl'),
    train.map(e => JSON.stringify(e)).join('\n') + '\n'
  )
  writeFileSync(
    join(DATASET_DIR, 'test_redacted.jsonl'),
    test.map(e => JSON.stringify(e)).join('\n') + '\n'
  )

  console.log(`\nSaved:`)
  console.log(`  all_redacted.jsonl: ${filtered.length}`)
  console.log(`  train_redacted.jsonl: ${train.length}`)
  console.log(`  test_redacted.jsonl: ${test.length}`)
}

main()
