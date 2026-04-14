#!/usr/bin/env npx tsx
/**
 * Debug: Test state write/read cycle for order_draft persistence
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { readState, writeState, emptyState } from '../src/lib/conversation-state'

let url = '', key = ''
const envPath = path.join(__dirname, '..', '.env.production.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
  if (m) { if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL') url = m[2]; else key = m[2] }
}
const supabase = createClient(url, key)

async function main() {
  // Get store
  const { data: store } = await supabase.from('stores').select('id').ilike('name', '%монгол маркет%').single()
  if (!store) { console.error('No store'); return }
  const { data: cust } = await supabase.from('customers').select('id').eq('store_id', store.id).limit(1).single()

  // Create test conversation
  const convId = crypto.randomUUID()
  console.log('1. Creating conversation:', convId.slice(0, 8))
  const { error: insertErr } = await supabase.from('conversations').insert({
    id: convId,
    store_id: store.id,
    customer_id: cust?.id,
    channel: 'web',
    status: 'active',
  })
  if (insertErr) { console.error('Insert error:', insertErr); return }

  // Read initial state
  const state0 = await readState(supabase as never, convId)
  console.log('2. Initial state:', JSON.stringify(state0))

  // Write state with order_draft
  const stateWithDraft = {
    ...emptyState(),
    turn_count: 1,
    last_intent: 'order_collection',
    order_draft: {
      items: [{ product_id: 'test-id', product_name: 'Test Product', unit_price: 10000, quantity: 1 }],
      step: 'variant' as const,
      product_id: 'test-id',
      product_name: 'Test Product',
      unit_price: 10000,
      quantity: 1,
    },
  }
  console.log('3. Writing state with draft...')
  await writeState(supabase as never, convId, stateWithDraft)

  // Read back
  const state1 = await readState(supabase as never, convId)
  console.log('4. Read back:')
  console.log('   turn_count:', state1.turn_count)
  console.log('   last_intent:', state1.last_intent)
  console.log('   order_draft:', state1.order_draft ? 'EXISTS step=' + state1.order_draft.step : 'NULL')
  console.log('   items:', state1.order_draft?.items?.length ?? 0)

  // Read raw metadata
  const { data: raw } = await supabase.from('conversations').select('metadata').eq('id', convId).single()
  const cs = (raw?.metadata as Record<string, unknown>)?.conversation_state as Record<string, unknown> | null
  console.log('5. Raw DB conversation_state.order_draft:', cs?.order_draft ? 'EXISTS' : 'NULL')
  if (cs?.order_draft) {
    console.log('   Raw:', JSON.stringify(cs.order_draft).slice(0, 200))
  }
  console.log('   Raw metadata keys:', Object.keys(cs || {}))

  // Cleanup
  await supabase.from('conversations').delete().eq('id', convId)
  console.log('\n6. Cleanup done.')
}
main().catch(e => console.error('Fatal:', e))
