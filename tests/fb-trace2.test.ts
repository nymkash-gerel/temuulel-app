import { it } from 'vitest'
import { normalizeText, neutralizeVowels } from '../src/lib/text-normalizer'
import { stemText, stemKeyword } from '../src/lib/mn-stemmer'

// Import the internal keyword map by re-reading intent-classifier
// Use a modified scoring to trace which complaint keywords hit
const { classifyIntentWithConfidence } = await import('../src/lib/intent-classifier')

function prefixMatchWord(normalizedMsg: string, keyword: string): string | null {
  const MIN_PREFIX_LEN = 4
  if (keyword.length < MIN_PREFIX_LEN) return null
  const words = normalizedMsg.split(' ')
  return words.find((w) => w.startsWith(keyword) || keyword.startsWith(w) && w.length >= MIN_PREFIX_LEN) ?? null
}

it('trace scoring for specific messages', () => {
  // Test both messages together with the actual classifier
  const tests = [
    'Цагаан нь байгаа юмуу?',
    'Тийм ээ.болох уу',
    'Трусиктэй байж болох уу Хүүхдэд өмсүүлэх юм аа',
    'Endees zahialiy',
    '72 цаг боллоо',
    'Өнөөдөр 3 цагаас өмнө байж болохгүй юу',
    'Onoodor unaand tawiuliy.',
  ]
  
  for (const msg of tests) {
    const result = classifyIntentWithConfidence(msg)
    console.log(`[${result.intent}:${result.confidence}] "${msg}"`)
    console.log(`  norm: "${normalizeText(msg)}"`)
    console.log(`  stemmed: "${stemText(normalizeText(msg))}"`)
  }
})
