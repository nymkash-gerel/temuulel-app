import { classifyIntentWithConfidence } from '../src/lib/chat-ai'
const tests: [string, string][] = [
  ['Бэлгийн карт авмаар байна', 'gift_card_purchase'],
  ['gift card авах хүсэлтэй байна', 'gift_card_purchase'],
  ['бэлэглэхэд ямар карт байна вэ', 'gift_card_purchase'],
  ['GIFT-AB12-CD34 код байна', 'gift_card_redeem'],
  ['бэлгийн картын үлдэгдэл хэд байна', 'gift_card_redeem'],
  ['gift code ашиглах гэж байна', 'gift_card_redeem'],
]
let pass = 0
for (const [msg, want] of tests) {
  const { intent, confidence } = classifyIntentWithConfidence(msg)
  const ok = intent === want
  if (ok) pass++
  console.log((ok ? 'OK' : 'XX') + ' | ' + msg + ' -> ' + intent + ' (want: ' + want + ', score: ' + confidence.toFixed(1) + ')')
}
console.log('\n' + pass + '/' + tests.length + ' passed')
process.exit(pass === tests.length ? 0 : 1)
