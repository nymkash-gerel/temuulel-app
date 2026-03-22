/**
 * test-chaos-customer.ts
 *
 * Chaos testing: simulates 20+ random Mongolian customers hitting the
 * Temuulel chat APIs with realistic multi-turn conversations.
 *
 * For each response it verifies:
 *   - HTTP 200 (no 400/500 errors)
 *   - Non-empty response text
 *   - Response is Mongolian (not raw English error messages)
 *   - Intent matches expectation (when specified)
 *   - No "undefined" / "null" strings in response
 *   - Response length is reasonable
 *   - Order lifecycle verified in DB (when applicable)
 *
 * Usage:
 *   npx tsx scripts/test-chaos-customer.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────

const API = process.env.TEST_API_BASE || 'http://localhost:3000'
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!

if (!SB_URL || !SB_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DELAY_MS = 1500
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepExpectation {
  intent?: string
  intentOneOf?: string[]
  notIntent?: string
  hasProducts?: boolean
  orderStep?: string
  noError?: boolean
}

interface SingleStep {
  msg: string
  expect: StepExpectation
}

interface VerifyFn {
  (supabase: ReturnType<typeof createClient>, storeId: string, conversationId: string): Promise<string | null>
}

interface Scenario {
  name: string
  steps: SingleStep[]
  verify?: VerifyFn
}

interface StepResult {
  stepIndex: number
  message: string
  status: number
  intent: string
  response: string
  productsFound: number
  orderStep: string | null
  pass: boolean
  error?: string
}

interface ScenarioResult {
  name: string
  steps: StepResult[]
  dbCheck?: string | null
  pass: boolean
  bugs: string[]
}

interface ChatResponse {
  conversationId: string | undefined
  status: number
  intent: string
  response: string
  productsFound: number
  orderStep: string | null
  raw: Record<string, unknown>
}

// ─── Store lookup ────────────────────────────────────────────────────────────

let STORE_ID = ''
let STORE_NAME = ''

async function findStore(): Promise<void> {
  // Try to find the test store
  const { data } = await supabase
    .from('stores')
    .select('id, name')
    .limit(10)

  if (!data || data.length === 0) {
    console.error('No stores found in database')
    process.exit(1)
  }

  // Look for common test store names
  const preferred = data.find((s) => s.name === 'Монгол Маркет')
    ?? data.find((s) => s.name?.includes('Монгол'))
    ?? data[0]

  STORE_ID = preferred.id
  STORE_NAME = preferred.name ?? 'Unknown'
  console.log(`  Store: ${STORE_NAME} (${STORE_ID})`)
}

// ─── Chat helper ─────────────────────────────────────────────────────────────

async function chatAsCustomer(
  storeId: string,
  senderId: string,
  message: string,
  conversationId?: string
): Promise<ChatResponse> {
  // 1. Save message via /api/chat
  let convId = conversationId
  try {
    const saveRes = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: senderId,
        store_id: storeId,
        role: 'user',
        content: message,
      }),
    })
    if (saveRes.ok) {
      const saveData = await saveRes.json()
      convId = saveData.conversation_id ?? conversationId
    }
  } catch {
    // Save endpoint failure is not fatal for the widget test
  }

  // 2. Get AI response via /api/chat/widget
  let aiRes: Response
  try {
    aiRes = await fetch(`${API}/api/chat/widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: storeId,
        customer_message: message,
        sender_id: senderId,
        conversation_id: convId,
      }),
    })
  } catch (err) {
    return {
      conversationId: convId,
      status: 0,
      intent: 'network_error',
      response: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      productsFound: 0,
      orderStep: null,
      raw: {},
    }
  }

  const status = aiRes.status
  let aiData: Record<string, unknown> = {}
  try {
    aiData = await aiRes.json()
  } catch {
    aiData = { intent: 'parse_error', response: `HTTP ${status} (unparseable body)` }
  }

  return {
    conversationId: convId,
    status,
    intent: (aiData.intent as string) ?? 'unknown',
    response: (aiData.response as string) ?? '',
    productsFound: (aiData.products_found as number) ?? 0,
    orderStep: (aiData.order_step as string) ?? null,
    raw: aiData,
  }
}

// ─── Response analysis ───────────────────────────────────────────────────────

function analyzeResponse(
  res: ChatResponse,
  expect: StepExpectation
): { pass: boolean; error?: string } {
  // 1. HTTP status
  if (res.status !== 200) {
    if (expect.noError) {
      // We only require no crash, status 400 is "handled"
      if (res.status >= 500) {
        return { pass: false, error: `Server error: HTTP ${res.status}` }
      }
    } else {
      return { pass: false, error: `HTTP ${res.status}` }
    }
  }

  // 2. Non-empty response (skip for edge cases where we only check noError)
  if (!expect.noError && (!res.response || res.response.trim().length === 0)) {
    // handoff intent returns null response — that's OK
    if (res.intent !== 'handoff' && res.intent !== 'disabled') {
      return { pass: false, error: 'Empty response' }
    }
  }

  // 3. No "undefined" or "null" string in response text
  if (res.response) {
    const lower = res.response.toLowerCase()
    if (lower.includes('undefined') && !lower.includes('undefined behavior')) {
      return { pass: false, error: `Response contains "undefined": ${res.response.substring(0, 80)}` }
    }
    if (/\bnull\b/.test(lower) && !lower.includes('null-') && !lower.includes('null character')) {
      return { pass: false, error: `Response contains "null": ${res.response.substring(0, 80)}` }
    }
  }

  // 4. Check response is not raw English error (unless it's a known English-ok intent)
  if (res.response && res.intent !== 'handoff' && res.intent !== 'disabled') {
    const ENGLISH_ERROR_PATTERNS = [
      /^Internal Server Error$/i,
      /^Something went wrong$/i,
      /^Error:/i,
      /^Failed to/i,
      /^Cannot /i,
    ]
    for (const pat of ENGLISH_ERROR_PATTERNS) {
      if (pat.test(res.response.trim())) {
        return { pass: false, error: `English error response: "${res.response.substring(0, 60)}"` }
      }
    }
  }

  // 5. Intent checks
  if (expect.intent && res.intent !== expect.intent) {
    // Allow close matches: e.g., 'order_collection' when we expected 'product_search'
    // but only report as bug if it's a clear mismatch
    return { pass: false, error: `Intent mismatch: expected "${expect.intent}", got "${res.intent}"` }
  }

  if (expect.intentOneOf && !expect.intentOneOf.includes(res.intent)) {
    return {
      pass: false,
      error: `Intent mismatch: expected one of [${expect.intentOneOf.join(', ')}], got "${res.intent}"`,
    }
  }

  if (expect.notIntent && res.intent === expect.notIntent) {
    return { pass: false, error: `Intent MUST NOT be "${expect.notIntent}" but it was` }
  }

  // 6. Product check
  if (expect.hasProducts === true && res.productsFound === 0) {
    // Only flag if we specifically expected products
    return { pass: false, error: 'Expected products in response but got 0' }
  }

  // 7. Order step check
  if (expect.orderStep && res.orderStep !== expect.orderStep) {
    return { pass: false, error: `Order step: expected "${expect.orderStep}", got "${res.orderStep}"` }
  }

  // 8. Response length sanity
  if (res.response && res.response.length > 5000) {
    return { pass: false, error: `Response suspiciously long: ${res.response.length} chars` }
  }

  return { pass: true }
}

// ─── Scenario definitions ────────────────────────────────────────────────────

const PRODUCT_QUERIES: Scenario[] = [
  {
    name: 'Product search: Ноутбук',
    steps: [{ msg: 'Ноутбук байна уу?', expect: { intent: 'product_search' } }],
  },
  {
    name: 'Product search: cheapest item',
    steps: [{ msg: 'Хамгийн хямд бараа юу байна?', expect: { intent: 'product_search' } }],
  },
  {
    name: 'Price inquiry: shirt',
    steps: [{ msg: 'Цамц хэд вэ?', expect: { intentOneOf: ['product_search', 'price_info'] } }],
  },
  {
    name: 'Product search: AirPods',
    steps: [{ msg: 'AirPods байна уу?', expect: { intent: 'product_search' } }],
  },
  {
    name: 'Product search: show all',
    steps: [{ msg: 'Бүх барааг харуулаач', expect: { intent: 'product_search' } }],
  },
  {
    name: 'Product search: earphones',
    steps: [{ msg: 'Гар утасны чихэвч', expect: { intent: 'product_search' } }],
  },
  {
    name: 'Product search: black bag',
    steps: [{ msg: 'Хар өнгийн цүнх', expect: { intent: 'product_search' } }],
  },
]

const SIZE_QUERIES: Scenario[] = [
  {
    name: 'Size info: body weight',
    steps: [{ msg: '57кг биетэй, ямар хэмжээ тохирох вэ?', expect: { intent: 'size_info' } }],
  },
  {
    name: 'Size info: L size available',
    steps: [{ msg: 'L хэмжээ байна уу?', expect: { intentOneOf: ['size_info', 'product_search'] } }],
  },
  {
    name: 'Size info: XL available',
    steps: [{ msg: 'XL хэмжээтэй юу байна?', expect: { intentOneOf: ['size_info', 'product_search'] } }],
  },
  {
    name: 'Size info: kids size',
    steps: [{ msg: 'Хүүхдийн хэмжээ бий юу?', expect: { intentOneOf: ['product_search', 'size_info'] } }],
  },
]

const ORDER_FLOWS: Scenario[] = [
  {
    name: 'Happy path order',
    steps: [
      { msg: 'Цамц байна уу?', expect: { intent: 'product_search' } },
      { msg: '1', expect: { intentOneOf: ['order_collection', 'product_search'] } },
      { msg: 'Болд', expect: { notIntent: 'greeting' } },
      { msg: '99001122', expect: {} },
      { msg: 'СБД 1-р хороо 5-р байр', expect: {} },
      { msg: 'Тийм', expect: {} },
    ],
    verify: async (sb, storeId, conversationId) => {
      // Check conversation state for order_draft being null (order completed)
      const { data } = await sb
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()
      const meta = data?.metadata as Record<string, unknown> | null
      const cs = meta?.conversation_state as Record<string, unknown> | null
      if (cs?.order_draft) {
        return 'Order draft still exists after confirmation — order may not have been created'
      }
      return null
    },
  },
  {
    name: 'Order with name containing "hi" (regression)',
    steps: [
      { msg: 'Чихэвч байна уу?', expect: { intent: 'product_search' } },
      { msg: '1', expect: { intentOneOf: ['order_collection', 'product_search'] } },
      { msg: 'Shinebayar', expect: { notIntent: 'greeting' } },
      { msg: '88001122', expect: {} },
      { msg: 'ХУД 3-р хороо 8-р байр', expect: {} },
      { msg: 'За', expect: {} },
    ],
    verify: async (sb, _storeId, conversationId) => {
      const { data } = await sb
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()
      const meta = data?.metadata as Record<string, unknown> | null
      const cs = meta?.conversation_state as Record<string, unknown> | null
      if (cs?.order_draft) {
        return 'Order draft still exists — "Shinebayar" may have reset the order flow'
      }
      return null
    },
  },
  {
    name: 'Order with "Мэндбаяр" name (contains "мэнд")',
    steps: [
      { msg: 'Пүүз байна уу?', expect: { intent: 'product_search' } },
      { msg: '1', expect: { intentOneOf: ['order_collection', 'product_search'] } },
      { msg: 'Мэндбаяр', expect: { notIntent: 'greeting' } },
      { msg: '77001122', expect: {} },
      { msg: 'БГД 2-р хороо 15-р байр', expect: {} },
      { msg: 'Тийм', expect: {} },
    ],
  },
]

const COMPLAINT_FLOWS: Scenario[] = [
  {
    name: 'Angry customer escalation',
    steps: [
      { msg: 'Захиалга маань хаана явж байна?', expect: { intent: 'order_status' } },
      { msg: 'Яагаад ийм удаан байгаа юм!?', expect: { intentOneOf: ['complaint', 'order_status'] } },
      { msg: 'Мөнгөө буцааж өг!!!', expect: { intentOneOf: ['complaint', 'return_exchange'] } },
    ],
    verify: async (sb, _storeId, conversationId) => {
      const { data } = await sb
        .from('conversations')
        .select('escalation_score, escalation_level')
        .eq('id', conversationId)
        .single()
      // escalation_score should have increased
      if (data && (data.escalation_score ?? 0) === 0 && !data.escalation_level) {
        return 'Escalation score is 0 after repeated complaints — escalation not tracked'
      }
      return null
    },
  },
  {
    name: 'Product quality complaint',
    steps: [
      { msg: 'Чанар муу байна', expect: { intent: 'complaint' } },
      { msg: 'Хариуцлага алга юм шиг', expect: { intentOneOf: ['complaint', 'general'] } },
    ],
  },
]

const CANCEL_FLOWS: Scenario[] = [
  {
    name: 'Cancel mid-order (negative phrase)',
    steps: [
      { msg: 'Ноутбук байна уу?', expect: { intent: 'product_search' } },
      { msg: '1', expect: { intentOneOf: ['order_collection', 'product_search'] } },
      { msg: 'Захиалаагүй ээ', expect: {} },
    ],
    verify: async (sb, _storeId, conversationId) => {
      const { data } = await sb
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()
      const meta = data?.metadata as Record<string, unknown> | null
      const cs = meta?.conversation_state as Record<string, unknown> | null
      if (cs?.order_draft) {
        return 'Order draft still exists after cancellation phrase'
      }
      return null
    },
  },
  {
    name: 'Cancel then new search',
    steps: [
      { msg: 'Цаг байна уу?', expect: { intent: 'product_search' } },
      { msg: '1', expect: { intentOneOf: ['order_collection', 'product_search'] } },
      { msg: 'Болихоо', expect: {} },
      { msg: 'Цүнх байна уу?', expect: { intent: 'product_search' } },
    ],
  },
]

const EDGE_CASES: Scenario[] = [
  {
    name: 'Edge: empty message',
    steps: [{ msg: '', expect: { noError: true } }],
  },
  {
    name: 'Edge: emoji only',
    steps: [{ msg: '\u{1F600}\u{1F600}\u{1F600}', expect: { noError: true } }],
  },
  {
    name: 'Edge: gibberish',
    steps: [{ msg: 'asdfghjkl', expect: { noError: true } }],
  },
  {
    name: 'Edge: very long message',
    steps: [{ msg: '1'.repeat(3000), expect: { noError: true } }],
  },
  {
    name: 'Edge: SQL injection attempt',
    steps: [{ msg: 'DROP TABLE orders;', expect: { noError: true } }],
  },
  {
    name: 'Edge: XSS attempt',
    steps: [{ msg: '<script>alert(1)</script>', expect: { noError: true } }],
  },
  {
    name: 'Edge: standalone phone number',
    steps: [{ msg: '99112233', expect: { noError: true } }],
  },
  {
    name: 'Edge: repeated greeting',
    steps: [
      {
        msg: 'Сайн байна уу Сайн байна уу Сайн байна уу',
        expect: { intent: 'greeting' },
      },
    ],
  },
]

const RETURN_FLOWS: Scenario[] = [
  {
    name: 'Wrong size return request',
    steps: [
      { msg: 'Хэмжээ тохирохгүй байна', expect: { intent: 'return_exchange' } },
      { msg: 'M захиалсан L ирсэн', expect: { intentOneOf: ['return_exchange', 'size_info', 'complaint'] } },
      { msg: 'Солиулж болох уу?', expect: { intentOneOf: ['return_exchange', 'general'] } },
    ],
  },
  {
    name: 'Refund demand',
    steps: [
      { msg: 'Бараа буцааж өгмөөр байна', expect: { intentOneOf: ['return_exchange', 'complaint'] } },
      { msg: 'Буцаалтын нөхцөл юу вэ?', expect: { intentOneOf: ['return_exchange', 'general'] } },
    ],
  },
]

const GREETING_SCENARIOS: Scenario[] = [
  {
    name: 'Greeting: Сайн байна уу',
    steps: [{ msg: 'Сайн байна уу', expect: { intent: 'greeting' } }],
  },
  {
    name: 'Greeting: сайн уу',
    steps: [{ msg: 'сайн уу', expect: { intent: 'greeting' } }],
  },
  {
    name: 'Greeting: hello',
    steps: [{ msg: 'hello', expect: { intent: 'greeting' } }],
  },
  {
    name: 'Greeting: hi',
    steps: [{ msg: 'hi', expect: { intent: 'greeting' } }],
  },
  {
    name: 'Greeting: Мэнд',
    steps: [{ msg: 'Мэнд', expect: { intent: 'greeting' } }],
  },
  {
    name: 'Greeting: sain baina uu (Latin)',
    steps: [{ msg: 'sain baina uu', expect: { intent: 'greeting' } }],
  },
]

const SHIPPING_SCENARIOS: Scenario[] = [
  {
    name: 'Shipping: delivery time',
    steps: [
      { msg: 'Хүргэлт хэдэн өдөр болдог вэ?', expect: { intent: 'shipping' } },
    ],
  },
  {
    name: 'Shipping: delivery fee',
    steps: [
      { msg: 'Хүргэлтийн үнэ хэд вэ?', expect: { intent: 'shipping' } },
    ],
  },
]

const PAYMENT_SCENARIOS: Scenario[] = [
  {
    name: 'Payment: how to pay',
    steps: [
      { msg: 'Яаж төлөх вэ?', expect: { intent: 'payment' } },
    ],
  },
  {
    name: 'Payment: QPay available',
    steps: [
      { msg: 'QPay-аар төлж болох уу?', expect: { intent: 'payment' } },
    ],
  },
]

const MULTI_TURN_SEARCH: Scenario[] = [
  {
    name: 'Multi-turn: browse then ask price',
    steps: [
      { msg: 'Юу бараа байна?', expect: { intent: 'product_search' } },
      { msg: 'Хэд вэ?', expect: { intentOneOf: ['price_info', 'product_search'] } },
    ],
  },
  {
    name: 'Multi-turn: search then greeting',
    steps: [
      { msg: 'Бараа харуулна уу?', expect: { intent: 'product_search' } },
      { msg: 'Баярлалаа', expect: { intentOneOf: ['thanks', 'greeting'] } },
    ],
  },
]

// ─── All scenarios pool ──────────────────────────────────────────────────────

const ALL_SCENARIOS: Scenario[] = [
  ...PRODUCT_QUERIES,
  ...SIZE_QUERIES,
  ...ORDER_FLOWS,
  ...COMPLAINT_FLOWS,
  ...CANCEL_FLOWS,
  ...EDGE_CASES,
  ...RETURN_FLOWS,
  ...GREETING_SCENARIOS,
  ...SHIPPING_SCENARIOS,
  ...PAYMENT_SCENARIOS,
  ...MULTI_TURN_SEARCH,
]

// ─── Shuffle ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

const testSenderIds: string[] = []
const testConversationIds: string[] = []

async function cleanup(): Promise<void> {
  console.log('\n  Cleaning up test data...')

  // Delete test conversations
  if (testConversationIds.length > 0) {
    // Delete messages first (FK constraint)
    for (const convId of testConversationIds) {
      await supabase.from('messages').delete().eq('conversation_id', convId)
    }
    // Delete conversations
    await supabase.from('conversations').delete().in('id', testConversationIds)
  }

  // Delete test customers
  if (testSenderIds.length > 0) {
    for (const sid of testSenderIds) {
      await supabase.from('customers').delete().eq('messenger_id', sid).eq('store_id', STORE_ID)
    }
  }

  console.log(`  Cleaned ${testConversationIds.length} conversations, ${testSenderIds.length} customers`)
}

// ─── Run a single scenario ───────────────────────────────────────────────────

async function runScenario(
  scenario: Scenario,
  scenarioIndex: number,
  totalScenarios: number
): Promise<ScenarioResult> {
  const ts = Date.now()
  const senderId = `web_chaos_${ts}_${scenarioIndex}`
  testSenderIds.push(senderId)

  const result: ScenarioResult = {
    name: scenario.name,
    steps: [],
    pass: true,
    bugs: [],
  }

  let conversationId: string | undefined

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i]

    // Delay between requests
    if (i > 0) await delay(DELAY_MS)

    const res = await chatAsCustomer(STORE_ID, senderId, step.msg, conversationId)
    conversationId = res.conversationId

    if (conversationId && !testConversationIds.includes(conversationId)) {
      testConversationIds.push(conversationId)
    }

    const analysis = analyzeResponse(res, step.expect)

    const stepResult: StepResult = {
      stepIndex: i + 1,
      message: step.msg.length > 50 ? step.msg.substring(0, 47) + '...' : step.msg,
      status: res.status,
      intent: res.intent,
      response: res.response.substring(0, 100).replace(/\n/g, ' '),
      productsFound: res.productsFound,
      orderStep: res.orderStep,
      pass: analysis.pass,
      error: analysis.error,
    }

    result.steps.push(stepResult)

    if (!analysis.pass) {
      result.pass = false
      result.bugs.push(
        `Step ${i + 1}: "${step.msg}" - ${analysis.error}`
      )
    }
  }

  // DB verification
  if (scenario.verify && conversationId) {
    await delay(500) // Wait for async DB writes
    try {
      const dbError = await scenario.verify(supabase, STORE_ID, conversationId)
      result.dbCheck = dbError
      if (dbError) {
        result.pass = false
        result.bugs.push(`DB Check: ${dbError}`)
      }
    } catch (err) {
      const errMsg = `DB verify error: ${err instanceof Error ? err.message : String(err)}`
      result.dbCheck = errMsg
      result.pass = false
      result.bugs.push(errMsg)
    }
  }

  return result
}

// ─── Output formatting ──────────────────────────────────────────────────────

function printScenarioResult(result: ScenarioResult, index: number): void {
  const icon = result.pass ? '\u2705' : '\u{1F534}'
  console.log(`\n\u{1F4CB} Scenario ${index + 1}: ${result.name}`)

  for (const step of result.steps) {
    const stepIcon = step.pass ? '\u2705' : '\u{1F534}'
    let line = `  Step ${step.stepIndex}: "${step.message}" \u2192 ${stepIcon} ${step.intent}`
    if (step.productsFound > 0) line += `, ${step.productsFound} products`
    if (step.orderStep) line += `, step=${step.orderStep}`
    console.log(line)
    if (!step.pass && step.error) {
      console.log(`    \u{1F41B} BUG: ${step.error}`)
    }
  }

  if (result.dbCheck !== undefined && result.dbCheck !== null) {
    console.log(`  DB Check: \u{1F534} ${result.dbCheck}`)
  } else if (result.dbCheck === null) {
    console.log(`  DB Check: \u2705 Verified`)
  }

  console.log(`  Result: ${icon} ${result.pass ? 'PASS' : 'FAIL'}`)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now()
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  console.log(`\n\u{1F916} CHAOS CUSTOMER TEST \u2014 ${now}`)
  console.log('\u2501'.repeat(50))

  await findStore()

  // Shuffle and pick scenarios (all of them)
  const scenarios = shuffle(ALL_SCENARIOS)
  console.log(`\n  Running ${scenarios.length} random scenarios...\n`)
  console.log('\u2501'.repeat(50))

  const results: ScenarioResult[] = []
  let completed = 0

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]
    completed++
    process.stdout.write(
      `\r  Progress: ${completed}/${scenarios.length} (${scenario.name.substring(0, 40)}...)          `
    )

    try {
      const result = await runScenario(scenario, i, scenarios.length)
      results.push(result)
    } catch (err) {
      results.push({
        name: scenario.name,
        steps: [],
        pass: false,
        bugs: [`Runtime error: ${err instanceof Error ? err.message : String(err)}`],
      })
    }

    // Delay between scenarios
    if (i < scenarios.length - 1) await delay(DELAY_MS)
  }

  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(80) + '\r')

  // Print results
  console.log('\n\u2501'.repeat(50))
  console.log('  DETAILED RESULTS')
  console.log('\u2501'.repeat(50))

  for (let i = 0; i < results.length; i++) {
    printScenarioResult(results[i], i)
  }

  // Summary
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  const allBugs = results.flatMap((r) => r.bugs.map((b) => ({ scenario: r.name, bug: b })))

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n' + '\u2501'.repeat(50))
  console.log(`  SUMMARY: ${passed}/${results.length} passed, ${failed} bugs found (${elapsed}s)`)
  console.log('\u2501'.repeat(50))

  if (allBugs.length > 0) {
    console.log('\n\u{1F534} BUGS FOUND:')
    allBugs.forEach((b, i) => {
      console.log(`  ${i + 1}. [${b.scenario}] ${b.bug}`)
    })
  } else {
    console.log('\n\u2705 All scenarios passed!')
  }

  // Cleanup
  try {
    await cleanup()
  } catch (err) {
    console.error('  Cleanup error:', err instanceof Error ? err.message : String(err))
  }

  console.log('')

  // Exit code
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err)
  cleanup().catch(() => {}).finally(() => process.exit(2))
})
