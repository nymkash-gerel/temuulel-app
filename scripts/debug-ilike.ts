import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
async function main() {
  let url='',key=''
  for (const line of fs.readFileSync('.env.production.local','utf-8').split('\n')) {
    const m=line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
    if(m){if(m[1]==='NEXT_PUBLIC_SUPABASE_URL')url=m[2];else key=m[2]}
  }
  const sb=createClient(url,key)
  const sid='236636f3-0a44-4f04-aba1-312e00d03166'
  
  // Direct ILIKE test
  const { data, error } = await (sb as any).from('products')
    .select('name')
    .eq('store_id', sid)
    .eq('status', 'active')
    .or('name.ilike.%тарпизан%,description.ilike.%тарпизан%')
    .limit(5)
  
  console.log('Direct ILIKE %тарпизан%:', data?.map((d:any)=>d.name), error?.message)

  const { data: d2 } = await (sb as any).from('products')
    .select('name')
    .eq('store_id', sid)
    .eq('status', 'active')
    .or('name.ilike.%даашинз%,description.ilike.%даашинз%')
    .limit(5)
  console.log('Direct ILIKE %даашинз%:', d2?.map((d:any)=>d.name))
}
main()
