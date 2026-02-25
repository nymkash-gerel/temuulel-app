/**
 * Debug why searchProducts returns 0 in the actual processAIChat flow.
 */
import { createClient } from '@supabase/supabase-js'
import { searchProducts, extractSearchTerms } from '../src/lib/product-search'
import { hybridClassify } from '../src/lib/ai/hybrid-classifier'
import { normalizeText } from '../src/lib/text-normalizer'

const STORE_ID = 'a1b2c3d4-e5f6-4789-ab01-234567890abc'
const OLD_JWT = process.env.SUPABASE_SECRET_KEY!

const supabase = createClient('http://127.0.0.1:54321', OLD_JWT)

const testMsg = 'цүнх байгаа уу'

async function main() {
  // 1. Intent classification
  const classified = hybridClassify(testMsg)
  console.log('Intent:', classified.intent, '| confidence:', classified.confidence)

  // 2. Extract search terms
  const searchTerms = extractSearchTerms(testMsg)
  console.log('Search terms:', JSON.stringify(searchTerms))
  console.log('Normalized msg:', normalizeText(testMsg))

  // 3. Run searchProducts with the exact same args as processAIChat
  console.log('\nRunning searchProducts(supabase, searchTerms, storeId, {maxProducts: undefined, originalQuery: testMsg})')
  const results = await searchProducts(supabase, searchTerms, STORE_ID, {
    maxProducts: undefined, // chatbotSettings.max_products when settings is {}
    originalQuery: testMsg,
    availableOnly: false,
  })
  console.log('Results:', results.length, results.map(p => p.name))

  // 4. Also check store exists
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, name, chatbot_settings')
    .eq('id', STORE_ID)
    .single()
  console.log('\nStore:', store?.name ?? 'NOT FOUND', storeErr?.message ?? '')

  // 5. Test with empty string (should return all products)
  const all = await searchProducts(supabase, '', STORE_ID, { maxProducts: 5 })
  console.log('\nEmpty query returns:', all.length, 'products:', all.map(p => p.name))
}

main().catch(console.error)
