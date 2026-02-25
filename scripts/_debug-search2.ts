import { createClient } from '@supabase/supabase-js'
import { searchProducts } from '../src/lib/product-search'

const STORE_ID = 'a1b2c3d4-e5f6-4789-ab01-234567890abc'
const OLD_JWT = process.env.SUPABASE_SECRET_KEY!
const NEW_KEY = process.env.SUPABASE_SECRET_KEY!

async function test(label: string, key: string) {
  const sb = createClient('http://127.0.0.1:54321', key)

  // Direct query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: direct, error: directErr } = await (sb.from('products') as any)
    .select('id, name')
    .eq('store_id', STORE_ID)
    .eq('status', 'active')
    .limit(5)
  console.log(`\n[${label}] Direct query: ${direct?.length ?? 0} results, error: ${directErr?.message ?? 'none'}`)
  console.log('  products:', direct?.map((p: {name: string}) => p.name))

  // Via searchProducts function
  const results = await searchProducts(sb, 'цүнх', STORE_ID, { maxProducts: 5, originalQuery: 'цүнх байгаа уу' })
  console.log(`[${label}] searchProducts: ${results.length} results`)

  // Via searchProducts with empty query
  const allResults = await searchProducts(sb, '', STORE_ID, { maxProducts: 5 })
  console.log(`[${label}] searchProducts empty: ${allResults.length} results`)
}

async function main() {
  await test('OLD JWT', OLD_JWT)
  await test('NEW sb_secret', NEW_KEY)
}

main().catch(console.error)
