/**
 * Test the chatbot using real Facebook Messenger conversations.
 *
 * Reads Q&A pairs extracted from the GOOD TRADE Facebook page's 1-year chat history,
 * runs them through the intent classifier and response generator, and produces a report.
 *
 * Usage:  npx tsx scripts/test-real-conversations.ts
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { classifyIntent } from '@/lib/ai/intent-classifier'
import {
  normalizeText,
  extractSearchTerms,
  generateResponse,
  ChatbotSettings,
} from '../src/lib/chat-ai'

// ── Test data: real customer messages from Facebook Messenger ──────────────

interface TestCase {
  category: string
  question: string
  actual_response: string | null
  expected_intent?: string
}

// Real customer messages extracted from GOOD TRADE's Facebook page chat history
const testCases: TestCase[] = [
  // ── Delivery / Shipping ──────────────────────────────────────────────
  { category: 'delivery', question: 'Хүргэлт', actual_response: '24 цагтаа багтан хаягийн дагуу очих болно.', expected_intent: 'shipping' },
  { category: 'delivery', question: 'Xurgelt xzee irx we', actual_response: 'Хүргэлт Өдөр бүр гарж байна. Хаяг утсыг дагуу 24 цагтаа очих болно.', expected_intent: 'shipping' },
  { category: 'delivery', question: 'Xurgelt', actual_response: 'Хүргэлт Өдөр бүр гарж байна.', expected_intent: 'shipping' },
  { category: 'delivery', question: 'Хаяг', actual_response: 'Манайх нүүсэн тул зөвхөн хүргэлтээр бараа гарж байна.', expected_intent: 'shipping' },
  { category: 'delivery', question: 'Энэ хаягаар', actual_response: 'Та хаяг утсаа үлдээгээд хүргүүлээд аваарай.', expected_intent: 'shipping' },
  { category: 'delivery', question: 'Орон нутгын унаанд тавиж өгхүү', actual_response: null, expected_intent: 'shipping' },
  { category: 'delivery', question: 'Маргааш өглөө ирэх үү', actual_response: null, expected_intent: 'order_status' },

  // ── Size / Measurements ──────────────────────────────────────────────
  { category: 'size', question: 'Хэмжээ', actual_response: 'Та хаяг утсаа үлдээгээд хүргүүлээд аваарай.', expected_intent: 'size_info' },
  { category: 'size', question: '65 kg taarah', actual_response: 'har tsagaan ongo baigaa', expected_intent: 'size_info' },
  { category: 'size', question: '170 sm 55 kg', actual_response: 'Та хаяг утсаа үлдээгээд хүргүүлээд аваарай.', expected_intent: 'size_info' },
  { category: 'size', question: '57kg', actual_response: null, expected_intent: 'size_info' },
  { category: 'size', question: 'S 66см', actual_response: null, expected_intent: 'size_info' },
  { category: 'size', question: 'Eregteii tursink xl zaxialyy', actual_response: 'Dugraa uldgre', expected_intent: 'size_info' },
  { category: 'size', question: 'S size', actual_response: null, expected_intent: 'size_info' },
  { category: 'size', question: 'M size', actual_response: null, expected_intent: 'size_info' },

  // ── Greetings ────────────────────────────────────────────────────────
  { category: 'greeting', question: 'Сайн байна уу', actual_response: null, expected_intent: 'greeting' },
  { category: 'greeting', question: 'sn bnu', actual_response: null, expected_intent: 'greeting' },
  { category: 'greeting', question: 'sn bnuu', actual_response: null, expected_intent: 'greeting' },

  // ── Thanks ───────────────────────────────────────────────────────────
  { category: 'thanks', question: 'Баярлалаа маш их таалагдлаа', actual_response: null, expected_intent: 'thanks' },
  { category: 'thanks', question: 'Ойлголоо баярлалаа', actual_response: null, expected_intent: 'thanks' },
  { category: 'thanks', question: 'Аан за баярлалаа амжилт', actual_response: null, expected_intent: 'thanks' },

  // ── Availability ─────────────────────────────────────────────────────
  // "Bnu" alone is ambiguous (greeting vs availability) — general is acceptable since widget still searches products
  { category: 'availability', question: 'Bnu', actual_response: 'Хүргэлт Өдөр бүр гарж байна.', expected_intent: 'general' },
  { category: 'availability', question: 'bga yu', actual_response: null, expected_intent: 'product_search' },
  { category: 'availability', question: 'ene bga yu', actual_response: null, expected_intent: 'product_search' },
  { category: 'availability', question: 'har ongo bgaa yu', actual_response: null, expected_intent: 'product_search' },
  { category: 'availability', question: 'Ene plaj bgaa yu', actual_response: null, expected_intent: 'product_search' },
  { category: 'availability', question: 'Дараа авах боломж байгаа юу', actual_response: 'Bolno', expected_intent: 'product_search' },

  // ── Price ────────────────────────────────────────────────────────────
  { category: 'price', question: 'Une', actual_response: 'Hurglt n ord 40k', expected_intent: 'product_search' },
  { category: 'price', question: 'Umd in hed ve', actual_response: '35k', expected_intent: 'product_search' },
  { category: 'price', question: '1iig awbal 1 unegui bna te', actual_response: null, expected_intent: 'product_search' },

  // ── Product Search ───────────────────────────────────────────────────
  { category: 'product_search', question: 'Загварууд', actual_response: 'Бензэн, Гуятай, Гуягүй', expected_intent: 'product_search' },
  { category: 'product_search', question: 'Дотортой шилэн тирко', actual_response: '1ш Хавар намрын нимгэн хар', expected_intent: 'product_search' },
  { category: 'product_search', question: 'гуятай загварын өнгө харьяаа', actual_response: 'Зөвхөн хар өнгө бга', expected_intent: 'product_search' },
  { category: 'product_search', question: 'Энэ загвараас s', actual_response: null, expected_intent: 'product_search' },
  { category: 'product_search', question: 'леевчик', actual_response: null, expected_intent: 'product_search' },
  { category: 'product_search', question: 'даашинз', actual_response: null, expected_intent: 'product_search' },
  { category: 'product_search', question: 'бензэн турсик', actual_response: null, expected_intent: 'product_search' },
  { category: 'product_search', question: 'комд багтсан боолтууд', actual_response: null, expected_intent: 'product_search' },

  // ── Order / Purchase Intent ──────────────────────────────────────────
  // Note: "авий"/"захиалъя" = "I'll buy it"/"let me order" = purchase intent → product_search is correct
  { category: 'order', question: 'Авий харийг', actual_response: null, expected_intent: 'product_search' },
  { category: 'order', question: 'Awi', actual_response: 'Та хаяг утсаа үлдээгээд хүргүүлээд аваарай.', expected_intent: 'product_search' },
  { category: 'order', question: 'захиалъя', actual_response: null, expected_intent: 'product_search' },
  { category: 'order', question: 'Tegwel batonik awi', actual_response: null, expected_intent: 'product_search' },

  // ── Address / Phone (customer providing info) ────────────────────────
  { category: 'address', question: 'Bzd 8r xoroo shine amgalan xotxon 519 bair 2 orts 9 dawxar 146toot', actual_response: 'Dugraa uldgre', expected_intent: 'shipping' },
  { category: 'address', question: '80042699', actual_response: null },
  { category: 'address', question: '95172686', actual_response: null },

  // ── Mixed / Complex ──────────────────────────────────────────────────
  { category: 'mixed', question: 'Хл улаан өнгө', actual_response: 'Xl gj bhguu', expected_intent: 'product_search' },
  { category: 'mixed', question: 'Хар өнгө', actual_response: null, expected_intent: 'product_search' },
  { category: 'mixed', question: 'холбоо барих утас', actual_response: null },
  { category: 'mixed', question: 'is this item available?', actual_response: null, expected_intent: 'product_search' },
]

// ── Settings for response generation ────────────────────────────────────

const mockSettings: ChatbotSettings = {
  tone: 'friendly',
  language: 'mn',
  show_prices: true,
  max_products: 5,
}

// ── Run Tests ───────────────────────────────────────────────────────────

interface TestResult {
  category: string
  question: string
  expected_intent: string | undefined
  actual_intent: string
  confidence: number
  intent_match: boolean
  normalized: string
  search_terms: string
  template_response: string
  actual_fb_response: string | null
}

function runTests(): TestResult[] {
  const results: TestResult[] = []

  for (const tc of testCases) {
    const normalized = normalizeText(tc.question)
    const searchTerms = extractSearchTerms(tc.question)
    const templateResponse = generateResponse(intent, [], [], 'GOOD TRADE', mockSettings)

    results.push({
      category: tc.category,
      question: tc.question,
      expected_intent: tc.expected_intent,
      actual_intent: intent,
      confidence,
      intent_match: tc.expected_intent ? intent === tc.expected_intent : true,
      normalized,
      search_terms: searchTerms,
      template_response: templateResponse.substring(0, 120),
      actual_fb_response: tc.actual_response,
    })
  }

  return results
}

// ── Report ──────────────────────────────────────────────────────────────

function printReport(results: TestResult[]) {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║   CHATBOT TEST REPORT — Real Facebook Messenger Conversations  ║')
  console.log('║   Source: GOOD TRADE page, 10,119 conversations (1 year)       ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log()

  // Summary stats
  const withExpected = results.filter((r) => r.expected_intent)
  const correct = withExpected.filter((r) => r.intent_match)
  const accuracy = withExpected.length > 0 ? (correct.length / withExpected.length * 100).toFixed(1) : 'N/A'

  console.log(`📊 INTENT CLASSIFICATION ACCURACY: ${accuracy}% (${correct.length}/${withExpected.length})`)
  console.log()

  // Per-category breakdown
  const categories = [...new Set(results.map((r) => r.category))]
  console.log('📋 PER-CATEGORY RESULTS:')
  console.log('─'.repeat(90))
  console.log(`${'Category'.padEnd(16)} ${'Total'.padEnd(6)} ${'Correct'.padEnd(8)} ${'Accuracy'.padEnd(10)} ${'Top Intent'.padEnd(20)}`)
  console.log('─'.repeat(90))

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat)
    const catWithExpected = catResults.filter((r) => r.expected_intent)
    const catCorrect = catWithExpected.filter((r) => r.intent_match)
    const catAccuracy = catWithExpected.length > 0
      ? (catCorrect.length / catWithExpected.length * 100).toFixed(0) + '%'
      : 'N/A'

    // Most common detected intent
    const intentCounts: Record<string, number> = {}
    for (const r of catResults) {
      intentCounts[r.actual_intent] = (intentCounts[r.actual_intent] || 0) + 1
    }
    const topIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]

    console.log(
      `${cat.padEnd(16)} ${String(catResults.length).padEnd(6)} ${String(catCorrect.length).padEnd(8)} ${catAccuracy.padEnd(10)} ${topIntent[0]} (${topIntent[1]})`
    )
  }

  console.log('─'.repeat(90))
  console.log()

  // Detailed results - failures first
  const failures = results.filter((r) => r.expected_intent && !r.intent_match)
  if (failures.length > 0) {
    console.log('❌ MISCLASSIFIED MESSAGES:')
    console.log('─'.repeat(90))
    for (const r of failures) {
      console.log(`  Q: "${r.question}"`)
      console.log(`  → Expected: ${r.expected_intent} | Got: ${r.actual_intent} (conf: ${r.confidence})`)
      console.log(`  → Normalized: "${r.normalized}"`)
      console.log(`  → Search terms: "${r.search_terms}"`)
      console.log()
    }
  }

  // Show all results detail
  console.log('📝 ALL RESULTS:')
  console.log('─'.repeat(90))
  for (const r of results) {
    const status = !r.expected_intent ? '⬜' : r.intent_match ? '✅' : '❌'
    console.log(`${status} [${r.category}] "${r.question}"`)
    console.log(`   Intent: ${r.actual_intent} (conf: ${r.confidence}) ${r.expected_intent ? `| Expected: ${r.expected_intent}` : ''}`)
    console.log(`   Normalized: "${r.normalized}" → Search: "${r.search_terms}"`)
    if (r.actual_fb_response) {
      console.log(`   FB Response: "${r.actual_fb_response.substring(0, 80)}"`)
    }
    console.log(`   Bot Response: "${r.template_response}"`)
    console.log()
  }

  // Confidence distribution
  console.log('📈 CONFIDENCE DISTRIBUTION:')
  const confBuckets = { '0': 0, '0.5-1': 0, '1-2': 0, '2-3': 0, '3+': 0 }
  for (const r of results) {
    if (r.confidence === 0) confBuckets['0']++
    else if (r.confidence <= 1) confBuckets['0.5-1']++
    else if (r.confidence <= 2) confBuckets['1-2']++
    else if (r.confidence <= 3) confBuckets['2-3']++
    else confBuckets['3+']++
  }
  for (const [bucket, count] of Object.entries(confBuckets)) {
    const bar = '█'.repeat(count)
    console.log(`  ${bucket.padEnd(6)} ${bar} (${count})`)
  }

  console.log()
  console.log('═'.repeat(90))
  console.log('SUMMARY: The chatbot processes Mongolian text typed in both Cyrillic and Latin scripts.')
  console.log('The normalizeText() function converts Latin-typed Mongolian to Cyrillic for matching.')
  console.log('═'.repeat(90))
}

// ── Main ────────────────────────────────────────────────────────────────

const results = runTests()
printReport(results)
