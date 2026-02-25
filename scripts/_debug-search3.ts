import { createClient } from '@supabase/supabase-js'

const STORE_ID = 'a1b2c3d4-e5f6-4789-ab01-234567890abc'
const KEY = process.env.SUPABASE_SECRET_KEY!

const sb = createClient('http://127.0.0.1:54321', KEY)

async function main() {
  // Test 1: Exact select from searchProducts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: full, error: fullErr } = await (sb.from('products') as any)
    .select(`
      id, name, description, category, base_price, images, sales_script,
      product_faqs, ai_context,
      available_today, sold_out, allergens, spicy_level,
      is_vegan, is_halal, is_gluten_free, dietary_tags,
      product_variants(size, color, price, stock_quantity)
    `)
    .eq('store_id', STORE_ID)
    .eq('status', 'active')
    .limit(5)
  console.log('Full select results:', full?.length ?? 0)
  console.log('Full select error:', fullErr?.message ?? 'none', fullErr?.details ?? '')

  if (full && full.length > 0) {
    console.log('First product:', JSON.stringify(full[0], null, 2))
  }

  // Test 2: Remove product_variants join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: noVariants, error: noVarErr } = await (sb.from('products') as any)
    .select('id, name, description, category, base_price, images, sales_script, product_faqs, ai_context, available_today, sold_out, allergens, spicy_level, is_vegan, is_halal, is_gluten_free, dietary_tags')
    .eq('store_id', STORE_ID)
    .eq('status', 'active')
    .limit(5)
  console.log('\nNo-variants select results:', noVariants?.length ?? 0, 'error:', noVarErr?.message ?? 'none')

  // Test 3: Check if product_variants table exists
  const { data: variants, error: varErr } = await sb
    .from('product_variants')
    .select('id, product_id, size, color, price, stock_quantity')
    .limit(3)
  console.log('\nproduct_variants exists:', !varErr, varErr?.message ?? 'none')
  console.log('variant rows:', variants?.length ?? 0)

  // Test 4: Check Redis - getRedis()
  console.log('\nREDIS_URL:', process.env.REDIS_URL ?? 'not set')
  console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ?? 'not set')
}

main().catch(console.error)
