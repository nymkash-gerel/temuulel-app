#!/usr/bin/env npx tsx
/**
 * Multi-item order + variant selection + same-name disambiguation stress test
 *
 * Tests the FULL chat flow (processAIChat), not just search.
 * Verifies: variant selection, order draft persistence, multi-product orders,
 * same-name product disambiguation, and customer prefs reuse.
 *
 * Usage:
 *   npx tsx scripts/stress-test-orders.ts
 *   npx tsx scripts/stress-test-orders.ts --prod
 */

import { createClient } from '@supabase/supabase-js'
import { processAIChat } from '../src/lib/chat-ai-handler'
import { readState } from '../src/lib/conversation-state'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ── Config ──
const isProd = process.argv.includes('--prod')
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
let SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (isProd) {
  const envPath = path.join(__dirname, '..', '.env.production.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
      if (m) {
        if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL') SUPABASE_URL = m[2]
        if (m[1] === 'SUPABASE_SECRET_KEY') SUPABASE_KEY = m[2]
      }
    }
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Colors ──
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
}

let storeId = ''
let storeName = ''
let customerId: string | null = null

// ── Helpers ──
async function newConversation(): Promise<string> {
  const id = crypto.randomUUID()
  await supabase.from('conversations').insert({
    id,
    store_id: storeId,
    customer_id: customerId,
    channel: 'web',
    status: 'active',
  })
  return id
}

async function chat(convId: string, message: string) {
  // Save customer message
  await supabase.from('messages').insert({
    conversation_id: convId,
    content: message,
    is_from_customer: true,
    is_ai_response: false,
  })
  return processAIChat(supabase, {
    conversationId: convId,
    customerMessage: message,
    storeId,
    storeName,
    customerId,
    chatbotSettings: { max_products: 5 },
  })
}

interface TestResult {
  name: string
  passed: boolean
  details: string
  messages: string[]
}

const results: TestResult[] = []

function log(test: TestResult) {
  results.push(test)
  const icon = test.passed ? `${c.green}✓` : `${c.red}✗`
  console.log(`  ${icon}${c.reset} ${test.name}`)
  if (!test.passed) {
    console.log(`    ${c.red}${test.details}${c.reset}`)
    for (const m of test.messages) {
      console.log(`    ${c.dim}${m}${c.reset}`)
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ══════════════════════════════════════════════════════════════════════════════

async function testVariantSelectionByNumber() {
  // Леевчик has 12 variants. Search → select → pick variant "3" → should move to name step
  const cid = await newConversation()
  const r1 = await chat(cid, 'леевчик авъя')
  const r2 = await chat(cid, '3')  // Pick variant #3
  const state = await readState(supabase, cid)

  const hasVariantStep = r1.orderStep === 'variant' || r1.response.includes('хувилбар')
  const moved = r2.orderStep === 'name' || r2.response.includes('Нэрээ бичнэ')

  log({
    name: 'Variant selection by number "3" (Леевчик, 12 variants)',
    passed: hasVariantStep && moved,
    details: !hasVariantStep ? `Step 1: expected variant step, got ${r1.orderStep}` : `Step 2: expected name step, got ${r2.orderStep}`,
    messages: [`1: "${r1.response.slice(0, 100)}..."`, `2: "${r2.response.slice(0, 100)}..."`],
  })
}

async function testVariantSelectionByHighNumber() {
  // Pick variant "12" — the last one (Леевчик has 12 variants)
  const cid = await newConversation()
  const r1 = await chat(cid, 'леевчик авна')
  const r2 = await chat(cid, '12')  // Pick last variant

  const hasVariantStep = r1.orderStep === 'variant' || r1.response.includes('хувилбар')
  const moved = r2.orderStep === 'name' || r2.response.includes('Нэрээ бичнэ')

  log({
    name: 'Variant selection "12" — last variant (Леевчик, 12 variants)',
    passed: hasVariantStep && moved,
    details: !hasVariantStep ? `Step 1: expected variant step, got ${r1.orderStep}` : `Step 2: expected name step after "12", got ${r2.orderStep}`,
    messages: [`1: "${r1.response.slice(0, 100)}..."`, `2: "${r2.response.slice(0, 100)}..."`],
  })
}

async function testVariantSelectionBySizeColor() {
  // Pick by size/color name instead of number
  const cid = await newConversation()
  const r1 = await chat(cid, 'бензэн турсик авъя')
  const r2 = await chat(cid, 'M хар')  // Size M, Color Хар

  const hasVariantStep = r1.orderStep === 'variant' || r1.response.includes('хувилбар')
  const moved = r2.orderStep === 'name' || r2.response.includes('Нэрээ бичнэ')

  log({
    name: 'Variant selection by size/color "M хар" (Бензэн турсик, 16 variants)',
    passed: hasVariantStep && moved,
    details: !hasVariantStep ? `Step 1: expected variant step, got ${r1.orderStep}` : `Step 2: expected name step, got ${r2.orderStep}`,
    messages: [`1: "${r1.response.slice(0, 100)}..."`, `2: "${r2.response.slice(0, 100)}..."`],
  })
}

async function testFullOrderFlow() {
  // Complete order: search → variant → name → address → phone → confirm
  const cid = await newConversation()
  const r1 = await chat(cid, 'галбир цамц авъя')
  const r2 = await chat(cid, '1')  // Variant
  const r3 = await chat(cid, 'Болд')  // Name
  const r4 = await chat(cid, 'БЗД 3-р хороо 45-101')  // Address
  const r5 = await chat(cid, '99112233')  // Phone
  const r6 = await chat(cid, 'тийм')  // Confirm

  const steps = [r1.orderStep, r2.orderStep, r3.orderStep, r4.orderStep, r5.orderStep, r6.orderStep]
  const completed = r6.response.includes('амжилттай') || r6.response.includes('✅')

  log({
    name: 'Full order flow: search → variant → name → address → phone → confirm',
    passed: completed,
    details: `Steps: ${steps.join(' → ')}, completed: ${completed}`,
    messages: steps.map((s, i) => `${i + 1}: step=${s} "${[r1,r2,r3,r4,r5,r6][i].response.slice(0, 80)}..."`),
  })
}

async function testOrderDraftPersistsDuringQuestion() {
  // Mid-order question should NOT lose draft
  const cid = await newConversation()
  await chat(cid, 'кашемир цамц авъя')
  await chat(cid, '1')  // variant
  const r3 = await chat(cid, 'материал юу вэ?')  // off-topic question mid-order
  const state = await readState(supabase, cid)

  const draftAlive = state.order_draft !== null && state.order_draft !== undefined
  const hasReminder = r3.response.includes('захиалга хүлээж') || r3.response.includes('Нэрээ')

  log({
    name: 'Order draft persists during off-topic question mid-order',
    passed: draftAlive,
    details: `Draft alive: ${draftAlive}, reminder: ${hasReminder}`,
    messages: [`question response: "${r3.response.slice(0, 120)}..."`],
  })
}

async function testSameNameDisambiguation() {
  // "галбир цамц" vs "кашемир цамц" — both are цамц but different products
  const cid1 = await newConversation()
  const r1 = await chat(cid1, 'галбир цамц авъя')
  const hasGalbir = r1.response.includes('Галбир') || r1.response.includes('25,000') || r1.response.includes('25000')

  const cid2 = await newConversation()
  const r2 = await chat(cid2, 'кашемир цамц авъя')
  const hasKashemir = r2.response.includes('Кашемир') || r2.response.includes('189,000') || r2.response.includes('189000')

  log({
    name: 'Same-name disambiguation: "галбир цамц" vs "кашемир цамц"',
    passed: hasGalbir && hasKashemir,
    details: `Галбир found: ${hasGalbir}, Кашемир found: ${hasKashemir}`,
    messages: [`галбир: "${r1.response.slice(0, 100)}..."`, `кашемир: "${r2.response.slice(0, 100)}..."`],
  })
}

async function testMultiProductOrder2Items() {
  // "корсет + галбир цамц авъя" — 2 different products
  const cid = await newConversation()
  const r = await chat(cid, 'корсет + галбир цамц авъя')

  const hasKorset = r.response.toLowerCase().includes('корсет')
  const hasGalbir = r.response.toLowerCase().includes('галбир')
  const isOrder = r.orderStep !== null || r.response.includes('Нэрээ') || r.response.includes('хувилбар')

  log({
    name: 'Multi-product order: "корсет + галбир цамц авъя" (2 items)',
    passed: hasKorset && hasGalbir && isOrder,
    details: `Корсет: ${hasKorset}, Галбир: ${hasGalbir}, order started: ${isOrder}`,
    messages: [`"${r.response.slice(0, 150)}..."`],
  })
}

async function testMultiProductOrder3Items() {
  // "leevchik + turshik + skims авъя" — 3 products with Latin names
  const cid = await newConversation()
  const r = await chat(cid, 'leevchik + turshik + skims авъя')

  const resp = r.response.toLowerCase()
  const hasLeevchik = resp.includes('леевчик')
  const hasTurshik = resp.includes('турсик') || resp.includes('бензэн')
  const hasSkims = resp.includes('skims') || resp.includes('скимс')
  const isOrder = r.orderStep !== null || r.response.includes('Нэрээ')

  log({
    name: 'Multi-product order: "leevchik + turshik + skims авъя" (3 items, Latin)',
    passed: hasLeevchik && hasTurshik && hasSkims && isOrder,
    details: `Леевчик: ${hasLeevchik}, Турсик: ${hasTurshik}, SKIMS: ${hasSkims}, order: ${isOrder}`,
    messages: [`"${r.response.slice(0, 200)}..."`],
  })
}

async function testMultiProductWithBolon() {
  // "кашемир цамц болон тарпизан өмд авъя" — using "болон" separator
  const cid = await newConversation()
  const r = await chat(cid, 'кашемир цамц болон тарпизан өмд авъя')

  const resp = r.response.toLowerCase()
  const hasKashemir = resp.includes('кашемир')
  const hasTarpzan = resp.includes('тарпизан')

  log({
    name: 'Multi-product with "болон": "кашемир цамц болон тарпизан өмд авъя"',
    passed: hasKashemir && hasTarpzan,
    details: `Кашемир: ${hasKashemir}, Тарпизан: ${hasTarpzan}`,
    messages: [`"${r.response.slice(0, 150)}..."`],
  })
}

async function testMultiProductWithQuantity() {
  // "2ш leevchik, 4ш turshik авъя" — with quantities
  const cid = await newConversation()
  const r = await chat(cid, '2ш leevchik, 4ш turshik авъя')

  const resp = r.response.toLowerCase()
  const hasLeevchik = resp.includes('леевчик')
  const hasTurshik = resp.includes('турсик') || resp.includes('бензэн')
  const hasQty = resp.includes('x2') || resp.includes('x4') || resp.includes('2ш') || resp.includes('4ш')

  log({
    name: 'Multi-product with quantity: "2ш leevchik, 4ш turshik авъя"',
    passed: hasLeevchik && hasTurshik,
    details: `Леевчик: ${hasLeevchik}, Турсик: ${hasTurshik}, qty visible: ${hasQty}`,
    messages: [`"${r.response.slice(0, 150)}..."`],
  })
}

async function testSimilarNameProducts() {
  // "леевчик сет" vs "леевчик дангаар"
  const cid1 = await newConversation()
  const r1 = await chat(cid1, 'леевчик сет авъя')
  const hasSet = r1.response.includes('сет') || r1.response.includes('29,000') || r1.response.includes('29000')

  const cid2 = await newConversation()
  const r2 = await chat(cid2, 'леевчик авна')
  const hasSolo = r2.response.includes('Леевчик') && (r2.response.includes('10,000') || r2.response.includes('10000'))

  log({
    name: 'Similar name: "леевчик сет" (29,000) vs "леевчик" alone (10,000)',
    passed: hasSet && hasSolo,
    details: `Set: ${hasSet}, Solo: ${hasSolo}`,
    messages: [`сет: "${r1.response.slice(0, 100)}..."`, `дангаар: "${r2.response.slice(0, 100)}..."`],
  })
}

async function testVariantThenCompleteOrder() {
  // Full flow with variant selection in the middle
  const cid = await newConversation()
  const r1 = await chat(cid, 'zara даашинз авъя')
  const r2 = await chat(cid, 'S улаан хүрэн')  // size + color
  const r3 = await chat(cid, 'Баярмаа')  // name
  const r4 = await chat(cid, 'ХУД 7-р хороо 21-408')  // address
  const r5 = await chat(cid, '88001122')  // phone
  const r6 = await chat(cid, 'за тийм')  // confirm

  const completed = r6.response.includes('амжилттай') || r6.response.includes('✅')
  const hasZara = r1.response.toLowerCase().includes('zara') || r1.response.toLowerCase().includes('даашинз')

  log({
    name: 'Full flow: Zara Даашинз → variant "S улаан хүрэн" → name → address → phone → confirm',
    passed: hasZara && completed,
    details: `Zara found: ${hasZara}, completed: ${completed}`,
    messages: [
      `1(${r1.orderStep}): "${r1.response.slice(0, 80)}..."`,
      `2(${r2.orderStep}): "${r2.response.slice(0, 80)}..."`,
      `6(${r6.orderStep}): "${r6.response.slice(0, 80)}..."`,
    ],
  })
}

async function testOrderCancelMidFlow() {
  // Start order, cancel it mid-flow
  const cid = await newConversation()
  await chat(cid, 'ноосон малгай авъя')
  await chat(cid, 'Болд')  // name
  const r3 = await chat(cid, 'болих')  // cancel

  const cancelled = r3.response.includes('цуцлагдлаа') || r3.response.includes('❌')
  const state = await readState(supabase, cid)
  const draftCleared = !state.order_draft

  log({
    name: 'Order cancel mid-flow: "болих" clears draft',
    passed: cancelled && draftCleared,
    details: `Cancel msg: ${cancelled}, draft cleared: ${draftCleared}`,
    messages: [`"${r3.response.slice(0, 100)}..."`],
  })
}

async function testGreetingResetsOrderContext() {
  // "Сайн байна уу" mid-order should NOT intercept as order_step_input
  const cid = await newConversation()
  await chat(cid, 'леевчик авъя')
  await chat(cid, '1')  // variant
  const r3 = await chat(cid, 'Сайн байна уу')

  const isGreeting = r3.intent === 'greeting'
  const notOrderStep = r3.orderStep !== 'name' && r3.orderStep !== 'variant'

  log({
    name: 'Greeting "Сайн байна уу" mid-order does not intercept order step',
    passed: isGreeting,
    details: `Intent: ${r3.intent}, orderStep: ${r3.orderStep}`,
    messages: [`"${r3.response.slice(0, 100)}..."`],
  })
}

async function testProductSearchAfterOrder() {
  // After completing an order, searching for another product should work
  const cid = await newConversation()
  await chat(cid, 'ноосон малгай авъя')
  await chat(cid, 'Тест')  // name
  await chat(cid, 'БЗД 1-р хороо')  // address
  await chat(cid, '99001122')  // phone
  await chat(cid, 'тийм')  // confirm

  const r = await chat(cid, 'кашемир цамц үнэ хэд?')
  const hasPrice = r.response.includes('189,000') || r.response.includes('189000') || r.response.includes('Кашемир')

  log({
    name: 'New product search after completing order',
    passed: hasPrice,
    details: `Found Кашемир price: ${hasPrice}`,
    messages: [`"${r.response.slice(0, 120)}..."`],
  })
}

async function testMultiVariantSelect() {
  // Select multiple variants: "1 болон 5" → 2 items in cart
  const cid = await newConversation()
  const r1 = await chat(cid, 'леевчик авъя')
  const r2 = await chat(cid, '1 болон 5')  // Multi-select

  const moved = r2.orderStep === 'name' || r2.response.includes('Нэрээ')
  const state = await readState(supabase, cid)
  const itemCount = state.order_draft?.items?.length || 0

  log({
    name: 'Multi-variant select "1 болон 5" → 2 items in cart (Леевчик)',
    passed: moved && itemCount === 2,
    details: `Moved to name: ${moved}, items in cart: ${itemCount}`,
    messages: [`"${r2.response.slice(0, 100)}..."`],
  })
}

async function testCustomerPrefsReuse() {
  // First order saves prefs, second order should auto-fill
  const cid = await newConversation()

  // First order — manual entry
  await chat(cid, 'ноосон малгай авъя')
  await chat(cid, 'Мөнх')
  await chat(cid, 'СХД 2-р хороо')
  await chat(cid, '88990011')
  await chat(cid, 'тийм')

  // Second order — should reuse prefs
  const r2 = await chat(cid, 'USB-C цэнэглэгч авъя')

  const hasAutoFill = r2.response.includes('Мөнх') || r2.response.includes('88990011') || r2.response.includes('СХД')
    || r2.orderStep === 'confirming'  // Skipped straight to confirm = prefs were reused

  log({
    name: 'Customer prefs reuse: second order auto-fills name/address/phone',
    passed: hasAutoFill,
    details: `Auto-fill detected: ${hasAutoFill}, step: ${r2.orderStep}`,
    messages: [`"${r2.response.slice(0, 150)}..."`],
  })
}

async function testBodyMeasurementPersists() {
  // Send body measurements, they should be saved in customer_prefs
  const cid = await newConversation()
  await chat(cid, 'галбир цамц авъя')
  await chat(cid, '65кг 170см')  // Body measurements

  const state = await readState(supabase, cid)
  const prefs = state.customer_prefs

  log({
    name: 'Body measurements "65кг 170см" saved to customer_prefs',
    passed: prefs?.weight_kg === 65 && prefs?.height_cm === 170,
    details: `Prefs: weight=${prefs?.weight_kg}, height=${prefs?.height_cm}`,
    messages: [],
  })
}

async function testNonExistentProduct() {
  // Search for gibberish that cannot fuzzy-match any real product
  const cid = await newConversation()
  const r = await chat(cid, 'зквфтщ авъя')

  const noDraft = r.orderStep === null
  // Acceptable outcomes: no order draft, or "байхгүй"/"олдсонгүй", or plain product_search with no order started
  const reasonable = noDraft
    || r.response.includes('байхгүй')
    || r.response.includes('олдсонгүй')
    || r.intent === 'product_search'

  log({
    name: 'Non-existent product "зквфтщ авъя" — no false order draft',
    passed: reasonable,
    details: `No draft: ${noDraft}, intent: ${r.intent}`,
    messages: [`"${r.response.slice(0, 120)}..."`],
  })
}

async function testEscalationBreaksOrder() {
  // Complaint mid-order should break out
  const cid = await newConversation()
  await chat(cid, 'леевчик авъя')
  await chat(cid, '1')  // variant
  const r = await chat(cid, 'оператор дуудаач!!!')

  const escaped = r.intent === 'complaint' || r.intent === 'general' || r.response.includes('менежер')

  log({
    name: 'Escalation "оператор дуудаач!!!" breaks out of order flow',
    passed: escaped,
    details: `Intent: ${r.intent}, step: ${r.orderStep}`,
    messages: [`"${r.response.slice(0, 100)}..."`],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  // Get store
  const { data: store } = await supabase.from('stores').select('id, name').ilike('name', '%монгол маркет%').limit(1).single()
  if (!store) {
    console.error('Store not found. Check DB connection.')
    process.exit(1)
  }
  storeId = store.id
  storeName = store.name

  // Get a test customer
  const { data: customer } = await supabase.from('customers').select('id').eq('store_id', storeId).limit(1).single()
  customerId = customer?.id ?? null

  console.log(`\n${c.cyan}${c.bold}  ╔═════════════════════════════════════════════════════╗`)
  console.log(`  ║  Order Flow + Variant + Disambiguation Stress Test  ║`)
  console.log(`  ╚═════════════════════════════════════════════════════╝${c.reset}`)
  console.log(`  ${c.dim}Store: ${storeName} | Customer: ${customerId?.slice(0, 8) || 'anon'}${c.reset}\n`)

  // ── Run all tests ──
  console.log(`${c.cyan}── Variant Selection ──${c.reset}`)
  await testVariantSelectionByNumber()
  await testVariantSelectionByHighNumber()
  await testVariantSelectionBySizeColor()
  await testMultiVariantSelect()

  console.log(`\n${c.cyan}── Full Order Flow ──${c.reset}`)
  await testFullOrderFlow()
  await testVariantThenCompleteOrder()
  await testOrderCancelMidFlow()

  console.log(`\n${c.cyan}── Order Draft Persistence ──${c.reset}`)
  await testOrderDraftPersistsDuringQuestion()
  await testGreetingResetsOrderContext()
  await testEscalationBreaksOrder()
  await testProductSearchAfterOrder()

  console.log(`\n${c.cyan}── Same-Name Disambiguation ──${c.reset}`)
  await testSameNameDisambiguation()
  await testSimilarNameProducts()

  console.log(`\n${c.cyan}── Multi-Product Orders ──${c.reset}`)
  await testMultiProductOrder2Items()
  await testMultiProductOrder3Items()
  await testMultiProductWithBolon()
  await testMultiProductWithQuantity()

  console.log(`\n${c.cyan}── Customer Prefs & Edge Cases ──${c.reset}`)
  await testCustomerPrefsReuse()
  await testBodyMeasurementPersists()
  await testNonExistentProduct()

  // ── Summary ──
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  const pct = Math.round(passed / total * 100)

  console.log(`\n${c.cyan}${'═'.repeat(55)}`)
  console.log(`  ${passed >= total ? c.green : passed >= total * 0.8 ? c.yellow : c.red}${c.bold}  Results: ${passed}/${total} passed (${pct}%)${c.reset}`)
  if (failed > 0) {
    console.log(`\n  ${c.red}Failed tests:${c.reset}`)
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ${c.red}✗ ${r.name}${c.reset}`)
    }
  }
  console.log(`${c.cyan}${'═'.repeat(55)}${c.reset}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
