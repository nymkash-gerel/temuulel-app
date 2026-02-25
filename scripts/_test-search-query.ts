/**
 * Test the exact PostgREST .or() query that searchProducts builds.
 */
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_SECRET_KEY!
)

const STORE_ID = 'a1b2c3d4-e5f6-4789-ab01-234567890abc'

async function test(label: string, conditions: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('products') as any)
    .select('id, name')
    .eq('store_id', STORE_ID)
    .eq('status', 'active')
    .or(conditions)
    .limit(5)
  console.log(`\n--- ${label} ---`)
  console.log('conditions:', conditions)
  console.log('results:', data?.length ?? 0, data?.map((p: {name: string}) => p.name))
  if (error) console.log('ERROR:', error.message, error.details)
}

async function main() {
  // Test 1: plain ilike only
  await test(
    'ilike only',
    'name.ilike.%цүнх%,description.ilike.%цүнх%'
  )

  // Test 2: add search_aliases containment
  await test(
    'ilike + search_aliases',
    'name.ilike.%цүнх%,description.ilike.%цүнх%,search_aliases.cs.{цүнх}'
  )

  // Test 3: check if search_aliases column exists
  const { data: colCheck, error: colErr } = await sb
    .from('products')
    .select('id, search_aliases')
    .eq('store_id', STORE_ID)
    .limit(3)
  console.log('\n--- search_aliases column check ---')
  console.log('data:', colCheck?.map((p: {id: string; search_aliases: unknown}) => ({ id: p.id, sa: p.search_aliases })))
  if (colErr) console.log('ERROR:', colErr.message)

  // Test 4: escaping in .or
  await test(
    'escaped цунх (u not ү)',
    'name.ilike.%цунх%'
  )
}

main().catch(console.error)
