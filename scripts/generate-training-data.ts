/**
 * generate-training-data.ts — Expand ML training data with morphological variants
 *
 * Takes the 224 seed examples and generates morphological variants by:
 * 1. Adding suffix forms (past, negative, desiderative, progressive, etc.)
 * 2. Adding informal/SMS-style variants
 * 3. Adding context phrases
 *
 * Run: npx tsx scripts/generate-training-data.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface Example {
  text: string
  intent: string
}

// Morphological suffix templates per intent
const SUFFIX_TEMPLATES: Record<string, Array<{ template: string; intent?: string }>> = {
  // Order-related suffixes
  order_collection: [
    { template: '{root} авмаар байна' },
    { template: '{root} авмаар' },
    { template: '{root} захиалмаар' },
    { template: '{root} захиалмаар байна' },
    { template: '{root} авах гэсэн' },
    { template: '{root} авъя' },
    { template: '{root} захиалъя' },
    { template: '{root} авахаар шийдсэн' },
    { template: 'энэ {root} авмаар' },
  ],

  // Order status suffixes
  order_status: [
    { template: '{root} ирсэн үү' },
    { template: '{root} ирсэн уу' },
    { template: '{root} хэзээ ирэх вэ' },
    { template: '{root} бэлэн болсон уу' },
    { template: '{root} хаана явж байна' },
    { template: '{root} илгээсэн үү' },
    { template: '{root} хүлээж байна' },
    { template: '{root} хэзээ бэлэн болох вэ' },
  ],

  // Complaint suffixes (negative patterns)
  complaint: [
    { template: '{root} ирээгүй' },
    { template: '{root} ирэхгүй байна' },
    { template: '{root} хийгдээгүй' },
    { template: '{root} хүргэгдсэнгүй' },
    { template: '{root} буцаагаагүй' },
    { template: '{root} өгөөгүй' },
    { template: '{root} удаж байна' },
    { template: '{root} яагаад удаж байна' },
    { template: '{root} хариу өгөөгүй' },
  ],

  // Return/exchange suffixes
  return_exchange: [
    { template: '{root} солимоор байна' },
    { template: '{root} буцаамаар байна' },
    { template: '{root} буцааж болох уу' },
    { template: '{root} солиулж болох уу' },
    { template: '{root} тохирохгүй байна' },
    { template: '{root} буцааж өгнө үү' },
    { template: '{root} солих боломжтой юу' },
  ],

  // Payment suffixes
  payment: [
    { template: '{root} төлсөн' },
    { template: '{root} төлж болох уу' },
    { template: '{root} шилжүүлсэн' },
    { template: '{root} шилжүүлж байна' },
    { template: '{root} хуваан төлж болох уу' },
    { template: '{root} төлбөр хийсэн' },
    { template: '{root} төлөгдсөн үү' },
  ],

  // Shipping suffixes
  shipping: [
    { template: '{root} хүргэж болох уу' },
    { template: '{root} хүргүүлмээр байна' },
    { template: '{root} илгээгээрэй' },
    { template: '{root} хүргээрэй' },
    { template: '{root} хүргэлт хэзээ ирэх вэ' },
    { template: '{root} яаж хүлээн авах вэ' },
  ],

  // Size info suffixes
  size_info: [
    { template: '{root} хэмжээтэй юу' },
    { template: '{root} хэмжээ ямар вэ' },
    { template: '{root} хэд размертэй вэ' },
    { template: '{root} тохирох размер байна уу' },
  ],

  // Product search suffixes
  product_search: [
    { template: '{root} байна уу' },
    { template: '{root} байгаа юу' },
    { template: '{root} бну' },
    { template: '{root} бга юу' },
    { template: '{root} харуулна уу' },
    { template: '{root} үзүүлээч' },
    { template: '{root} үнэ хэд вэ' },
    { template: '{root} ямар төрөл байна' },
  ],
}

// Root words/phrases to use with templates
const INTENT_ROOTS: Record<string, string[]> = {
  order_collection: ['бараа', 'энэ', 'цамц', 'гутал', 'куртка', 'даашинз', 'бэлэг', 'малгай'],
  order_status: ['захиалга', 'бараа', 'миний захиалга', 'илгээмж', 'багц'],
  complaint: ['захиалга', 'бараа', 'хүргэлт', 'мөнгө', 'төлбөр', 'хариу'],
  return_exchange: ['бараа', 'хувцас', 'гутал', 'энэ бараа', 'цамц'],
  payment: ['төлбөр', 'мөнгө', 'данс', 'QPay', 'картаар'],
  shipping: ['бараа', 'захиалга', 'илгээмж', 'хүргэлт'],
  size_info: ['энэ', 'цамц', 'гутал', 'куртка'],
  product_search: ['скимс', 'цамц', 'гутал', 'куртка', 'малгай', 'цүнх', 'даашинз', 'бэлэг', 'ном'],
}

// Additional standalone examples (not template-based)
const EXTRA_EXAMPLES: Example[] = [
  // Desiderative forms
  { text: 'авмаар байна', intent: 'order_collection' },
  { text: 'захиалмаар байна', intent: 'order_collection' },
  { text: 'худалдаж авмаар', intent: 'order_collection' },
  { text: 'авахаар шийдлээ', intent: 'order_collection' },
  { text: 'энийг захиалмаар', intent: 'order_collection' },

  // Negative + delivery
  { text: 'захиалга ирээгүй байна', intent: 'complaint' },
  { text: 'бараа хүргэгдсэнгүй', intent: 'complaint' },
  { text: 'мөнгө буцаагаагүй', intent: 'complaint' },
  { text: 'хариу өгөхгүй байна', intent: 'complaint' },
  { text: 'хүргэлт хийгдээгүй', intent: 'complaint' },
  { text: 'чанар муутай', intent: 'complaint' },
  { text: 'эвдэрсэн ирсэн', intent: 'complaint' },

  // Past question patterns
  { text: 'захиалга ирсэн үү', intent: 'order_status' },
  { text: 'илгээсэн үү', intent: 'order_status' },
  { text: 'бэлэн болсон уу', intent: 'order_status' },
  { text: 'баталгаажсан уу', intent: 'order_status' },
  { text: 'хүргэсэн үү', intent: 'order_status' },

  // Progressive patterns
  { text: 'хүлээж байна', intent: 'order_status' },
  { text: 'бараа хайж байна', intent: 'product_search' },
  { text: 'төлбөр шилжүүлж байна', intent: 'payment' },
  { text: 'хүргэлт удаж байна', intent: 'complaint' },

  // Imperative
  { text: 'хурдан хүргээрэй', intent: 'shipping' },
  { text: 'буцаагаарай', intent: 'return_exchange' },
  { text: 'шилжүүлээрэй', intent: 'payment' },

  // Return with morph
  { text: 'солимоор байна', intent: 'return_exchange' },
  { text: 'буцаамаар байна', intent: 'return_exchange' },
  { text: 'тохирохгүй солимоор', intent: 'return_exchange' },
  { text: 'хэмжээ тохирохгүй солих', intent: 'return_exchange' },

  // Informal/SMS variants
  { text: 'braa bnu', intent: 'product_search' },
  { text: 'zahialga haana bn', intent: 'order_status' },
  { text: 'tulbur tuluh', intent: 'payment' },
  { text: 'hurgeltiig hurdan hiine uu', intent: 'shipping' },
  { text: 'butsaaj bolhu', intent: 'return_exchange' },
  { text: 'avmaar bn', intent: 'order_collection' },
  { text: 'sn bnu', intent: 'greeting' },
  { text: 'bayrlalaa', intent: 'thanks' },

  // Multi-suffix chains
  { text: 'захиалсангүй байна', intent: 'complaint' },
  { text: 'хүргэгдсэнгүй', intent: 'complaint' },
  { text: 'буцаагдаагүй', intent: 'complaint' },
  { text: 'төлөгдсөнгүй', intent: 'complaint' },

  // Context-rich examples
  { text: 'өчигдөр захиалсан бараа хэзээ ирэх вэ', intent: 'order_status' },
  { text: 'энэ долоо хоногт хүргэж чадах уу', intent: 'shipping' },
  { text: 'QPay-аар төлж болох уу', intent: 'payment' },
  { text: 'хуваан төлж болох уу', intent: 'payment' },
  { text: 'бусад өнгө байгаа юу', intent: 'product_search' },
  { text: 'хар өнгөтэй байна уу', intent: 'product_search' },
  { text: 'XL размер байна уу', intent: 'size_info' },
  { text: 'M хэмжээтэй байна уу', intent: 'size_info' },

  // Greetings and thanks
  { text: 'юу байна', intent: 'product_search' },
  { text: 'мэнд', intent: 'greeting' },
  { text: 'амар байна уу', intent: 'greeting' },
  { text: 'өглөөний мэнд', intent: 'greeting' },
  { text: 'оройн мэнд', intent: 'greeting' },
  { text: 'гайхалтай баярлалаа', intent: 'thanks' },
  { text: 'маш их баярлалаа', intent: 'thanks' },
  { text: 'амжилт хүсье', intent: 'thanks' },
  { text: 'ойлголоо баярлалаа', intent: 'thanks' },
]

function generate(): Example[] {
  // Read existing training data
  const existingPath = join(__dirname, '..', 'src', 'lib', 'ai', 'training-data.json')
  const existing: Example[] = JSON.parse(readFileSync(existingPath, 'utf-8'))

  // Track existing texts to avoid duplicates
  const seen = new Set(existing.map(e => e.text.toLowerCase().trim()))
  const generated: Example[] = []

  function addIfNew(text: string, intent: string) {
    const key = text.toLowerCase().trim()
    if (!seen.has(key) && text.length > 1) {
      seen.add(key)
      generated.push({ text, intent })
    }
  }

  // Generate template-based examples
  for (const [intent, templates] of Object.entries(SUFFIX_TEMPLATES)) {
    const roots = INTENT_ROOTS[intent] || []
    for (const root of roots) {
      for (const { template, intent: overrideIntent } of templates) {
        const text = template.replace('{root}', root)
        addIfNew(text, overrideIntent || intent)
      }
    }
  }

  // Add extra standalone examples
  for (const ex of EXTRA_EXAMPLES) {
    addIfNew(ex.text, ex.intent)
  }

  const combined = [...existing, ...generated]

  // Print stats
  const counts: Record<string, number> = {}
  for (const ex of combined) {
    counts[ex.intent] = (counts[ex.intent] || 0) + 1
  }

  console.log(`\nTraining data expansion:`)
  console.log(`  Existing: ${existing.length}`)
  console.log(`  Generated: ${generated.length}`)
  console.log(`  Total: ${combined.length}`)
  console.log(`\nPer intent:`)
  for (const [intent, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${intent}: ${count}`)
  }

  return combined
}

// Run
const combined = generate()
const outPath = join(__dirname, '..', 'src', 'lib', 'ai', 'training-data.json')
writeFileSync(outPath, JSON.stringify(combined, null, 2) + '\n', 'utf-8')
console.log(`\nWritten to ${outPath}`)
