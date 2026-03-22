import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://yglemwhbvhupoqniyxog.supabase.co'
const SB_KEY = process.env.SUPABASE_SECRET_KEY ?? ''
const STORE = '236636f3-0a44-4f04-aba1-312e00d03166'
const BASE = 'https://temuulel-app.vercel.app'

const sb = createClient(SB_URL, SB_KEY)

async function run() {
  // 1. Check if escalation_score column exists
  const { data: convCheck, error } = await sb.from('conversations').select('id,escalation_score,status').limit(1)
  console.log('Column check error:', error?.message ?? 'none')
  console.log('Has escalation_score:', convCheck && convCheck.length > 0 ? 'escalation_score' in convCheck[0] : 'no rows')

  // 2. Run escalation sim standalone (sequential, no parallel)
  const C = crypto.randomUUID()
  const { error: insertErr } = await sb.from('conversations').insert({ id: C, store_id: STORE, channel: 'web', status: 'active' })
  if (insertErr) { console.error('Insert failed:', insertErr.message); return }

  const msgs = [
    'Захиалга маань хаана явж байна?',
    'Яагаад ийм удаан байгаа юм!?',
    'Яагаад ийм удаан байгаа юм!?',
    'Мөнгөө буцааж өг!!!',
    'Хүнтэй ярих',
  ]

  for (const m of msgs) {
    const r = await fetch(`${BASE}/api/chat/widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_message: m, store_id: STORE, conversation_id: C }),
    })
    const d = await r.json()
    // Check DB score after each message
    const { data: conv } = await sb.from('conversations').select('status,escalation_score').eq('id', C).single()
    console.log(`"${m.substring(0, 30)}" → intent:${d.intent} | DB score:${conv?.escalation_score ?? 'null'} status:${conv?.status}`)
  }

  const { data: final } = await sb.from('conversations').select('status,escalation_score').eq('id', C).single()
  console.log('\nFinal DB state:', JSON.stringify(final))
  await sb.from('conversations').delete().eq('id', C)
}

run().catch(console.error)
