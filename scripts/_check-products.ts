import { config } from 'dotenv'
config({ path: '.env.production.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
const sb = createClient(url, key)

async function main() {
  const { data: products } = await sb.from('products')
    .select('name, ai_context, product_faqs, description')
    .eq('store_id', '236636f3-0a44-4f04-aba1-312e00d03166')
    .order('name')

  if (!products) { console.log('No products found'); return }

  for (const p of products) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`📦 ${p.name}`)
    console.log(`  Тайлбар: ${p.description?.substring(0, 80) || '🔴 БАЙХГҮЙ'}`)
    console.log(`  AI заавар: ${p.ai_context ? '✅ ' + p.ai_context.substring(0, 80) + '...' : '🔴 БАЙХГҮЙ'}`)
    if (p.product_faqs && typeof p.product_faqs === 'object') {
      const faqs = p.product_faqs as Record<string, string>
      console.log(`  FAQ: ✅ ${Object.keys(faqs).length} асуулт`)
      for (const [q, a] of Object.entries(faqs)) {
        console.log(`    • ${q} → ${String(a).substring(0, 60)}`)
      }
    } else {
      console.log(`  FAQ: 🔴 БАЙХГҮЙ`)
    }
  }
}
main()
