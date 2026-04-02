#!/usr/bin/env npx tsx
/**
 * FB Message Replay Audit
 *
 * Бодит FB customer мессежүүдийг AI agent руу илгээж,
 * хариуг автоматаар шалгаж, bug report гаргана.
 *
 * Usage:
 *   npx tsx scripts/replay-fb-audit.ts --prod --store "монгол маркет"
 *   npx tsx scripts/replay-fb-audit.ts --prod --limit 200
 *   npx tsx scripts/replay-fb-audit.ts --prod --intent product_search
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { processAIChat } from '../src/lib/chat-ai-handler'
import * as fs from 'fs'
import * as path from 'path'

// ── Colors ──
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m', magenta: '\x1b[35m',
}

// ── Config ──
const args = process.argv.slice(2)
const isProd = args.includes('--prod')
const limitArg = args.indexOf('--limit') >= 0 ? parseInt(args[args.indexOf('--limit') + 1]) : 500
const intentFilter = args.indexOf('--intent') >= 0 ? args[args.indexOf('--intent') + 1] : undefined
const storeArg = args.indexOf('--store') >= 0 ? args[args.indexOf('--store') + 1] : undefined

function loadEnv(): { url: string; key: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
  let key = process.env.SUPABASE_SECRET_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

  if (isProd) {
    const envPath = path.join(__dirname, '..', '.env.production.local')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)="?([^"]+)"?$/)
        if (m) {
          if (m[1] === 'NEXT_PUBLIC_SUPABASE_URL') url = m[2]
          if (m[1] === 'SUPABASE_SECRET_KEY') key = m[2]
        }
      }
    }
  }
  return { url, key }
}

// ── Bug Detection ──
interface Bug {
  type: string
  severity: 'critical' | 'warning' | 'info'
  description: string
}

function detectBugs(message: string, intent: string, response: string): Bug[] {
  const bugs: Bug[] = []
  const r = response.toLowerCase()
  const m = message.toLowerCase()

  // CRITICAL: Internal instructions leaked
  if (/захиалга авахдаа|борлуулалтын скрипт|хэрэглэгч.*асуувал|санал болго|зөвлөж өг/.test(response)) {
    bugs.push({ type: 'INTERNAL_LEAK', severity: 'critical', description: 'Дотоод зааварчилгаа customer-д харагдаж байна' })
  }

  // CRITICAL: Empty/broken response
  if (response.trim().length < 5) {
    bugs.push({ type: 'EMPTY_RESPONSE', severity: 'critical', description: `Хариулт хоосон: "${response}"` })
  }

  // CRITICAL: False escalation on normal message
  if (/менежер.*холбогдоно|түр хүлээнэ үү/.test(r) && !/гомдол|муу|буруу|complaint|!!!/i.test(m)) {
    bugs.push({ type: 'FALSE_ESCALATION', severity: 'critical', description: 'Энгийн мессежийг escalation руу шилжүүлсэн' })
  }

  // WARNING: "байхгүй" without suggesting alternatives
  if (/байхгүй/.test(r) && intent === 'product_search' && !/таалагдаж магадгүй|эдгээр|санал болгож/.test(r)) {
    bugs.push({ type: 'FALSE_OOS', severity: 'warning', description: '"Байхгүй" гэж хариулсан — ижил бараа санал болгоогүй' })
  }

  // WARNING: Redundant selection ask — but not when customer asks about address/shipping
  if (/дугаараа бичнэ үү|аль нэгийг сонирхвол/.test(r) && /авъя|awya|авах|awah|авии|avo/i.test(m) && !/хаяг|hayag|очиж|очих|утас/i.test(m)) {
    bugs.push({ type: 'REDUNDANT_SELECTION', severity: 'warning', description: 'Customer сонгосон ч дахин сонголт асууж байна' })
  }

  // WARNING: Robot-like response
  if (/өөр юугаар тусалах вэ\?/.test(r)) {
    bugs.push({ type: 'ROBOT_RESPONSE', severity: 'warning', description: 'Робот маягийн хариулт' })
  }

  // WARNING: AI/chatbot identity revealed
  if (/хиймэл оюун|chatbot|AI туслах|bi bol AI/.test(r)) {
    bugs.push({ type: 'AI_IDENTITY_LEAK', severity: 'warning', description: 'AI/chatbot гэдгээ илчилсэн' })
  }

  // INFO: Very long response (>500 chars)
  if (response.length > 500) {
    bugs.push({ type: 'LONG_RESPONSE', severity: 'info', description: `Хариулт хэт урт: ${response.length} chars` })
  }

  // WARNING: Response in wrong language
  if (/[a-zA-Z]{20,}/.test(response) && !/https?:\/\//.test(response)) {
    bugs.push({ type: 'WRONG_LANGUAGE', severity: 'warning', description: 'Англи хэлээр хариулж байна' })
  }

  return bugs
}

// ── Load Messages ──
const sourceArg = args.indexOf('--source') >= 0 ? args[args.indexOf('--source') + 1] : undefined

function loadMessages(): { text: string; intent: string; scenario?: string }[] {
  // --source stress / stress2 / all-stress → use stress test messages
  if (sourceArg?.startsWith('stress')) {
    const files: string[] = []
    if (sourceArg === 'stress' || sourceArg === 'all-stress') files.push('stress-test-messages.jsonl')
    if (sourceArg === 'stress2' || sourceArg === 'all-stress') files.push('stress-test-v2.jsonl')
    const all: { text: string; intent: string; scenario?: string }[] = []
    for (const file of files) {
      const p = path.join(__dirname, file)
      if (fs.existsSync(p)) {
        console.log(`${c.dim}Loading: ${file}${c.reset}`)
        const lines = fs.readFileSync(p, 'utf-8').trim().split('\n')
        all.push(...lines.map(l => JSON.parse(l)))
      }
    }
    if (all.length > 0) return all
  }

  const paths = [
    path.join(__dirname, 'fb-self-labeled.jsonl'),
    path.join(__dirname, '..', '.claude', 'worktrees', 'mystifying-payne', 'scripts', 'fb-self-labeled.jsonl'),
    path.join(__dirname, 'fb-raw-messages.jsonl'),
    path.join(__dirname, '..', '.claude', 'worktrees', 'mystifying-payne', 'scripts', 'fb-raw-messages.jsonl'),
  ]

  for (const p of paths) {
    if (fs.existsSync(p)) {
      console.log(`${c.dim}Loading: ${path.basename(p)}${c.reset}`)
      const lines = fs.readFileSync(p, 'utf-8').trim().split('\n')
      return lines.map(l => {
        const d = JSON.parse(l)
        return { text: d.text, intent: d.intent || 'unknown' }
      })
    }
  }
  throw new Error('FB message files not found')
}

// ── Main ──
async function main() {
  console.log(`${c.cyan}${c.bold}`)
  console.log(`  ╔══════════════════════════════════════╗`)
  console.log(`  ║   FB Replay Audit 🔍                 ║`)
  console.log(`  ║   Бодит мессеж → AI → Bug detect     ║`)
  console.log(`  ╚══════════════════════════════════════╝`)
  console.log(`${c.reset}`)

  // Setup
  const { url, key } = loadEnv()
  const supabase = createClient(url, key)
  console.log(`${c.dim}DB: ${url}${c.reset}`)

  // Find store
  let storeId = ''
  let storeName = ''
  if (storeArg) {
    const { data } = await supabase.from('stores').select('id, name').ilike('name', `%${storeArg}%`).limit(1).single()
    if (data) { storeId = data.id; storeName = data.name }
  }
  if (!storeId) {
    const { data } = await supabase.from('stores').select('id, name').limit(1).single()
    if (data) { storeId = data.id; storeName = data.name }
  }
  if (!storeId) throw new Error('Store not found')

  const { data: custData } = await supabase.from('customers').select('id').eq('store_id', storeId).limit(1).single()
  const customerId = custData?.id ?? null

  console.log(`${c.dim}Store: ${storeName} | Limit: ${limitArg}${intentFilter ? ` | Intent: ${intentFilter}` : ''}${c.reset}\n`)

  // Load messages
  let messages = loadMessages()
  if (intentFilter) {
    messages = messages.filter(m => m.intent === intentFilter)
  }
  // Shuffle for variety, then limit
  messages = messages.sort(() => Math.random() - 0.5).slice(0, limitArg)

  console.log(`${c.cyan}Replaying ${messages.length} messages...${c.reset}\n`)

  // Stats
  const stats = {
    total: 0,
    bugs: { critical: 0, warning: 0, info: 0 },
    intents: {} as Record<string, number>,
    avgLatency: 0,
    totalLatency: 0,
    bugDetails: [] as { message: string; response: string; bugs: Bug[] }[],
    errorCount: 0,
  }

  // Process messages
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const conversationId = crypto.randomUUID()

    // Create conversation
    await supabase.from('conversations').upsert({
      id: conversationId, store_id: storeId,
      customer_id: customerId, channel: 'audit', status: 'active',
    }, { onConflict: 'id', ignoreDuplicates: true })

    // Save message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: msg.text, is_from_customer: true, is_ai_response: false,
    })

    try {
      const start = performance.now()
      const result = await processAIChat(supabase, {
        conversationId, customerMessage: msg.text,
        storeId, storeName, customerId, chatbotSettings: {},
      })
      const latency = Math.round(performance.now() - start)

      stats.total++
      stats.totalLatency += latency
      stats.intents[result.intent] = (stats.intents[result.intent] || 0) + 1

      // Bug detection
      const bugs = detectBugs(msg.text, result.intent, result.response)

      // Intent mismatch detection (for stress test with expected intents)
      if (msg.intent && msg.intent !== 'unknown' && result.intent !== msg.intent) {
        // Allow some flexible mappings
        const flexMap: Record<string, string[]> = {
          'order_collection': ['product_search', 'order_status', 'shipping'],
          'product_search': ['order_collection', 'size_info', 'greeting', 'thanks'],
          'complaint': ['order_status', 'return_exchange', 'order_collection'],
          'order_status': ['complaint', 'order_collection', 'shipping'],
          'general': ['greeting', 'thanks', 'product_search'],
          'greeting': ['general', 'product_search', 'size_info', 'shipping'],
          'shipping': ['order_collection', 'size_info', 'product_search', 'general'],
          'size_info': ['product_search', 'order_collection', 'general'],
          'thanks': ['general', 'order_collection', 'greeting'],
          'payment': ['product_search', 'order_collection'],
        }
        const allowed = flexMap[msg.intent] || []
        if (!allowed.includes(result.intent)) {
          bugs.push({
            type: 'INTENT_MISMATCH',
            severity: 'warning',
            description: `Expected: ${msg.intent}, Got: ${result.intent}${msg.scenario ? ` [${msg.scenario}]` : ''}`,
          })
        }
      }

      for (const bug of bugs) {
        stats.bugs[bug.severity]++
      }

      if (bugs.length > 0) {
        stats.bugDetails.push({ message: msg.text, response: result.response, bugs })
      }

      // Progress display
      const bugStr = bugs.length > 0
        ? ` ${c.red}← ${bugs.map(b => b.type).join(', ')}${c.reset}`
        : ''
      const pct = Math.round((i + 1) / messages.length * 100)
      process.stdout.write(`\r  [${pct}%] ${i + 1}/${messages.length} | 🐛 ${stats.bugs.critical}C ${stats.bugs.warning}W | ${latency}ms${bugStr}${''.padEnd(20)}`)

    } catch (err) {
      stats.errorCount++
      process.stdout.write(`\r  [${Math.round((i + 1) / messages.length * 100)}%] ${i + 1}/${messages.length} | ❌ Error`)
    }

    // Cleanup conversation
    await supabase.from('messages').delete().eq('conversation_id', conversationId)
    await supabase.from('conversations').delete().eq('id', conversationId)
  }

  // ── Report ──
  stats.avgLatency = Math.round(stats.totalLatency / (stats.total || 1))
  console.log(`\n\n${c.cyan}${'═'.repeat(60)}`)
  console.log(`  FB REPLAY AUDIT REPORT`)
  console.log(`${'═'.repeat(60)}${c.reset}\n`)

  console.log(`  Messages tested: ${c.bold}${stats.total}${c.reset}`)
  console.log(`  Avg latency: ${stats.avgLatency}ms`)
  console.log(`  Errors: ${stats.errorCount}`)
  console.log()

  // Bug summary
  const totalBugs = stats.bugs.critical + stats.bugs.warning + stats.bugs.info
  if (totalBugs === 0) {
    console.log(`  ${c.green}${c.bold}✅ 0 bugs found!${c.reset}`)
  } else {
    console.log(`  ${c.red}🐛 Bugs: ${totalBugs}${c.reset}`)
    if (stats.bugs.critical > 0) console.log(`    ${c.red}CRITICAL: ${stats.bugs.critical}${c.reset}`)
    if (stats.bugs.warning > 0) console.log(`    ${c.yellow}WARNING: ${stats.bugs.warning}${c.reset}`)
    if (stats.bugs.info > 0) console.log(`    ${c.dim}INFO: ${stats.bugs.info}${c.reset}`)
  }

  // Intent distribution
  console.log(`\n  Intent distribution:`)
  for (const [k, v] of Object.entries(stats.intents).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(v / stats.total * 40))
    console.log(`    ${k.padEnd(20)} ${String(v).padStart(4)} ${c.cyan}${bar}${c.reset}`)
  }

  // Bug details (grouped by type)
  if (stats.bugDetails.length > 0) {
    console.log(`\n${c.red}${'─'.repeat(60)}`)
    console.log(`  BUG DETAILS`)
    console.log(`${'─'.repeat(60)}${c.reset}\n`)

    // Group by bug type
    const byType: Record<string, { message: string; response: string; severity: string }[]> = {}
    for (const bd of stats.bugDetails) {
      for (const bug of bd.bugs) {
        if (!byType[bug.type]) byType[bug.type] = []
        byType[bug.type].push({ message: bd.message, response: bd.response.slice(0, 100), severity: bug.severity })
      }
    }

    for (const [type, items] of Object.entries(byType)) {
      const sev = items[0].severity === 'critical' ? c.red : items[0].severity === 'warning' ? c.yellow : c.dim
      console.log(`  ${sev}${type}${c.reset} (${items.length}x):`)
      // Show first 5 examples
      for (const item of items.slice(0, 5)) {
        console.log(`    ${c.dim}MSG:${c.reset} "${item.message}"`)
        console.log(`    ${c.dim}RSP:${c.reset} "${item.response}..."`)
        console.log()
      }
      if (items.length > 5) {
        console.log(`    ${c.dim}...+${items.length - 5} more${c.reset}\n`)
      }
    }
  }

  // Save report
  const reportDir = path.join(__dirname, '..', 'tests', 'simulation', 'reports')
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
  const reportFile = path.join(reportDir, `fb-audit-${new Date().toISOString().slice(0, 10)}.json`)
  fs.writeFileSync(reportFile, JSON.stringify({
    date: new Date().toISOString(),
    store: storeName,
    messagesTotal: stats.total,
    avgLatency: stats.avgLatency,
    bugs: stats.bugs,
    bugDetails: stats.bugDetails,
    intents: stats.intents,
  }, null, 2))
  console.log(`\n  ${c.dim}Report saved: ${reportFile}${c.reset}`)

  // Exit code
  if (stats.bugs.critical > 0) {
    console.log(`\n  ${c.red}❌ FAILED: ${stats.bugs.critical} critical bugs${c.reset}`)
    process.exit(1)
  }
  console.log(`\n  ${c.green}Done!${c.reset}`)
}

main().catch(err => {
  console.error(`${c.red}Fatal: ${err}${c.reset}`)
  process.exit(1)
})
