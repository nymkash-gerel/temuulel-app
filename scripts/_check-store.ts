import { config } from 'dotenv'
config({ path: '.env.production.local' })
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
const sb = createClient(url, key)

async function main() {
  const { data: store, error } = await sb.from('stores').select('id, name, address, phone, shipping_settings').eq('id', '236636f3-0a44-4f04-aba1-312e00d03166').single()
  if (error) { console.error('Error:', error.message); return }
  console.log('Store:', store?.name)
  console.log('Address:', store?.address || 'NOT SET')
  console.log('Phone:', store?.phone || 'NOT SET')
  console.log('Hours:', store?.store_hours || 'NOT SET')
  console.log('Shipping:', JSON.stringify(store?.shipping_settings, null, 2) || 'NOT SET')
}
main()
