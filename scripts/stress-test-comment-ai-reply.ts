#!/usr/bin/env npx tsx
/**
 * REAL comment → AI reply stress test.
 *
 * Unlike stress-test-comment-reply.ts (which only tests rule matching),
 * this test feeds real FB comments through the actual AI reply generator
 * and shows what the AI would respond.
 *
 * Usage: npx tsx scripts/stress-test-comment-ai-reply.ts [--limit=10]
 */

import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const FB_COMMENTS_PATH = "/Users/nyamgerelshijir/Downloads/this_profile's_activity_across_facebook/comments_and_reactions/comments.json"
const STORE_ID = '236636f3-0a44-4f04-aba1-312e00d03166' // Монгол Маркет
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel-app.vercel.app'

const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '10', 10)

function fixEncoding(s: string): string {
  try { return Buffer.from(s, 'latin1').toString('utf-8') } catch { return s }
}

// ── Load real FB comments ────────────────────────────────────────────────────

interface FBData { comments_v2: { data?: { comment?: { comment?: string } }[] }[] }

const raw = JSON.parse(readFileSync(FB_COMMENTS_PATH, 'utf-8')) as FBData
const allComments: string[] = []
for (const entry of raw.comments_v2) {
  const text = entry.data?.[0]?.comment?.comment
  if (text) allComments.push(fixEncoding(text))
}

// Filter comments that look like CUSTOMER questions (not store owner's replies)
// Store owner (GOOD TRADE) comments start with a name tag (e.g. "Батаа Ганаа ...")
const customerLike = allComments.filter(c => {
  // Skip comments that look like store replies to @mentions
  if (/^[А-ЯЁӨҮ][а-яёөү]+\s+[А-ЯЁӨҮ][а-яёөү]+\s/.test(c)) return false // "Name Surname blah"
  if (c.length < 10) return false
  return true
})

console.log(`📊 Total: ${allComments.length}, customer-like: ${customerLike.length}`)

// Sample random
const samples = customerLike.sort(() => Math.random() - 0.5).slice(0, LIMIT)

// ── Run AI reply generation for each ────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const _sb = createClient(SUPABASE_URL, SUPABASE_KEY)

interface TestResult {
  comment: string
  reply: string | null
  intent: string | null
  tokens: number
  ms: number
  error?: string
}

async function generateReply(comment: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const conv_id = crypto.randomUUID()
    // Create a conversation first so chat/widget can find it
    await _sb.from('conversations').insert({ id: conv_id, store_id: STORE_ID, channel: 'web', status: 'active' })

    // Send comment as a customer message via widget API
    const res = await fetch(`${APP_URL}/api/chat/widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_message: comment,
        store_id: STORE_ID,
        conversation_id: conv_id,
      }),
    })
    const data = await res.json() as { response?: string; reply?: string; intent?: string; error?: string }
    const ms = Date.now() - start

    // Cleanup
    await _sb.from('conversations').delete().eq('id', conv_id)

    if (data.error) return { comment, reply: null, intent: null, tokens: 0, ms, error: data.error }
    return {
      comment,
      reply: data.response || data.reply || null,
      intent: data.intent || null,
      tokens: (data.response || data.reply || '').length,
      ms,
    }
  } catch (err) {
    return { comment, reply: null, intent: null, tokens: 0, ms: Date.now() - start, error: err instanceof Error ? err.message : 'unknown' }
  }
}

async function main() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  REAL COMMENT → AI REPLY STRESS TEST (${LIMIT} real comments)`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  const results: TestResult[] = []
  for (let i = 0; i < samples.length; i++) {
    const c = samples[i]
    process.stdout.write(`[${i + 1}/${samples.length}] `)
    const r = await generateReply(c)
    results.push(r)

    console.log(`📥 IN:  "${c.substring(0, 80)}${c.length > 80 ? '...' : ''}"`)
    if (r.error) {
      console.log(`❌ ERR: ${r.error}`)
    } else if (r.reply) {
      console.log(`📤 OUT: [${r.intent}] "${r.reply.substring(0, 100)}${r.reply.length > 100 ? '...' : ''}"`)
    } else {
      console.log(`⚠️  No reply generated`)
    }
    console.log(`⏱️  ${r.ms}ms\n`)

    // Rate limit: 250ms between requests
    await new Promise(r => setTimeout(r, 250))
  }

  // ── Report ───────────────────────────────────────────────────────────────
  const replied = results.filter(r => r.reply && !r.error).length
  const errors = results.filter(r => r.error).length
  const avgMs = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length) : 0
  const avgLen = replied > 0 ? Math.round(results.filter(r => r.reply).reduce((s, r) => s + r.tokens, 0) / replied) : 0

  // Intent distribution
  const intentCount: Record<string, number> = {}
  for (const r of results) {
    if (r.intent) intentCount[r.intent] = (intentCount[r.intent] || 0) + 1
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  SUMMARY`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📈 Reply rate: ${replied}/${results.length} (${((replied / results.length) * 100).toFixed(0)}%)`)
  if (errors > 0) console.log(`❌ Errors: ${errors}`)
  console.log(`⏱️  Avg latency: ${avgMs}ms`)
  console.log(`📏 Avg reply length: ${avgLen} chars`)
  console.log(`🎯 Intents detected:`)
  for (const [intent, count] of Object.entries(intentCount).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${intent}: ${count}`)
  }

  const passThreshold = replied / results.length >= 0.8
  console.log(`\n${passThreshold ? '✅ PASS' : '❌ FAIL'} (threshold: 80% reply rate)`)
  process.exit(passThreshold ? 0 : 1)
}

main()
