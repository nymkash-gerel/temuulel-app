import { createClient } from '@supabase/supabase-js'
const sb = createClient('http://127.0.0.1:54321', process.env.SUPABASE_SECRET_KEY!)
async function main() {
  await sb.from('products').delete().eq('store_id', '10000000-0000-0000-0000-000000000001')
  await sb.from('stores').delete().eq('id', '10000000-0000-0000-0000-000000000001')
  console.log('Cleaned up old seed data')
}
main()
