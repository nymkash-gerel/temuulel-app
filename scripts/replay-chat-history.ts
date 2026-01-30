/**
 * Replay real chat history through the follow-up detection & intent classification system.
 * Fetches conversations from Supabase, then simulates each turn through resolveFollowUp + classifyIntentWithConfidence.
 *
 * Usage: npx tsx scripts/replay-chat-history.ts
 */

import { createClient } from '@supabase/supabase-js'
import { resolveFollowUp, updateState, emptyState, StoredProduct } from '../src/lib/conversation-state'
import { classifyIntentWithConfidence, normalizeText } from '../src/lib/chat-ai'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NDg4OTQwMn0.X26octhVMTYp_6BNhrkoF74JEfKQAjV56tlnTddg5gJI0yokvBWPiNm8qZ5OXGR51IorHB2TIN7nM8ggFx0MkA'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface Message {
  content: string
  is_from_customer: boolean
  is_ai_response: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

interface Conversation {
  id: string
  status: string
  metadata: Record<string, unknown> | null
  store_id: string
}

async function main() {
  // Fetch recent conversations
  const { data: convos, error: cErr } = await supabase
    .from('conversations')
    .select('id, status, metadata, store_id')
    .order('updated_at', { ascending: false })
    .limit(15)

  if (cErr) {
    console.error('Error fetching conversations:', cErr.message)
    return
  }

  if (!convos || convos.length === 0) {
    console.log('No conversations found in database.')
    return
  }

  console.log(`Found ${convos.length} conversations. Replaying...\n`)

  let totalTurns = 0
  let matchedFollowUps = 0
  let missedFollowUps = 0
  const issues: string[] = []

  for (const conv of convos as Conversation[]) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('content, is_from_customer, is_ai_response, metadata, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (!msgs || msgs.length === 0) continue

    const customerMsgs = (msgs as Message[]).filter(m => m.is_from_customer)
    if (customerMsgs.length === 0) continue

    console.log('═'.repeat(80))
    console.log(`Conversation: ${conv.id.slice(0, 8)}... | Status: ${conv.status} | Messages: ${msgs.length} (${customerMsgs.length} customer)`)
    console.log('─'.repeat(80))

    // Simulate conversation state through all turns
    let state = emptyState()

    for (const msg of msgs as Message[]) {
      if (msg.is_from_customer) {
        totalTurns++

        // Run our follow-up detection
        const followUp = resolveFollowUp(msg.content, state)
        const { intent, confidence } = classifyIntentWithConfidence(msg.content)
        const normalized = normalizeText(msg.content)

        // What the original system recorded
        const originalIntent = (msg.metadata as Record<string, unknown>)?.intent as string || 'unknown'

        const followUpStr = followUp
          ? `followUp=${followUp.type}${followUp.contextTopic ? `(${followUp.contextTopic})` : ''}${followUp.product ? `→${followUp.product.name}` : ''}`
          : 'followUp=none'

        const intentStr = `intent=${intent}(${confidence.toFixed(1)})`
        const origStr = originalIntent !== 'unknown' ? ` [was: ${originalIntent}]` : ''

        console.log(`  👤 "${msg.content}"`)
        console.log(`     → ${followUpStr} | ${intentStr}${origStr}`)
        console.log(`     → normalized: "${normalized}"`)

        if (followUp) {
          matchedFollowUps++
        } else if (state.turn_count > 0 && state.last_products.length > 0) {
          // Had context but didn't detect follow-up — might be a miss
          if (confidence < 0.5) {
            missedFollowUps++
            const issue = `[${conv.id.slice(0, 8)}] Low confidence (${confidence}) with products in state: "${msg.content}"`
            issues.push(issue)
            console.log(`     ⚠️  LOW CONFIDENCE with active product context`)
          }
        }

        // Simulate state update (using detected intent)
        const resolvedIntent = followUp
          ? (followUp.type === 'number_reference' || followUp.type === 'select_single'
            ? 'product_detail'
            : followUp.type === 'price_question' ? 'price_info'
            : followUp.type === 'size_question' ? 'size_info'
            : followUp.type === 'contextual_question' ? 'general'
            : followUp.type === 'query_refinement' ? 'product_search'
            : intent)
          : intent

        // For product_search, simulate finding some products
        const mockProducts: StoredProduct[] = resolvedIntent === 'product_search'
          ? [{ id: 'mock1', name: 'Mock Product', base_price: 50000 }]
          : followUp?.product
            ? [followUp.product]
            : []

        state = updateState(state, resolvedIntent, mockProducts, msg.content)
      } else {
        // AI/agent response — just show it
        const role = msg.is_ai_response ? '🤖' : '👨‍💼'
        const meta = msg.metadata as Record<string, unknown> || {}
        const metaStr = meta.intent ? ` [intent=${meta.intent}, products=${meta.products_found || 0}]` : ''
        console.log(`  ${role} "${(msg.content || '').slice(0, 100)}${(msg.content || '').length > 100 ? '...' : ''}"${metaStr}`)
      }
    }

    console.log(`  State after: intent=${state.last_intent}, products=${state.last_products.length}, turns=${state.turn_count}`)
    console.log()
  }

  // Summary
  console.log('═'.repeat(80))
  console.log('SUMMARY')
  console.log('═'.repeat(80))
  console.log(`Total customer turns analyzed: ${totalTurns}`)
  console.log(`Follow-ups detected: ${matchedFollowUps}`)
  console.log(`Potential misses (low confidence with product context): ${missedFollowUps}`)

  if (issues.length > 0) {
    console.log(`\n⚠️  Issues found (${issues.length}):`)
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`))
  } else {
    console.log('\n✅ No issues detected.')
  }
}

main().catch(console.error)
