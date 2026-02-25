import { createClient } from '@supabase/supabase-js'
async function main() {
  const sb = createClient('http://127.0.0.1:54321', process.env.SUPABASE_SECRET_KEY!)
  // Insert without stock_quantity to see what columns exist
  const { data, error } = await sb.from('products').select('id').limit(0)
  // Try inserting with minimal fields to get a meaningful error
  const { error: e2 } = await sb.from('products').insert({ store_id: '00000000-0000-0000-0000-000000000000', name: 'test' }).select()
  console.log('select error:', error?.message)
  console.log('insert error:', e2?.message)
}
main()
