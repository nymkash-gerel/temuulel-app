import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
async function main() {
  let url='',key=''
  for (const line of fs.readFileSync('.env.production.local','utf-8').split('\n')) {
    const m=line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
    if(m){if(m[1]==='NEXT_PUBLIC_SUPABASE_URL')url=m[2];else key=m[2]}
  }
  const sb=createClient(url,key)
  // Check exact product names with hex encoding
  const { data } = await (sb as any).from('products').select('name').eq('store_id','236636f3-0a44-4f04-aba1-312e00d03166').eq('status','active')
  for (const p of (data||[])) {
    const hasNonAscii = /[^\x00-\x7F]/.test(p.name)
    const hex = [...p.name].map(c => c.charCodeAt(0) > 127 ? `[${c.charCodeAt(0)}]` : c).join('')
    // Check if "тарпизан" or "даашинз" substring matches
    const lower = p.name.toLowerCase()
    const hasTarp = lower.includes('тарпизан')
    const hasDaash = lower.includes('даашинз')
    if (hasTarp || hasDaash || lower.includes('малгай') || lower.includes('цүнх') || lower.includes('өмд')) {
      console.log(`${p.name} | tarp:${hasTarp} | daash:${hasDaash}`)
    }
  }
}
main()
