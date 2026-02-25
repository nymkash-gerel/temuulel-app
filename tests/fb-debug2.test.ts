import { it } from 'vitest'
import { classifyIntentWithConfidence } from '../src/lib/intent-classifier'
import { mlClassify } from '../src/lib/ai/ml-classifier'
import { normalizeText } from '../src/lib/text-normalizer'

const suspects = [
  // table_reservation
  { msg: '72 цаг боллоо',          expected: 'order_status',   note: '"72 hours passed"' },
  { msg: 'Endees zahialiy',         expected: 'order_collection', note: '"Let me order from here"' },
  // menu_availability
  { msg: 'tged odoo yhen',          expected: 'general',        note: '"what now / where is it"' },
  { msg: 'odoo hurguuleeed avcihmaar bhi', expected: 'shipping', note: '"want it delivered now"' },
  { msg: 'Өнөөдөр 3 цагаас өмнө байж болохгүй юу', expected: 'shipping', note: '"before 3pm today"' },
  { msg: 'Onoodor unaand tawiuliy.', expected: 'shipping',      note: '"put on delivery today"' },
  { msg: 'Zurgiin harj bolhu? Songoltin', expected: 'product_search', note: '"can I see photos?"' },
  // complaint false positives
  { msg: 'Bish',                    expected: 'general',        note: '"No"' },
  { msg: 'Плаж нь яасан юм бол дуусчихсан юм болов уу', expected: 'product_search', note: '"is the beach item sold out?"' },
  { msg: 'Цагаан нь байгаа юмуу?', expected: 'product_search', note: '"is the white one available?"' },
  { msg: 'Солиулах гэсэн юм.',      expected: 'return_exchange', note: '"I want to exchange"' },
  // return_exchange false positives  
  { msg: 'Трусиктэй байж болох уу Хүүхдэд өмсүүлэх юм аа', expected: 'product_search', note: '"with underwear? for kids"' },
  { msg: 'Ягаан өнгөтэй юу',        expected: 'product_search', note: '"is there a pink color?"' },
  { msg: 'Даавуу юу  материал нь',  expected: 'product_search', note: '"fabric? what material?"' },
  { msg: 'Тийм ээ.болох уу',        expected: 'general',        note: '"yes, is it possible?"' },
]

it('debug suspects', () => {
  for (const t of suspects) {
    const kw = classifyIntentWithConfidence(t.msg)
    const ml = mlClassify(t.msg)
    const norm = normalizeText(t.msg)
    const ok = kw.intent === t.expected ? '✓' : '✗'
    console.log(`${ok} kw=[${kw.intent}:${kw.confidence.toFixed(1)}] ml=[${ml.intent}:${ml.confidence.toFixed(2)}]  "${t.msg}"`)
    console.log(`     norm="${norm}" → want: ${t.expected}  (${t.note})`)
  }
})
