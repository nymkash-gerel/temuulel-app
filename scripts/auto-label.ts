import { hybridClassify } from '@/lib/ai/hybrid-classifier'
import { readFileSync, writeFileSync } from 'fs'

const raw: string[] = JSON.parse(readFileSync('scripts/data/fb-raw-messages.json', 'utf-8'))

const results: {text: string, intent: string, confidence: number}[] = []
let highConf = 0, lowConf = 0

for (const msg of raw) {
  const { intent, confidence } = hybridClassify(msg)
  results.push({ text: msg, intent, confidence })
  if (confidence >= 1.5) highConf++
  else lowConf++
}

// Save all labeled
writeFileSync('scripts/data/fb-labeled-all.json', JSON.stringify(results, null, 2))

// Save high confidence only (for training)
const highConfResults = results.filter(r => r.confidence >= 1.0)
writeFileSync('scripts/data/fb-labeled-high.json', JSON.stringify(highConfResults, null, 2))

console.log(`Total: ${results.length}`)
console.log(`High confidence (>=1.5): ${highConf}`)
console.log(`Medium confidence (1.0-1.5): ${highConfResults.length - highConf}`)
console.log(`Low confidence (<1.0): ${lowConf}`)

// Distribution
const dist: Record<string, number> = {}
for (const r of highConfResults) {
  dist[r.intent] = (dist[r.intent] || 0) + 1
}
console.log('\nDistribution (high+medium confidence):')
Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`)
})
