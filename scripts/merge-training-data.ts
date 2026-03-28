import { readFileSync, writeFileSync } from 'fs'

// Load existing training data
const existing: {text: string, intent: string}[] = JSON.parse(
  readFileSync('src/lib/ai/training-data.json', 'utf-8')
)
console.log(`Existing: ${existing.length}`)

// Load new FB labeled data (high confidence)
const fbLabeled: {text: string, intent: string, confidence: number}[] = JSON.parse(
  readFileSync('scripts/data/fb-labeled-high.json', 'utf-8')
)
console.log(`New FB (high conf): ${fbLabeled.length}`)

// Convert to same format
const newData = fbLabeled.map(r => ({ text: r.text, intent: r.intent }))

// Merge and deduplicate by text
const existingTexts = new Set(existing.map(e => e.text.toLowerCase().trim()))
const unique = newData.filter(n => !existingTexts.has(n.text.toLowerCase().trim()))
console.log(`New unique (not in existing): ${unique.length}`)

const merged = [...existing, ...unique]
console.log(`\nMerged total: ${merged.length}`)

// Distribution
const dist: Record<string, number> = {}
for (const r of merged) {
  dist[r.intent] = (dist[r.intent] || 0) + 1
}
console.log('\nFinal distribution:')
Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v*100/merged.length).toFixed(1)}%)`)
})

// Save merged
writeFileSync('src/lib/ai/training-data.json', JSON.stringify(merged, null, 2))
console.log(`\nSaved to src/lib/ai/training-data.json`)
