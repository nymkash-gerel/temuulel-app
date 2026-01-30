/**
 * Bulk-enrich all existing products with search aliases and FAQs.
 * Uses service role key to bypass auth.
 *
 * Usage: npx tsx scripts/bulk-enrich-products.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { enrichProduct } from '../src/lib/ai/product-enricher'
import type { ProductEnrichmentInput } from '../src/lib/ai/types'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NDg4OTQwMn0.X26octhVMTYp_6BNhrkoF74JEfKQAjV56tlnTddg5gJI0yokvBWPiNm8qZ5OXGR51IorHB2TIN7nM8ggFx0MkA'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Fetch all products that haven't been enriched yet
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description, category, base_price, search_aliases')
    .or('search_aliases.is.null,search_aliases.eq.{}')

  if (error) {
    console.error('Error fetching products:', error.message)
    return
  }

  if (!products || products.length === 0) {
    console.log('No un-enriched products found.')
    return
  }

  console.log(`Found ${products.length} products to enrich.\n`)

  let enrichedCount = 0
  let failedCount = 0

  for (const product of products) {
    const input: ProductEnrichmentInput = {
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      base_price: product.base_price,
    }

    console.log(`Enriching: ${product.name}...`)
    const result = await enrichProduct(input)

    if (!result) {
      console.log(`  ✗ Failed (OpenAI not configured or error)`)
      failedCount++
      continue
    }

    const { error: updateError } = await supabase
      .from('products')
      .update({
        search_aliases: result.search_aliases,
        product_faqs: result.product_faqs,
      })
      .eq('id', product.id)

    if (updateError) {
      console.log(`  ✗ DB update failed: ${updateError.message}`)
      failedCount++
    } else {
      console.log(`  ✓ ${result.search_aliases.length} aliases, ${Object.keys(result.product_faqs).length} FAQs`)
      enrichedCount++
    }
  }

  console.log(`\nDone: ${enrichedCount} enriched, ${failedCount} failed.`)
}

main().catch(console.error)
