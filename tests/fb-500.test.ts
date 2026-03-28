import { it } from 'vitest'
import { hybridClassify } from '../src/lib/ai/hybrid-classifier'
import { readFileSync, existsSync } from 'fs'

const DATA_FILE = '/tmp/fb_500_messages.json'
const messages: string[] = existsSync(DATA_FILE)
  ? JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
  : []

it('classifies 500 real FB messages — distribution + suspects', () => {
  if (messages.length === 0) {
    console.log('SKIP: /tmp/fb_500_messages.json not found — provide real FB data to run this test')
    return
  }
  const byIntent: Record<string, string[]> = {}

  for (const msg of messages) {
    const { intent } = hybridClassify(msg)
    if (!byIntent[intent]) byIntent[intent] = []
    byIntent[intent].push(msg)
  }

  console.log('\n=== INTENT DISTRIBUTION (500 real FB messages) ===')
  const sorted = Object.entries(byIntent).sort((a,b) => b[1].length - a[1].length)
  for (const [intent, group] of sorted) {
    const pct = ((group.length / messages.length) * 100).toFixed(1)
    console.log(`  ${intent.padEnd(22)} ${group.length.toString().padStart(4)}  (${pct}%)`)
  }

  // Show all messages for uncommon/suspect intents
  const SUSPECT_INTENTS = ['table_reservation', 'allergen_info', 'menu_availability', 'gift_card_purchase', 'gift_card_redeem', 'price_info']
  for (const intent of SUSPECT_INTENTS) {
    const group = byIntent[intent] || []
    if (group.length === 0) continue
    console.log(`\n--- ${intent} (${group.length}) — REVIEW ---`)
    group.forEach(m => console.log(`  "${m}"`))
  }

  // Show samples of common intents for sanity check
  const COMMON_INTENTS = ['complaint', 'return_exchange', 'order_status', 'shipping', 'order_collection']
  for (const intent of COMMON_INTENTS) {
    const group = byIntent[intent] || []
    if (group.length === 0) continue
    console.log(`\n--- ${intent} (${group.length}) sample ---`)
    group.slice(0, 10).forEach(m => console.log(`  "${m}"`))
  }
})
