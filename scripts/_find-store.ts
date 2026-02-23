import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, business_type')
    .order('created_at')
    .limit(20)

  if (error) { console.error(error); process.exit(1) }
  console.table(data)
}

main()
