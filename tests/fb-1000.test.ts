/**
 * Real Facebook chat data test — 1000 sampled customer messages
 * Flags suspicious/wrong classifications for manual review
 */
import { readFileSync } from 'fs'
import { it, expect } from 'vitest'
import { classifyIntentWithConfidence } from '../src/lib/intent-classifier'
import { normalizeText } from '../src/lib/text-normalizer'

const messages: string[] = JSON.parse(
  readFileSync('/tmp/fb_1000_messages.json', 'utf-8')
)

// Known false-positive patterns: (regex on normalized message, wrongly-expected intent)
const FALSE_POSITIVE_PATTERNS: Array<{ pattern: RegExp; wrongIntent: string; note: string }> = [
  // 'юмуу' should not trigger complaint via 'муу' substring
  { pattern: /юмуу/, wrongIntent: 'complaint', note: '"юмуу" question particle contains "муу"' },
  // Short availability questions should not be complaint
  { pattern: /^(байгаа|бга|бгаа|бий)\s*(юу|уу|үү)?$/i, wrongIntent: 'complaint', note: 'Short availability question' },
  // Color/size questions should not be complaint or return_exchange
  { pattern: /^(цагаан|хар|улаан|ногоон|шар|цэнхэр|ягаан)\s*(нь|юу|уу|байна|байгаа)/i, wrongIntent: 'complaint', note: 'Color availability question' },
  { pattern: /^(цагаан|хар|улаан|ногоон|шар|цэнхэр|ягаан)\s*(нь|юу|уу|байна|байгаа)/i, wrongIntent: 'return_exchange', note: 'Color availability question' },
]

it('classify 1000 real FB messages — report suspicious results', () => {
  const intentCounts: Record<string, number> = {}
  const suspicious: Array<{ msg: string; intent: string; confidence: number; note: string }> = []
  const lowConfidence: Array<{ msg: string; intent: string; confidence: number }> = []
  const tableReservation: string[] = []
  const menuAvailability: string[] = []
  const allergenInfo: string[] = []

  for (const msg of messages) {
    const { intent, confidence } = classifyIntentWithConfidence(msg)
    intentCounts[intent] = (intentCounts[intent] || 0) + 1

    // Collect restaurant intent false positives (this is an e-commerce store)
    if (intent === 'table_reservation') tableReservation.push(`[${confidence.toFixed(1)}] ${msg}`)
    if (intent === 'menu_availability') menuAvailability.push(`[${confidence.toFixed(1)}] ${msg}`)
    if (intent === 'allergen_info') allergenInfo.push(`[${confidence.toFixed(1)}] ${msg}`)

    // Flag known false-positive patterns
    const norm = normalizeText(msg)
    for (const { pattern, wrongIntent, note } of FALSE_POSITIVE_PATTERNS) {
      if (intent === wrongIntent && (pattern.test(msg) || pattern.test(norm))) {
        suspicious.push({ msg, intent, confidence, note })
      }
    }

    // Collect complaint classifications for review (complaint is often a false positive)
    if (intent === 'complaint' && confidence < 2.0) {
      suspicious.push({ msg, intent, confidence, note: 'Low-confidence complaint — possible false positive' })
    }

    // Flag return_exchange with no obvious return/size word
    // Note: "Аймар том байна" = "it's way too big" — this IS a valid return_exchange (size issue)
    if (intent === 'return_exchange' && confidence <= 1.0) {
      const hasReturnOrSizeWord = /буцаа|солиул|солих|return|exchange|refund|butsaa|solih|тохирохгүй|том|жижиг|hemjee|хэмжээ/i.test(msg)
      if (!hasReturnOrSizeWord) {
        suspicious.push({ msg, intent, confidence, note: 'return_exchange with no return/size keyword' })
      }
    }
  }

  // Print summary
  console.log('\n=== Intent Distribution (1000 messages) ===')
  const sorted = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])
  for (const [intent, count] of sorted) {
    const pct = ((count / messages.length) * 100).toFixed(1)
    console.log(`  ${intent.padEnd(22)} ${String(count).padStart(4)} (${pct}%)`)
  }

  if (tableReservation.length > 0) {
    console.log(`\n=== table_reservation (${tableReservation.length}) — e-commerce store, likely false positives ===`)
    tableReservation.slice(0, 15).forEach(m => console.log('  ', m))
  }

  if (menuAvailability.length > 0) {
    console.log(`\n=== menu_availability (${menuAvailability.length}) — possible false positives ===`)
    menuAvailability.slice(0, 15).forEach(m => console.log('  ', m))
  }

  if (allergenInfo.length > 0) {
    console.log(`\n=== allergen_info (${allergenInfo.length}) — possible false positives ===`)
    allergenInfo.slice(0, 10).forEach(m => console.log('  ', m))
  }

  if (suspicious.length > 0) {
    console.log(`\n=== Suspicious classifications (${suspicious.length}) ===`)
    // Group by note
    const byNote: Record<string, typeof suspicious> = {}
    for (const s of suspicious) {
      byNote[s.note] = byNote[s.note] || []
      byNote[s.note].push(s)
    }
    for (const [note, items] of Object.entries(byNote)) {
      console.log(`\n  [${note}] (${items.length} cases):`)
      items.slice(0, 8).forEach(s =>
        console.log(`    [${s.intent}:${s.confidence.toFixed(1)}] "${s.msg}"`)
      )
    }
  }

  // Assertions: restaurant intents should be rare for an e-commerce store
  expect(tableReservation.length).toBeLessThan(20)
  expect(menuAvailability.length).toBeLessThan(20)
  expect(allergenInfo.length).toBeLessThan(10)
  // Known false positives should be zero
  const knownFP = suspicious.filter(s => s.note !== 'Low-confidence complaint — possible false positive' && s.note !== 'return_exchange with no return keyword')
  expect(knownFP.length).toBe(0)
})

