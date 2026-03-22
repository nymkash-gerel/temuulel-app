import { config } from 'dotenv'; config({ path: '.env.vprod' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!
  )

  // Check what columns gift_cards actually has
  const { data: gc } = await sb.from('gift_cards').select('*').limit(1)
  console.log('gift_cards sample (columns):', gc ? Object.keys(gc[0] ?? {}) : 'empty table')

  // Check if gift_card_transactions exists
  const { error: txErr } = await sb.from('gift_card_transactions').select('id').limit(1)
  console.log('gift_card_transactions:', txErr ? `MISSING — ${txErr.message}` : 'EXISTS')
}
main().catch(console.error)
