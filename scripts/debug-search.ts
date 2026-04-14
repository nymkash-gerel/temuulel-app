import { searchProducts } from '../src/lib/product-search'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
async function main() {
  let url='',key=''
  for (const line of fs.readFileSync('.env.production.local','utf-8').split('\n')) {
    const m=line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
    if(m){if(m[1]==='NEXT_PUBLIC_SUPABASE_URL')url=m[2];else key=m[2]}
  }
  const sb=createClient(url,key), sid='236636f3-0a44-4f04-aba1-312e00d03166'
  for (const q of ['тарпизан өмд','тарпизан','өмд','даашинз','zara','цүнх','малгай','цамц өмд сет']) {
    const r=await searchProducts(sb,q,sid,{maxProducts:3,originalQuery:q})
    console.log(`"${q}":`, r.map(x=>x.name).join(' | ') || '(empty)')
  }
}
main()
