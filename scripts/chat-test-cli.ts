#!/usr/bin/env npx tsx
/**
 * Interactive CLI Chat Test Bot
 *
 * Terminal дээр customer шиг чатлаад, AI agent-ийн хариуг real-time харна.
 * Intent, confidence, response, latency бүгдийг харуулна.
 *
 * Usage:
 *   npx tsx scripts/chat-test-cli.ts
 *   npx tsx scripts/chat-test-cli.ts --store "Монгол Маркет"
 *
 * Commands:
 *   /new     - Шинэ conversation эхлүүлэх
 *   /state   - Одоогийн conversation state харах
 *   /metrics - Бүх metrics харах
 *   /export  - Conversation-г JSON файлд хадгалах
 *   /quit    - Гарах
 */

import { createClient } from '@supabase/supabase-js'
import { processAIChat } from '../src/lib/chat-ai-handler'
import { readState } from '../src/lib/conversation-state'
import { hybridClassify } from '../src/lib/ai/hybrid-classifier'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ──
// --prod flag: use production DB
const isProd = process.argv.includes('--prod')
let SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
let SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

if (isProd) {
  // Load from .env.production.local
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
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
}

interface ChatLog {
  timestamp: string
  message: string
  intent: string
  confidence: number
  response: string
  latency_ms: number
  products_found: number
  orderStep: string | null
  bugs: string[]
}

// ── State ──
let storeId = ''
let storeName = ''
let customerId: string | null = null
let conversationId = ''
let chatLogs: ChatLog[] = []
let totalMessages = 0
let bugCount = 0

async function findStore(name?: string): Promise<{ id: string; name: string }> {
  if (name) {
    const { data } = await supabase.from('stores').select('id, name').ilike('name', `%${name}%`).limit(1).single()
    if (data) return data
  }
  // Default: first store with products
  const { data } = await supabase.from('stores').select('id, name').limit(1).single()
  if (!data) throw new Error('No stores found. Run: npx tsx scripts/seed-local.ts')
  return data
}

async function findCustomer(sid: string): Promise<string | null> {
  const { data } = await supabase.from('customers').select('id').eq('store_id', sid).limit(1).single()
  return data?.id ?? null
}

function newConversation() {
  conversationId = crypto.randomUUID()
  chatLogs = []
  console.log(`\n${c.cyan}━━━ Шинэ conversation: ${conversationId.slice(0, 8)}... ━━━${c.reset}\n`)
}

async function initConversation() {
  await supabase.from('conversations').upsert({
    id: conversationId,
    store_id: storeId,
    customer_id: customerId,
    channel: 'web',
    status: 'active',
  }, { onConflict: 'id', ignoreDuplicates: true })
}

function detectBugs(message: string, intent: string, response: string): string[] {
  const bugs: string[] = []
  const rLow = response.toLowerCase()
  const mLow = message.toLowerCase()

  // Bug: Internal instructions leaked to customer
  if (/захиалга авахдаа|борлуулалтын скрипт|📌|🗣️/.test(response)) {
    bugs.push('🐛 INTERNAL_LEAK: Дотоод зааварчилгаа customer-д харагдаж байна')
  }

  // Bug: "байхгүй" when products were found
  if (/байхгүй/.test(rLow) && intent === 'product_search') {
    bugs.push('⚠️ FALSE_NEGATIVE: Product search хийсэн ч "байхгүй" гэж хариулж байна')
  }

  // Bug: Asking for selection when customer already selected
  if (/дугаараа бичнэ үү|аль нэгийг авмаар/.test(rLow) && /авъя|awya|авах|awah|авии/i.test(mLow)) {
    bugs.push('⚠️ REDUNDANT_SELECTION: Customer аль хэдийн сонгосон, дахин асууж байна')
  }

  // Bug: False escalation
  if (/менежер.*холбогдоно|хүлээн авлаа.*түр хүлээнэ/.test(rLow) && !/гомдол|complaint|муу|буруу/i.test(mLow)) {
    bugs.push('🐛 FALSE_ESCALATION: Энгийн мессежийг escalation руу шилжүүлж байна')
  }

  // Bug: Robot-like response
  if (/өөр юугаар тусалах вэ\?/.test(rLow)) {
    bugs.push('⚠️ ROBOT_RESPONSE: Робот маягийн хариулт')
  }

  // Bug: Empty or very short response
  if (response.trim().length < 10) {
    bugs.push('🐛 EMPTY_RESPONSE: Хариулт хоосон эсвэл хэт богино')
  }

  return bugs
}

function confidenceBar(conf: number): string {
  const pct = Math.round(conf * 100)
  if (pct >= 80) return `${c.bgGreen}${c.bold} ${pct}% ${c.reset}`
  if (pct >= 50) return `${c.bgYellow}${c.bold} ${pct}% ${c.reset}`
  return `${c.bgRed}${c.bold} ${pct}% ${c.reset}`
}

async function sendMessage(message: string) {
  // Save customer message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    content: message,
    is_from_customer: true,
    is_ai_response: false,
  })

  // Keyword/ML classify (sync, free)
  const kwResult = hybridClassify(message)

  // Process through full AI pipeline
  const start = performance.now()
  const result = await processAIChat(supabase, {
    conversationId,
    customerMessage: message,
    storeId,
    storeName,
    customerId,
    chatbotSettings: {},
  })
  const latency = Math.round(performance.now() - start)

  // Detect bugs
  const bugs = detectBugs(message, result.intent, result.response)
  bugCount += bugs.length

  // Log
  const log: ChatLog = {
    timestamp: new Date().toISOString(),
    message,
    intent: result.intent,
    confidence: kwResult.confidence,
    response: result.response,
    latency_ms: latency,
    products_found: result.metadata.products_found,
    orderStep: result.orderStep ?? null,
    bugs,
  }
  chatLogs.push(log)
  totalMessages++

  // Display
  console.log()
  console.log(`${c.gray}┌─ Intent: ${c.yellow}${result.intent}${c.reset} ${confidenceBar(kwResult.confidence)} ${c.gray}│ Latency: ${latency}ms │ Products: ${result.metadata.products_found}${result.orderStep ? ` │ Order: ${result.orderStep}` : ''}${c.reset}`)
  console.log(`${c.gray}│${c.reset}`)

  // Response (wrapped)
  const lines = result.response.split('\n')
  for (const line of lines) {
    console.log(`${c.gray}│${c.reset}  ${c.green}${line}${c.reset}`)
  }

  // Bugs
  if (bugs.length > 0) {
    console.log(`${c.gray}│${c.reset}`)
    for (const bug of bugs) {
      console.log(`${c.gray}│${c.reset}  ${c.red}${bug}${c.reset}`)
    }
  }

  console.log(`${c.gray}└${'─'.repeat(60)}${c.reset}`)
}

async function showState() {
  const state = await readState(supabase, conversationId)
  console.log(`\n${c.cyan}State:${c.reset}`, JSON.stringify(state, null, 2))
}

function showMetrics() {
  console.log(`\n${c.cyan}━━━ Metrics ━━━${c.reset}`)
  console.log(`Messages: ${totalMessages}`)
  console.log(`Bugs found: ${c.red}${bugCount}${c.reset}`)

  if (chatLogs.length > 0) {
    const avgLatency = Math.round(chatLogs.reduce((s, l) => s + l.latency_ms, 0) / chatLogs.length)
    console.log(`Avg latency: ${avgLatency}ms`)

    // Intent distribution
    const intents: Record<string, number> = {}
    for (const l of chatLogs) intents[l.intent] = (intents[l.intent] || 0) + 1
    console.log(`\nIntents:`)
    for (const [k, v] of Object.entries(intents).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`)
    }

    // Bugs summary
    if (bugCount > 0) {
      console.log(`\n${c.red}Bugs:${c.reset}`)
      for (const l of chatLogs) {
        for (const b of l.bugs) {
          console.log(`  "${l.message}" → ${b}`)
        }
      }
    }
  }
}

function exportLogs() {
  const dir = path.join(__dirname, '..', 'tests', 'simulation', 'reports')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filename = `cli-test-${new Date().toISOString().slice(0, 16).replace(/:/g, '-')}.json`
  const filepath = path.join(dir, filename)
  fs.writeFileSync(filepath, JSON.stringify({ store: storeName, logs: chatLogs, bugCount, totalMessages }, null, 2))
  console.log(`\n${c.green}Exported: ${filepath}${c.reset}`)
}

async function main() {
  // Parse args
  const args = process.argv.slice(2)
  const storeArg = args.indexOf('--store') >= 0 ? args[args.indexOf('--store') + 1] : undefined

  console.log(`${c.cyan}${c.bold}`)
  console.log(`  ╔══════════════════════════════════════╗`)
  console.log(`  ║   Temuulel Chat Test Bot 🤖          ║`)
  console.log(`  ║   Customer шиг чатлаад шалгана       ║`)
  console.log(`  ╚══════════════════════════════════════╝`)
  console.log(`${c.reset}`)

  // Find store
  const store = await findStore(storeArg)
  storeId = store.id
  storeName = store.name
  customerId = await findCustomer(storeId)

  console.log(`${c.dim}Store: ${storeName} (${storeId.slice(0, 8)}...)`)
  console.log(`Customer: ${customerId?.slice(0, 8) ?? 'anonymous'}...`)
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`Commands: /new /state /metrics /export /quit${c.reset}\n`)

  newConversation()
  await initConversation()

  // REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.blue}customer>${c.reset} `,
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    if (!input) { rl.prompt(); return }

    try {
      switch (input) {
        case '/quit':
        case '/exit':
        case '/q':
          showMetrics()
          console.log(`\n${c.dim}Баяртай!${c.reset}`)
          process.exit(0)
          break
        case '/new':
          newConversation()
          await initConversation()
          break
        case '/state':
          await showState()
          break
        case '/metrics':
          showMetrics()
          break
        case '/export':
          exportLogs()
          break
        default:
          await sendMessage(input)
      }
    } catch (err) {
      console.error(`${c.red}Error: ${err}${c.reset}`)
    }

    rl.prompt()
  })

  rl.on('close', () => {
    showMetrics()
    process.exit(0)
  })
}

main().catch(console.error)
