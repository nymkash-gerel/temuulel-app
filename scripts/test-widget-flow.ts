import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://yglemwhbvhupoqniyxog.supabase.co'
const SB_KEY = process.env.SUPABASE_SECRET_KEY ?? ''
const STORE_ID = '236636f3-0a44-4f04-aba1-312e00d03166'
const BASE = 'https://temuulel-app.vercel.app'

const sb = createClient(SB_URL, SB_KEY)

async function chat(convId: string, msg: string) {
  const r = await fetch(BASE + '/api/chat/widget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_message: msg, store_id: STORE_ID, conversation_id: convId }),
  })
  return r.json()
}

async function getState(convId: string) {
  const { data } = await sb.from('conversations').select('metadata').eq('id', convId).single()
  const s = (data?.metadata as Record<string, unknown>)?.conversation_state as Record<string, unknown> | undefined
  return {
    intent: s?.last_intent,
    prods: Array.isArray(s?.last_products) ? s.last_products.length : 0,
    draft: (s?.order_draft as Record<string, unknown>)?.step ?? null,
  }
}

async function main() {
  // Create a proper UUID conversation
  const C = crypto.randomUUID()
  const { error: e } = await sb.from('conversations').insert({ id: C, store_id: STORE_ID, channel: 'web', status: 'active' })
  if (e) { console.error('Insert failed:', e.message); process.exit(1) }
  console.log('Conv:', C, '\n')

  // NOTE: Кашемир цамц has 2 variants — must select variant before name/phone
  // Non-UUID conversation IDs cause silent state loss (conversations.id is UUID)
  const steps = [
    ['Захиалъя',                       '3.Order intent'],
    ['3',                              '4.Select product #3'],
    ['1',                              '5.Select variant #1'],
    ['Болд Батбаяр, 99112233',         '6.Name+phone'],
    ['СБД 3-р хороо Жанжин гудамж 12', '7.Address'],
    ['Тийм',                           '8.Confirm'],
  ] as const

  for (const [msg, label] of steps) {
    const r = await chat(C, msg)
    const s = await getState(C)
    console.log(`${label}: intent=${r.intent} order_step=${r.order_step ?? 'null'} | state: prods=${s.prods} draft=${s.draft}`)
    console.log(`   reply: ${String(r.response ?? r.reply ?? r.error).substring(0, 100)}`)
  }

  await sb.from('conversations').delete().eq('id', C)
}

main().catch(console.error)
