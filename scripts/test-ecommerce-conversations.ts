/**
 * Replay the 15 Temuulel e-commerce test conversations through the live API.
 *
 * Usage:
 *   npx tsx scripts/test-ecommerce-conversations.ts [store_id]
 *
 * If store_id is omitted, the script looks up the first ecommerce store
 * from the running Supabase instance.
 *
 * The app must be running: npm run dev
 */

import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000'
const TEST_DATA_PATH =
  process.argv[3] ??
  path.join(
    process.env.HOME ?? '',
    'Downloads/temuulel_ecommerce_test_chats.json',
  )

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  sender: string
  timestamp_ms: number
  content: string
}

interface Conversation {
  conversation_id: string
  scenario: string
  participants: string[]
  messages: Message[]
}

interface TestData {
  test_data_info: { purpose: string }
  conversations: Conversation[]
}

interface TurnResult {
  turn: number
  customer: string
  ai_response: string
  latency_ms: number
  error?: string
}

interface ConversationResult {
  conversation_id: string
  scenario: string
  status: 'pass' | 'fail' | 'partial'
  turns: TurnResult[]
  total_latency_ms: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getStoreId(): Promise<string> {
  const storeId = process.argv[2]
  if (storeId) {
    console.log(`Using provided store_id: ${storeId}`)
    return storeId
  }

  // Try to look up an ecommerce store from the API health + stores endpoint
  // Fall back to asking the user
  console.log('\nNo store_id provided.')
  console.log('Run: npx tsx scripts/test-ecommerce-conversations.ts <store_id>')
  console.log(
    '\nTo find your store_id, log in to the dashboard and copy it from the URL',
  )
  console.log('or from your browser localStorage (supabase.auth.token → store_id).\n')
  process.exit(1)
}

async function sendMessage(
  storeId: string,
  conversationId: string,
  senderId: string,
  message: string,
): Promise<{ reply: string; latency_ms: number; error?: string }> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/api/chat/widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: storeId,
        conversation_id: conversationId,
        sender_id: senderId,
        customer_message: message,
      }),
    })

    const latency_ms = Date.now() - start

    if (!res.ok) {
      const text = await res.text()
      return { reply: '', latency_ms, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json()
    const reply: string = data.reply ?? data.message ?? data.response ?? JSON.stringify(data)
    return { reply, latency_ms }
  } catch (err) {
    return {
      reply: '',
      latency_ms: Date.now() - start,
      error: String(err),
    }
  }
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function truncate(s: string, n = 120): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load test data
  if (!fs.existsSync(TEST_DATA_PATH)) {
    console.error(`❌ Test data not found at: ${TEST_DATA_PATH}`)
    console.error('Pass the path as third argument: npx tsx scripts/test-ecommerce-conversations.ts <store_id> <path>')
    process.exit(1)
  }

  const testData: TestData = JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf-8'))
  const conversations = testData.conversations

  console.log('═'.repeat(70))
  console.log('  TEMUULEL E-COMMERCE CHATBOT — CONVERSATION REPLAY TEST')
  console.log('═'.repeat(70))
  console.log(`  Data file : ${TEST_DATA_PATH}`)
  console.log(`  API       : ${BASE_URL}`)
  console.log(`  Scenarios : ${conversations.length}`)
  console.log('═'.repeat(70))

  // Health check first
  try {
    const health = await fetch(`${BASE_URL}/api/health`)
    if (!health.ok) throw new Error(`Health check failed: ${health.status}`)
    console.log('  ✅ App is healthy\n')
  } catch {
    console.error('  ❌ App not reachable at', BASE_URL)
    console.error('  Run: npm run dev\n')
    process.exit(1)
  }

  const storeId = await getStoreId()

  const results: ConversationResult[] = []

  for (const conv of conversations) {
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`📋 ${conv.conversation_id}: ${conv.scenario}`)
    console.log(`${'─'.repeat(70)}`)

    // Use conversation_id as a stable session id for this replay
    const sessionId = `test-${conv.conversation_id.toLowerCase()}`
    const senderId = `test-sender-${conv.conversation_id.toLowerCase()}`

    // Only send customer messages (TEMUULEL messages are the expected responses)
    const customerMessages = conv.messages.filter(
      m => m.sender !== 'TEMUULEL',
    )

    const turns: TurnResult[] = []
    let convFailed = false

    for (let i = 0; i < customerMessages.length; i++) {
      const msg = customerMessages[i]
      process.stdout.write(`  [${i + 1}/${customerMessages.length}] 👤 ${truncate(msg.content, 60)}`)

      const { reply, latency_ms, error } = await sendMessage(
        storeId,
        sessionId,
        senderId,
        msg.content,
      )

      if (error) {
        console.log(` → ❌ ERROR`)
        console.log(`      ${error}`)
        convFailed = true
        turns.push({ turn: i + 1, customer: msg.content, ai_response: '', latency_ms, error })
      } else {
        console.log(` → ✅ (${formatMs(latency_ms)})`)
        console.log(`      🤖 ${truncate(reply, 100)}`)
        turns.push({ turn: i + 1, customer: msg.content, ai_response: reply, latency_ms })
      }

      // Small delay between turns to avoid rate limiting
      await new Promise(r => setTimeout(r, 300))
    }

    const totalLatency = turns.reduce((s, t) => s + t.latency_ms, 0)
    const errorCount = turns.filter(t => t.error).length
    const status = errorCount === 0 ? 'pass' : errorCount === turns.length ? 'fail' : 'partial'

    console.log(`\n  ⏱  Total: ${formatMs(totalLatency)} | Status: ${status === 'pass' ? '✅ PASS' : status === 'partial' ? '⚠️  PARTIAL' : '❌ FAIL'}`)

    results.push({ conversation_id: conv.conversation_id, scenario: conv.scenario, status, turns, total_latency_ms: totalLatency })
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(70))
  console.log('  SUMMARY')
  console.log('═'.repeat(70))

  const passed = results.filter(r => r.status === 'pass').length
  const partial = results.filter(r => r.status === 'partial').length
  const failed = results.filter(r => r.status === 'fail').length
  const totalTurns = results.reduce((s, r) => s + r.turns.length, 0)
  const avgLatency = results.reduce((s, r) => s + r.total_latency_ms, 0) / results.length

  console.log(`\n  Conversations : ${results.length}`)
  console.log(`  ✅ Pass       : ${passed}`)
  console.log(`  ⚠️  Partial    : ${partial}`)
  console.log(`  ❌ Fail       : ${failed}`)
  console.log(`  Total turns   : ${totalTurns}`)
  console.log(`  Avg latency   : ${formatMs(Math.round(avgLatency))}\n`)

  console.log('  Per-conversation:')
  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'partial' ? '⚠️ ' : '❌'
    const errors = r.turns.filter(t => t.error).length
    const errNote = errors > 0 ? ` (${errors} error${errors > 1 ? 's' : ''})` : ''
    console.log(`  ${icon} ${r.conversation_id.padEnd(12)} ${r.scenario}${errNote}`)
  }

  // ── Save full report ─────────────────────────────────────────────────────────
  const reportPath = path.join(
    path.dirname(TEST_DATA_PATH),
    `temuulel_test_report_${Date.now()}.json`,
  )
  fs.writeFileSync(reportPath, JSON.stringify({ store_id: storeId, timestamp: new Date().toISOString(), summary: { passed, partial, failed, totalTurns, avgLatency }, conversations: results }, null, 2))
  console.log(`\n  📄 Full report saved: ${reportPath}`)
  console.log('═'.repeat(70) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
