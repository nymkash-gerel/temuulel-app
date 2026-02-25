import { createClient } from '@supabase/supabase-js'
const sb = createClient('http://127.0.0.1:54321', process.env.SUPABASE_SECRET_KEY!)
async function main() {
  const { data, error } = await sb
    .from('products')
    .select('id, name, status, store_id')
    .eq('store_id', 'a1b2c3d4-e5f6-4789-ab01-234567890abc')
  console.log('Products:', data?.length, error?.message)
  console.log(data?.map(p => p.name))

  // Check if product search works via ilike
  const { data: search } = await sb
    .from('products')
    .select('id, name')
    .eq('store_id', 'a1b2c3d4-e5f6-4789-ab01-234567890abc')
    .ilike('name', '%цүнх%')
  console.log('цүнх search:', search?.map(p => p.name))
}
main()
