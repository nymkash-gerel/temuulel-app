import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://yglemwhbvhupoqniyxog.supabase.co'
const SB_KEY = process.env.SUPABASE_SECRET_KEY ?? ''
const STORE = '236636f3-0a44-4f04-aba1-312e00d03166'
const BASE = 'https://temuulel-app.vercel.app'

const sb = createClient(SB_URL, SB_KEY)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function run() {
  const C = crypto.randomUUID()
  await sb.from('conversations').insert({ id: C, store_id: STORE, channel: 'web', status: 'active' })

  // Step-by-step with 300ms delay before reading DB
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
    await sleep(500) // give DB time to settle
    const { data: conv } = await sb.from('conversations').select('status,escalation_score,escalation_level').eq('id', C).single()
    console.log(`"${m.substring(0, 28).padEnd(28)}" | intent:${String(d.intent).padEnd(14)} | score:${conv?.escalation_score ?? 'null'} level:${conv?.escalation_level ?? 'null'} status:${conv?.status}`)
  }

  const { data: final } = await sb.from('conversations').select('status,escalation_score,escalation_level,escalated_at').eq('id', C).single()
  console.log('\nFinal:', JSON.stringify(final))
  await sb.from('conversations').delete().eq('id', C)
}

run().catch(console.error)
