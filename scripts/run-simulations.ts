/**
 * Temuulel Simulation Runner — Sims 1–6 (widget API-based)
 * Tests customer journeys against production.
 */
import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://yglemwhbvhupoqniyxog.supabase.co'
const SB_KEY = process.env.SUPABASE_SECRET_KEY ?? ''
const STORE = '236636f3-0a44-4f04-aba1-312e00d03166'
const BASE = process.env.TEST_BASE_URL ?? 'https://temuulel-app.vercel.app'
const DELAY_MS = 250 // avoid rate limiting (prod: 20 req/min)

const sb = createClient(SB_URL, SB_KEY)

// ── helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function newConv() {
  const id = crypto.randomUUID()
  const { error } = await sb.from('conversations').insert({ id, store_id: STORE, channel: 'web', status: 'active' })
  if (error) throw new Error(`Could not create conversation: ${error.message}`)
  return id
}

async function chat(convId: string, msg: string) {
  await sleep(DELAY_MS)
  const r = await fetch(`${BASE}/api/chat/widget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_message: msg, store_id: STORE, conversation_id: convId }),
  })
  return r.json() as Promise<{
    response?: string; reply?: string; error?: string
    intent?: string; order_step?: string | null; products_found?: number
  }>
}

async function getConvState(convId: string) {
  const { data } = await sb.from('conversations').select('metadata, status, escalation_score').eq('id', convId).single()
  const s = (data?.metadata as Record<string, unknown>)?.conversation_state as Record<string, unknown> | undefined
  return {
    intent: s?.last_intent as string | undefined,
    draft: (s?.order_draft as Record<string, unknown> | null)?.step as string | undefined ?? null,
    status: data?.status as string | undefined,
    escalation_score: data?.escalation_score as number | undefined,
  }
}

async function cleanup(convId: string) {
  await sb.from('conversations').delete().eq('id', convId)
}

type StepResult = { step: number; msg: string; intent: string; order_step: string | null; reply: string; pass: boolean; note: string }
type SimResult = { name: string; passed: number; total: number; steps: StepResult[]; bugs: string[] }

function check(label: string, value: unknown, expected: unknown): { pass: boolean; note: string } {
  const pass = value === expected
  return { pass, note: pass ? `${label}=${value} ✅` : `${label}=${JSON.stringify(value)} (expected ${JSON.stringify(expected)}) 🔴` }
}

// ── SIM 1: Happy Path Order ───────────────────────────────────────────────────

async function sim1(): Promise<SimResult> {
  const name = 'SIM 1: Happy Path Order'
  const conv = await newConv()
  const steps: StepResult[] = []
  const bugs: string[] = []

  // Note: step 3 can land on 'variant' (multiple variants to choose from)
  // OR 'info' (single match auto-selected). Both are correct.
  const flow: { msg: string; checkIntent: string; checkStep: string | string[] | null; note: string }[] = [
    { msg: 'Сайн байна уу',                            checkIntent: 'greeting',         checkStep: null,                    note: 'Greeting' },
    { msg: 'Цамц байна уу?',                           checkIntent: 'product_search',   checkStep: null,                    note: 'Product search' },
    { msg: '1',                                        checkIntent: 'order_collection', checkStep: ['variant', 'info'],     note: 'Select product' },
    { msg: '1',                                        checkIntent: 'order_collection', checkStep: ['variant', 'info'],     note: 'Select variant (if needed)' },
    { msg: 'Бат-Эрдэнэ 99112233',                      checkIntent: 'order_collection', checkStep: ['info', 'confirming'], note: 'Name+phone (no greeting reset!)' },
    { msg: 'Баянгол дүүрэг 3-р хороо 45-р байр 301', checkIntent: 'order_collection', checkStep: 'confirming',             note: 'Address → summary' },
    { msg: 'Тийм',                                     checkIntent: 'order_created',    checkStep: null,                    note: 'Confirm → order created' },
  ]

  for (let i = 0; i < flow.length; i++) {
    const { msg, checkIntent, checkStep, note } = flow[i]
    const r = await chat(conv, msg)
    const reply = (r.response ?? r.reply ?? r.error ?? '').substring(0, 80)
    const intentOk = r.intent === checkIntent
    const stepOk = Array.isArray(checkStep) ? checkStep.includes(r.order_step ?? '') : r.order_step === checkStep
    const pass = intentOk && stepOk
    if (!pass) bugs.push(`Step ${i + 1} (${note}): intent=${r.intent} step=${r.order_step} — expected intent=${checkIntent} step=${JSON.stringify(checkStep)}`)
    steps.push({ step: i + 1, msg, intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass, note })
  }

  await cleanup(conv)
  return { name, passed: steps.filter(s => s.pass).length, total: steps.length, steps, bugs }
}

// ── SIM 2: Name Contains "hi" (greeting false positive guard) ─────────────────

async function sim2(): Promise<SimResult> {
  const name = 'SIM 2: Name Contains "hi" (Shinebayar)'
  const conv = await newConv()
  const steps: StepResult[] = []
  const bugs: string[] = []

  const flow = [
    { msg: 'Сайн байна уу', checkIntent: 'greeting', checkStep: null as string | null, note: 'Greeting' },
    { msg: 'Гар утас байна уу?', checkIntent: 'product_search', checkStep: null, note: 'Product search' },
    { msg: '1', checkIntent: 'order_collection', checkStep: ['variant', 'info'], note: 'Select product' },
    { msg: '1', checkIntent: 'order_collection', checkStep: ['info'], note: 'Select variant or first step' },
    { msg: 'Shinebayar', checkIntent: 'order_collection', checkStep: 'info', note: 'Name with "hi" — must NOT reset!' },
    { msg: '88001122', checkIntent: 'order_collection', checkStep: ['info', 'confirming'], note: 'Phone' },
    { msg: 'ХУД 5-р хороо', checkIntent: 'order_collection', checkStep: 'confirming', note: 'Address' },
    { msg: 'За', checkIntent: 'order_created', checkStep: null, note: 'Confirm' },
  ]

  for (let i = 0; i < flow.length; i++) {
    const { msg, note } = flow[i]
    const checkIntent = flow[i].checkIntent
    const checkStep = flow[i].checkStep
    const r = await chat(conv, msg)
    const reply = (r.response ?? r.reply ?? r.error ?? '').substring(0, 80)
    const intentOk = r.intent === checkIntent
    const stepOk = Array.isArray(checkStep) ? checkStep.includes(r.order_step ?? '') : r.order_step === checkStep
    const pass = intentOk && stepOk
    if (!pass) bugs.push(`Step ${i + 1} (${note}): intent=${r.intent} step=${r.order_step}`)
    steps.push({ step: i + 1, msg, intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass, note })
  }

  await cleanup(conv)
  return { name, passed: steps.filter(s => s.pass).length, total: steps.length, steps, bugs }
}

// ── SIM 3: Complaint Escalation ───────────────────────────────────────────────

async function sim3(): Promise<SimResult> {
  const name = 'SIM 3: Complaint Escalation'
  const conv = await newConv()
  const steps: StepResult[] = []
  const bugs: string[] = []

  const msgs = [
    'Захиалга маань хаана явж байна?',
    'Яагаад ийм удаан байгаа юм!?',
    'Яагаад ийм удаан байгаа юм!?',
    'Мөнгөө буцааж өг!!!',
    'Хүнтэй ярих',
  ]

  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(conv, msgs[i])
    const reply = (r.response ?? r.reply ?? r.error ?? '').substring(0, 80)
    steps.push({ step: i + 1, msg: msgs[i], intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass: true, note: '' })
  }

  // Check final DB state
  const state = await getConvState(conv)
  const escalated = state.status === 'escalated' || (state.escalation_score ?? 0) >= 60
  if (!escalated) bugs.push(`Escalation not triggered: status=${state.status} score=${state.escalation_score}`)
  steps[steps.length - 1].pass = escalated
  steps[steps.length - 1].note = `DB: status=${state.status} score=${state.escalation_score}`

  await cleanup(conv)
  return { name, passed: steps.filter(s => s.pass).length, total: steps.length, steps, bugs }
}

// ── SIM 4: Mid-Order Cancellation ─────────────────────────────────────────────

async function sim4(): Promise<SimResult> {
  const name = 'SIM 4: Mid-Order Cancellation'
  const conv = await newConv()
  const steps: StepResult[] = []
  const bugs: string[] = []

  const flow = [
    { msg: 'Пүүз байна уу?', expectIntent: 'product_search', expectStep: null as string | null, note: 'Product search' },
    { msg: '1', expectIntent: 'order_collection', expectStep: null, note: 'Select product', skipStepCheck: true },
    { msg: '1', expectIntent: 'order_collection', expectStep: null, note: 'Select variant', skipStepCheck: true },
    { msg: 'Захиалаагүй ээ', expectIntent: null, expectStep: null, note: 'Cancel — draft must clear', skipIntentCheck: true },
    { msg: 'Цаг байна уу?', expectIntent: 'product_search', expectStep: null, note: 'Fresh search after cancel' },
  ]

  for (let i = 0; i < flow.length; i++) {
    const { msg, expectIntent, expectStep, note, skipStepCheck, skipIntentCheck } = flow[i]
    const r = await chat(conv, msg)
    const reply = (r.response ?? r.reply ?? r.error ?? '').substring(0, 80)
    const intentOk = skipIntentCheck ? true : (expectIntent === null || r.intent === expectIntent)
    const stepOk = skipStepCheck ? true : r.order_step === expectStep
    const pass = intentOk && stepOk

    // Step 4 — after cancel, check DB state
    if (i === 3) {
      const state = await getConvState(conv)
      const draftCleared = state.draft === null || state.draft === undefined
      if (!draftCleared) bugs.push(`Draft not cleared after cancel: draft.step=${state.draft}`)
      steps.push({ step: i + 1, msg, intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass: draftCleared, note: `draft_cleared=${draftCleared}` })
    } else {
      if (!pass) bugs.push(`Step ${i + 1} (${note}): intent=${r.intent} step=${r.order_step}`)
      steps.push({ step: i + 1, msg, intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass, note })
    }
  }

  await cleanup(conv)
  return { name, passed: steps.filter(s => s.pass).length, total: steps.length, steps, bugs }
}

// ── SIM 5: Simultaneous Customers (A+B independent) ──────────────────────────

async function sim5(): Promise<SimResult> {
  const name = 'SIM 5: Simultaneous Customers (A and B independent)'
  const convA = await newConv()
  const convB = await newConv()
  const steps: StepResult[] = []
  const bugs: string[] = []

  // Interleaved: A starts order, B joins, A uses name with "hi", A completes
  const flow: { conv: string; label: string; msg: string; checkIntent: string; checkStep: string | null | undefined }[] = [
    { conv: convA, label: 'A', msg: 'Ноутбук байна уу?',           checkIntent: 'product_search',   checkStep: undefined },
    { conv: convA, label: 'A', msg: '1',                            checkIntent: 'order_collection', checkStep: undefined },
    { conv: convB, label: 'B', msg: 'Сайн байна уу',               checkIntent: 'greeting',         checkStep: undefined },
    { conv: convA, label: 'A', msg: 'Khishigbayar',                 checkIntent: 'order_collection', checkStep: 'info' },
    { conv: convB, label: 'B', msg: 'Чихэвч хэд вэ?',             checkIntent: 'product_search',   checkStep: undefined }, // price_info or product_search both OK
    { conv: convA, label: 'A', msg: '99001122',                     checkIntent: 'order_collection', checkStep: undefined },
    { conv: convA, label: 'A', msg: 'СБД 3-р хороо Жанжин 15',    checkIntent: 'order_collection', checkStep: 'confirming' },
    { conv: convA, label: 'A', msg: 'Тийм',                        checkIntent: 'order_created',    checkStep: null },
    { conv: convB, label: 'B', msg: 'Арьсан цүнх байна уу?',      checkIntent: 'product_search',   checkStep: undefined },
  ]

  for (let i = 0; i < flow.length; i++) {
    const { conv, label, msg, checkIntent, checkStep } = flow[i]
    const r = await chat(conv, msg)
    const reply = (r.response ?? r.reply ?? r.error ?? '').substring(0, 70)
    const intentOk = r.intent === checkIntent
    const stepOk = checkStep === undefined ? true : r.order_step === checkStep
    const pass = intentOk && stepOk
    if (!pass) bugs.push(`Step ${i + 1} Cust-${label} "${msg}": intent=${r.intent} step=${r.order_step} (expected ${checkIntent}/${checkStep ?? 'any'})`)
    steps.push({ step: i + 1, msg: `[${label}] ${msg}`, intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass, note: `Cust-${label}` })
  }

  // B's state should be unaffected by A
  const stateB = await getConvState(convB)
  const bIndependent = stateB.draft === null
  if (!bIndependent) bugs.push(`B's order state was contaminated by A: draft=${stateB.draft}`)

  await cleanup(convA)
  await cleanup(convB)
  return { name, passed: steps.filter(s => s.pass).length, total: steps.length, steps, bugs }
}

// ── SIM 6: Latin Transliteration ─────────────────────────────────────────────

async function sim6(): Promise<SimResult> {
  const name = 'SIM 6: Latin Transliteration'
  const conv = await newConv()
  const steps: StepResult[] = []
  const bugs: string[] = []

  const flow = [
    { msg: 'sain baina uu',           checkIntent: 'greeting',         note: 'Latin greeting' },
    { msg: 'tsunk bga uu',            checkIntent: 'product_search',   note: 'Latin product search' },
    { msg: '1',                       checkIntent: 'order_collection', note: 'Select product' },
    { msg: 'avya',                    checkIntent: 'order_collection', note: 'Latin order word' },
    { msg: 'Gerel 99001122',          checkIntent: 'order_collection', note: 'Name + phone' },
    { msg: 'HUD 5 horoo',             checkIntent: 'order_collection', note: 'Latin address' },
    { msg: 'tiim',                    checkIntent: 'order_created',    note: 'Latin confirm' },
  ]

  for (let i = 0; i < flow.length; i++) {
    const { msg, checkIntent, note } = flow[i]
    const r = await chat(conv, msg)
    const reply = (r.response ?? r.reply ?? r.error ?? '').substring(0, 80)
    const pass = r.intent === checkIntent
    if (!pass) bugs.push(`Step ${i + 1} (${note}): intent=${r.intent} (expected ${checkIntent})`)
    steps.push({ step: i + 1, msg, intent: r.intent ?? '?', order_step: r.order_step ?? null, reply, pass, note })
  }

  await cleanup(conv)
  return { name, passed: steps.filter(s => s.pass).length, total: steps.length, steps, bugs }
}

// ── Reporter ──────────────────────────────────────────────────────────────────

function report(sim: SimResult) {
  const ok = sim.passed === sim.total
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`🎭 ${sim.name}`)
  console.log(`   ${sim.passed}/${sim.total} steps passed ${ok ? '✅' : '🔴'}`)
  for (const s of sim.steps) {
    const icon = s.pass ? '✅' : '🔴'
    console.log(`   ${s.step}. ${icon} [${s.intent}/${s.order_step ?? '-'}] "${s.msg.substring(0, 30)}" → ${s.reply.substring(0, 60)}`)
  }
  if (sim.bugs.length > 0) {
    console.log(`   Bugs:`)
    for (const b of sim.bugs) console.log(`     🐛 ${b}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎭 TEMUULEL SIMULATION RUNNER')
  console.log(`   Target: ${BASE}`)
  console.log(`   Store:  ${STORE}`)
  console.log(`   Time:   ${new Date().toISOString()}`)

  // Run sequentially to avoid rate limiting (prod: 20 req/min per IP)
  const sims: SimResult[] = []
  for (const fn of [sim1, sim2, sim3, sim4, sim5, sim6]) {
    try {
      sims.push(await fn())
    } catch (e) {
      sims.push({ name: fn.name, passed: 0, total: 1, steps: [], bugs: [String(e)] })
    }
    await sleep(2000) // extra pause between sims
  }

  for (const s of sims) report(s)

  const totalPassed = sims.reduce((a, s) => a + s.passed, 0)
  const totalSteps  = sims.reduce((a, s) => a + s.total, 0)
  const allBugs     = sims.flatMap(s => s.bugs)

  console.log(`\n${'═'.repeat(60)}`)
  console.log('📊 SUMMARY')
  console.log(`   Total steps: ${totalPassed}/${totalSteps}`)
  console.log(`   Simulations: ${sims.filter(s => s.passed === s.total).length}/${sims.length} fully passing`)
  if (allBugs.length === 0) {
    console.log('   🏆 ZERO BUGS — all simulations passed!')
  } else {
    console.log(`   🐛 ${allBugs.length} bug(s) found:`)
    for (const b of allBugs) console.log(`     • ${b}`)
  }
}

main().catch(console.error)
