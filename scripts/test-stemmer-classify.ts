/**
 * Smoke test: verify stemmer improves classification of inflected forms
 * that are NOT explicitly listed as keywords.
 * Run: npx tsx scripts/test-stemmer-classify.ts
 */
import { classifyIntentWithConfidence } from '../src/lib/chat-ai'

interface TestCase {
  message: string
  expectedIntent: string
  note: string
}

const tests: TestCase[] = [
  // Forms NOT in keyword list — should now classify via stem match
  { message: 'захиалгыг шалгаж өгнө үү', expectedIntent: 'order_status', note: 'захиалгыг (accusative) not in list' },
  { message: 'буцааж болох уу', expectedIntent: 'return_exchange', note: 'буцааж (converb) — should match буцаах' },
  { message: 'хүргэлтийн хугацаа хэд вэ', expectedIntent: 'shipping', note: 'хүргэлтийн — not in list as-is' },
  { message: 'картаар төлж болох уу', expectedIntent: 'payment', note: 'картаар (instrumental) not in list' },
  { message: 'размерийн хүснэгт байна уу', expectedIntent: 'size_info', note: 'размерийн (genitive) stem match' },
  { message: 'захиалгатай холбоотой асуудал', expectedIntent: 'complaint', note: 'захиалгатай (comitative)' },
  { message: 'загварууд харуулна уу', expectedIntent: 'product_search', note: 'загварууд (plural) already in list' },
  { message: 'данс руу шилжүүлэх', expectedIntent: 'payment', note: 'дансруу/данс руу' },
  // Already-working exact matches (regression check)
  { message: 'захиалга хаана байна', expectedIntent: 'order_status', note: 'exact match — should still work' },
  { message: 'буцаах боломж байна уу', expectedIntent: 'return_exchange', note: 'exact match' },
  { message: 'хүргэлт хэдэн хоног', expectedIntent: 'shipping', note: 'exact match' },
  { message: 'сайн байна уу', expectedIntent: 'greeting', note: 'exact match' },
  { message: 'гомдол байна', expectedIntent: 'complaint', note: 'exact match' },
]

let pass = 0
let fail = 0

console.log('Intent classification smoke test (stemmer integration)\n')
console.log('Message'.padEnd(40) + 'Got'.padEnd(20) + 'Want'.padEnd(20) + 'Score  Note')
console.log('─'.repeat(110))

for (const { message, expectedIntent, note } of tests) {
  const { intent, confidence } = classifyIntentWithConfidence(message)
  const ok = intent === expectedIntent
  if (ok) pass++; else fail++
  const status = ok ? '✅' : '❌'
  const msgShort = message.length > 37 ? message.slice(0, 37) + '…' : message
  console.log(
    status + ' ' + msgShort.padEnd(39) +
    intent.padEnd(20) +
    expectedIntent.padEnd(20) +
    String(confidence.toFixed(1)).padEnd(7) +
    note
  )
}

console.log('─'.repeat(110))
console.log(`\nResult: ${pass}/${tests.length} passed${fail > 0 ? ` (${fail} failed)` : ' ✅'}`)
process.exit(fail > 0 ? 1 : 0)
