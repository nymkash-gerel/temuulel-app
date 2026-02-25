import { createClient } from '@supabase/supabase-js'
async function main() {
  const sb = createClient(
    'http://127.0.0.1:54321',
    process.env.SUPABASE_SECRET_KEY!,
  )
  const { data, error } = await sb.from('stores').select('id, name, business_type').order('created_at').limit(20)
  if (error) { console.error(error); return }
  console.table(data)
}
main()
