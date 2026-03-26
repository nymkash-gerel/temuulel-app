/**
 * build-dataset.ts — Build MongolIntent-Ecom dataset from Facebook chat history
 *
 * Reads 2+ years of real customer messages from Facebook export,
 * auto-labels with the hybrid intent classifier, filters quality,
 * and outputs train/test JSONL files.
 *
 * Run: npx tsx scripts/build-dataset.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { hybridClassify } from '../src/lib/ai/hybrid-classifier'
import { normalizeText } from '../src/lib/text-normalizer'
import { extractMorphFeatures } from '../src/lib/morphological-features'

interface RawMessage {
  sender_name: string
  timestamp_ms: number
  content?: string
  photos?: unknown[]
}

interface ConversationFile {
  participants: Array<{ name: string }>
  messages: RawMessage[]
}

interface DatasetEntry {
  text: string
  intent: string
  confidence: number
  source: 'real_customer'
  morphological_features: {
    hasNegative: boolean
    hasDesiderative: boolean
    hasPastQuestion: boolean
    hasProgressive: boolean
  }
}

const STORE_NAME = 'GOOD TRADE'
const FB_EXPORT_BASE = join(
  process.env.HOME!,
  "Downloads/fb-export/this_profile's_activity_across_facebook/messages"
)
const OUTPUT_DIR = join(process.env.HOME!, 'Desktop/research/MongolIntent-Ecom')

// Messages to skip (not useful for intent classification)
const SKIP_PATTERNS = [
  /^\d{8,}$/,           // Phone numbers only
  /^[.\s]*$/,           // Empty/dots
  /^get started$/i,     // Bot trigger
  /^👍|❤️|😊|🙏|💯/,   // Emoji-only reactions
  /^https?:\/\//,       // URLs only
  /^\d{1,2}[xх][lл]$/i, // Size only (2xl, etc.) — too short for intent
]

function decodeFbMojibake(text: string): string {
  try {
    return Buffer.from(text, 'latin1').toString('utf-8')
  } catch {
    return text
  }
}

function isValidMessage(text: string): boolean {
  if (text.length < 3 || text.length > 300) return false
  if (SKIP_PATTERNS.some(p => p.test(text))) return false
  // Must have at least 2 word characters (not just numbers/symbols)
  const wordChars = text.replace(/[\d\s.,!?:;()]/g, '')
  return wordChars.length >= 2
}

function collectMessages(): Array<{ text: string; timestamp: number }> {
  const messages: Array<{ text: string; timestamp: number }> = []
  const dirs = ['inbox', 'filtered_threads']

  for (const dir of dirs) {
    const fullDir = join(FB_EXPORT_BASE, dir)
    if (!existsSync(fullDir)) continue

    for (const thread of readdirSync(fullDir)) {
      // Read all message_*.json files in thread
      const threadDir = join(fullDir, thread)
      const files = readdirSync(threadDir).filter(f => f.startsWith('message_') && f.endsWith('.json'))

      for (const file of files) {
        try {
          const data: ConversationFile = JSON.parse(readFileSync(join(threadDir, file), 'utf-8'))

          for (const msg of data.messages) {
            if (msg.sender_name === STORE_NAME) continue // Skip store replies
            if (!msg.content) continue // Skip photo/sticker-only

            const decoded = decodeFbMojibake(msg.content)
            if (isValidMessage(decoded)) {
              messages.push({ text: decoded, timestamp: msg.timestamp_ms })
            }
          }
        } catch {
          // Skip malformed files
        }
      }
    }
  }

  return messages
}

function classifyAndBuild(messages: Array<{ text: string; timestamp: number }>): DatasetEntry[] {
  const entries: DatasetEntry[] = []
  const seen = new Set<string>()

  for (const msg of messages) {
    // Deduplicate by normalized text
    const key = normalizeText(msg.text)
    if (seen.has(key)) continue
    seen.add(key)

    // Classify intent
    const result = hybridClassify(msg.text)

    // Extract morph features
    const features = extractMorphFeatures(normalizeText(msg.text))

    entries.push({
      text: msg.text,
      intent: result.intent,
      confidence: result.confidence,
      source: 'real_customer',
      morphological_features: {
        hasNegative: features.hasNegative,
        hasDesiderative: features.hasDesiderative,
        hasPastQuestion: features.hasPastQuestion,
        hasProgressive: features.hasProgressive,
      },
    })
  }

  return entries
}

function trainTestSplit(entries: DatasetEntry[], testRatio = 0.2) {
  // Stratified split by intent
  const byIntent: Record<string, DatasetEntry[]> = {}
  for (const e of entries) {
    if (!byIntent[e.intent]) byIntent[e.intent] = []
    byIntent[e.intent].push(e)
  }

  const train: DatasetEntry[] = []
  const test: DatasetEntry[] = []

  for (const [intent, items] of Object.entries(byIntent)) {
    // Shuffle
    const shuffled = items.sort(() => Math.random() - 0.5)
    const splitIdx = Math.floor(shuffled.length * (1 - testRatio))
    train.push(...shuffled.slice(0, splitIdx))
    test.push(...shuffled.slice(splitIdx))
  }

  return { train, test }
}

// Main
console.log('Collecting messages from Facebook export...')
const messages = collectMessages()
console.log(`Found ${messages.length} valid customer messages`)

console.log('\nClassifying intents...')
const entries = classifyAndBuild(messages)
console.log(`Deduplicated to ${entries.length} unique messages`)

// Stats
const intentCounts: Record<string, number> = {}
const confBuckets = { high: 0, medium: 0, low: 0 }
for (const e of entries) {
  intentCounts[e.intent] = (intentCounts[e.intent] || 0) + 1
  if (e.confidence >= 2.0) confBuckets.high++
  else if (e.confidence >= 1.0) confBuckets.medium++
  else confBuckets.low++
}

console.log('\nIntent distribution:')
for (const [intent, count] of Object.entries(intentCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${intent}: ${count}`)
}

console.log('\nConfidence distribution:')
console.log(`  High (>=2.0): ${confBuckets.high}`)
console.log(`  Medium (1.0-2.0): ${confBuckets.medium}`)
console.log(`  Low (<1.0): ${confBuckets.low}`)

// Filter to high + medium confidence for dataset quality
const qualityEntries = entries.filter(e => e.confidence >= 0.5)
console.log(`\nQuality entries (conf >= 0.5): ${qualityEntries.length}`)

// Split
const { train, test } = trainTestSplit(qualityEntries)

// Save
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

writeFileSync(
  join(OUTPUT_DIR, 'train.jsonl'),
  train.map(e => JSON.stringify(e)).join('\n') + '\n'
)
writeFileSync(
  join(OUTPUT_DIR, 'test.jsonl'),
  test.map(e => JSON.stringify(e)).join('\n') + '\n'
)
writeFileSync(
  join(OUTPUT_DIR, 'all.jsonl'),
  entries.map(e => JSON.stringify(e)).join('\n') + '\n'
)

// Dataset card
writeFileSync(join(OUTPUT_DIR, 'README.md'), `# MongolIntent-Ecom

First Mongolian ecommerce intent classification benchmark dataset.

## Stats
- **Total unique messages**: ${entries.length}
- **Quality filtered (conf >= 0.5)**: ${qualityEntries.length}
- **Train**: ${train.length}
- **Test**: ${test.length}
- **Intents**: ${Object.keys(intentCounts).length}
- **Source**: 2+ years of real Facebook Messenger conversations (Good Trade Mongolia)
- **Language**: Mongolian (Cyrillic + Latin transliteration)

## Intent Distribution
${Object.entries(intentCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

## Format
JSONL with fields: text, intent, confidence, source, morphological_features

## Morphological Features
Each entry includes extracted morphological features:
- hasNegative: -гүй/-хгүй suffix detected
- hasDesiderative: -маар/-мээр suffix detected
- hasPastQuestion: -сан уу pattern detected
- hasProgressive: -ж байна pattern detected

## License
For research purposes only. Contains anonymized customer messages.

## Citation
If using this dataset, please cite:
\`\`\`
@dataset{mongolintent-ecom-2026,
  title={MongolIntent-Ecom: First Mongolian Ecommerce Intent Classification Dataset},
  year={2026},
  source={Good Trade Mongolia Facebook Messenger conversations}
}
\`\`\`
`)

console.log(`\nDataset saved to ${OUTPUT_DIR}/`)
console.log(`  train.jsonl: ${train.length} examples`)
console.log(`  test.jsonl: ${test.length} examples`)
console.log(`  all.jsonl: ${entries.length} examples (unfiltered)`)
console.log(`  README.md: dataset card`)
