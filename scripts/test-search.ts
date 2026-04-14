import { searchProducts } from '../src/lib/product-search'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  let url = '', key = ''
  const envPath = path.join(__dirname, '..', '.env.production.local')
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
    if (m) { if (m[1]==='NEXT_PUBLIC_SUPABASE_URL') url=m[2]; else key=m[2] }
  }
  const supabase = createClient(url, key)
  const storeId = '236636f3-0a44-4f04-aba1-312e00d03166'

  for (const q of ['галбир цамц', 'галбир', 'цамц', 'leevchik', 'леевчик', 'galbar tsamts']) {
    const results = await searchProducts(supabase, q, storeId, { maxProducts: 3, originalQuery: q })
    console.log(`"${q}":`)
    results.forEach((r: any,i: number) => console.log(`  ${i+1}. ${r.name} — ${r.base_price}`))
    if (results.length === 0) console.log('  (no results)')
    console.log()
  }
}
main()
