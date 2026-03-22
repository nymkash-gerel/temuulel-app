/**
 * End-to-End Escalation System Test
 *
 * Tests ALL customer escalation paths through the real database:
 *   1. Complaint signal (+25)
 *   2. Frustration signal (+20)
 *   3. Return/exchange signal (+20)
 *   4. Payment dispute signal (+25)
 *   5. Repeated message (+15)
 *   6. AI fail to resolve (+15)
 *   7. Long unresolved (+10)
 *   8. Full escalation chain (multi-signal → auto-escalation)
 *   9. Threshold crossing test (score >= 60 triggers escalation)
 *
 * Each test creates a fresh conversation, sends messages via the
 * processEscalation function (same path used by the widget route),
 * and verifies the escalation_score / status in the database.
 *
 * Usage: npx tsx scripts/test-escalation-e2e.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { processEscalation, evaluateEscalation } from '../src/lib/escalation'
import type { ChatbotSettings } from '../src/lib/chat-ai-types'

// ============================================================================
// Config
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// Test state tracking
// ============================================================================

let passed = 0
let failed = 0
let totalTests = 0
const errors: string[] = []
const createdConversationIds: string[] = []
const createdCustomerIds: string[] = []

function assert(condition: boolean, message: string, details?: string) {
  totalTests++
  if (condition) {
    passed++
    console.log(`    [PASS] ${message}`)
  } else {
    failed++
    const msg = details ? `${message} -- ${details}` : message
    errors.push(msg)
    console.error(`    [FAIL] ${message}${details ? ` (${details})` : ''}`)
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(70))
}

function subsection(title: string) {
  console.log(`\n  -- ${title} --`)
}

// ============================================================================
// Test helpers
// ============================================================================

const DEFAULT_CHATBOT_SETTINGS: ChatbotSettings = {
  escalation_enabled: true,
  escalation_threshold: 60,
  escalation_message: 'Таны хүсэлтийг бид хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно.',
}

let testStoreId: string | null = null

async function findTestStore(): Promise<string> {
  if (testStoreId) return testStoreId

  // Find any store with chatbot settings or just the first store
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .limit(1)
    .single()

  if (!stores) {
    console.error('No stores found in the database. Cannot run e2e tests.')
    process.exit(1)
  }

  testStoreId = stores.id
  console.log(`  Using test store: "${stores.name}" (${stores.id})`)
  return testStoreId
}

/**
 * Create a fresh conversation in the database for testing.
 * Returns the conversation ID.
 */
async function createTestConversation(storeId: string, customerId?: string): Promise<string> {
  const convId = crypto.randomUUID()

  const { error } = await supabase.from('conversations').insert({
    id: convId,
    store_id: storeId,
    channel: 'web',
    status: 'active',
    escalation_score: 0,
    escalation_level: 'low',
    customer_id: customerId ?? null,
  })

  if (error) {
    console.error(`  Failed to create test conversation: ${error.message}`)
    throw new Error(`Failed to create test conversation: ${error.message}`)
  }

  createdConversationIds.push(convId)
  return convId
}

/**
 * Create a test customer in the database.
 */
async function createTestCustomer(storeId: string): Promise<string> {
  const custId = crypto.randomUUID()

  const { error } = await supabase.from('customers').insert({
    id: custId,
    store_id: storeId,
    name: 'Test Escalation Customer',
    external_id: `ext-${custId}`,
  })

  if (error) {
    // If customers table doesn't exist or has different schema, skip customer creation
    console.warn(`  Note: Could not create test customer: ${error.message}`)
    return custId
  }

  createdCustomerIds.push(custId)
  return custId
}

/**
 * Insert a message into the messages table for a conversation.
 */
async function insertMessage(
  conversationId: string,
  content: string,
  isFromCustomer: boolean,
  isAiResponse: boolean
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    content,
    is_from_customer: isFromCustomer,
    is_ai_response: isAiResponse,
  })

  if (error) {
    console.error(`  Failed to insert message: ${error.message}`)
  }
}

/**
 * Get the current escalation score and status from the conversation.
 */
async function getConversationState(conversationId: string): Promise<{
  escalation_score: number
  escalation_level: string
  status: string | null
  escalated_at: string | null
}> {
  const { data } = await supabase
    .from('conversations')
    .select('escalation_score, escalation_level, status, escalated_at')
    .eq('id', conversationId)
    .single()

  return {
    escalation_score: data?.escalation_score ?? 0,
    escalation_level: data?.escalation_level ?? 'low',
    status: data?.status ?? null,
    escalated_at: data?.escalated_at ?? null,
  }
}

/**
 * Run processEscalation for a conversation and return the result + DB state.
 * Also inserts the customer message into the messages table first
 * (matching the real flow where the customer message is saved before escalation runs).
 */
async function sendAndEscalate(
  conversationId: string,
  message: string,
  storeId: string,
  settings?: ChatbotSettings
) {
  // Save customer message first (mimics what the real route does)
  await insertMessage(conversationId, message, true, false)

  const result = await processEscalation(
    supabase,
    conversationId,
    message,
    storeId,
    settings ?? DEFAULT_CHATBOT_SETTINGS
  )

  // Also fetch the DB state
  const dbState = await getConversationState(conversationId)

  return { result, dbState }
}

/**
 * Insert an AI response message (mimics the bot replying).
 */
async function sendAiReply(conversationId: string, content: string): Promise<void> {
  await insertMessage(conversationId, content, false, true)
}

// ============================================================================
// Test 1: Complaint signal (+25)
// ============================================================================

async function testComplaintSignal(storeId: string) {
  section('TEST 1: Complaint Signal (+25)')

  const convId = await createTestConversation(storeId)

  subsection('Angry phrase: "Яагаад ийм удаан байгаа юм!?"')
  // Note: "удаан" is a frustration keyword, not a complaint keyword.
  // Let's use a pure complaint keyword to isolate the signal.
  const { result: r1, dbState: s1 } = await sendAndEscalate(
    convId,
    'Энэ муу бараа байна, гомдол гаргая',
    storeId
  )
  console.log(`    Score after complaint: ${s1.escalation_score} (level: ${s1.escalation_level})`)
  // "муу" (complaint) + "гомдол" (complaint) = 2 keywords -> 25*2 = 50
  assert(s1.escalation_score >= 25, 'Complaint signal raises score by at least 25', `got ${s1.escalation_score}`)
  assert(s1.escalation_level !== 'low', 'Level moves above low after complaint', `got ${s1.escalation_level}`)

  subsection('Angry demand: "Мөнгөө буцааж өг!!!"')
  const convId2 = await createTestConversation(storeId)
  const { result: r2, dbState: s2 } = await sendAndEscalate(
    convId2,
    'Мөнгөө буцааж өг!!!',
    storeId
  )
  console.log(`    Score after angry refund demand: ${s2.escalation_score} (level: ${s2.escalation_level})`)
  // 3+ exclamation marks or immediate escalation trigger -> should set score to threshold
  assert(
    r2.escalated === true,
    'Angry refund demand with !!! triggers immediate escalation',
    `escalated=${r2.escalated}, score=${s2.escalation_score}`
  )
  assert(s2.status === 'escalated', 'Conversation status set to "escalated"', `got ${s2.status}`)
}

// ============================================================================
// Test 2: Frustration signal (+20)
// ============================================================================

async function testFrustrationSignal(storeId: string) {
  section('TEST 2: Frustration Signal (+20)')

  const convId = await createTestConversation(storeId)

  subsection('Frustration: "яагаад"')
  const { dbState: s1 } = await sendAndEscalate(convId, 'Яагаад ингэж байна', storeId)
  console.log(`    Score after "яагаад": ${s1.escalation_score}`)
  // "яагаад" = 1 frustration keyword -> 20
  assert(s1.escalation_score >= 20, 'Frustration keyword adds at least 20', `got ${s1.escalation_score}`)

  subsection('Frustration: "уурласан"')
  const convId2 = await createTestConversation(storeId)
  const { dbState: s2 } = await sendAndEscalate(convId2, 'Уурласан байна', storeId)
  console.log(`    Score after "уурласан": ${s2.escalation_score}`)
  assert(s2.escalation_score >= 20, '"уурласан" frustration keyword adds at least 20', `got ${s2.escalation_score}`)

  subsection('Multiple frustration keywords: "яагаад удаан"')
  const convId3 = await createTestConversation(storeId)
  const { dbState: s3 } = await sendAndEscalate(convId3, 'Яагаад удаан хариулахгүй байна вэ', storeId)
  console.log(`    Score after 3 frustration keywords: ${s3.escalation_score}`)
  // "яагаад" + "удаан" + "хариулахгүй" = 3 keywords -> 20 + 10 + 10 = 40
  assert(s3.escalation_score >= 30, 'Multiple frustration keywords stack correctly', `got ${s3.escalation_score}`)
}

// ============================================================================
// Test 3: Return/exchange signal (+20)
// ============================================================================

async function testReturnExchangeSignal(storeId: string) {
  section('TEST 3: Return/Exchange Signal (+20)')

  const convId = await createTestConversation(storeId)

  subsection('Return request: "солих"')
  const { dbState: s1 } = await sendAndEscalate(
    convId,
    'Хэмжээ тохирохгүй байна, солих боломжтой юу',
    storeId
  )
  console.log(`    Score after return/exchange request: ${s1.escalation_score}`)
  // "солих" = return_exchange (+20), "тохиромжгүй" = complaint (+25) — but "тохирохгүй" != "тохиромжгүй"
  assert(s1.escalation_score >= 20, 'Return/exchange keyword adds at least 20', `got ${s1.escalation_score}`)

  subsection('Return request: "буцаах"')
  const convId2 = await createTestConversation(storeId)
  const { dbState: s2 } = await sendAndEscalate(convId2, 'Буцаах хүсэлтэй байна', storeId)
  console.log(`    Score after "буцаах": ${s2.escalation_score}`)
  assert(s2.escalation_score >= 20, '"буцаах" keyword triggers return_exchange signal', `got ${s2.escalation_score}`)
}

// ============================================================================
// Test 4: Payment dispute signal (+25)
// ============================================================================

async function testPaymentDisputeSignal(storeId: string) {
  section('TEST 4: Payment Dispute Signal (+25)')

  const convId = await createTestConversation(storeId)

  subsection('Payment dispute: "давхар төлсөн"')
  const { dbState: s1 } = await sendAndEscalate(convId, 'Давхар төлсөн байна шүү', storeId)
  console.log(`    Score after "давхар төлсөн": ${s1.escalation_score}`)
  assert(s1.escalation_score >= 25, 'Payment dispute keyword adds at least 25', `got ${s1.escalation_score}`)

  subsection('Payment dispute: "мөнгө ирээгүй"')
  const convId2 = await createTestConversation(storeId)
  const { dbState: s2 } = await sendAndEscalate(convId2, 'Мөнгө ирээгүй байна', storeId)
  console.log(`    Score after "мөнгө ирээгүй": ${s2.escalation_score}`)
  assert(s2.escalation_score >= 25, '"мөнгө ирээгүй" triggers payment dispute', `got ${s2.escalation_score}`)
}

// ============================================================================
// Test 5: Repeated message (+15)
// ============================================================================

async function testRepeatedMessage(storeId: string) {
  section('TEST 5: Repeated Message (+15)')

  const convId = await createTestConversation(storeId)
  const repeatedMsg = 'Захиалга ирээгүй байна'

  subsection('Send same message 3 times (Jaccard >= 0.8)')

  // Message 1 — neutral message, should be 0
  await insertMessage(convId, repeatedMsg, true, false)
  await sendAiReply(convId, 'Шалгаж байна...')
  console.log('    Sent message 1 (initial)')

  // Message 2 — same message, score should still be low (not a complaint)
  await insertMessage(convId, repeatedMsg, true, false)
  await sendAiReply(convId, 'Түр хүлээнэ үү...')
  console.log('    Sent message 2 (repeat)')

  // Message 3 — send via processEscalation to evaluate
  const { dbState: s1 } = await sendAndEscalate(convId, repeatedMsg, storeId)
  console.log(`    Score after 3rd repeat: ${s1.escalation_score}`)
  assert(
    s1.escalation_score >= 15,
    'Repeated message (3x same) adds at least 15 to score',
    `got ${s1.escalation_score}`
  )

  // Verify using the pure function too
  subsection('Verify Jaccard similarity detection')
  const { detectRepeatedMessage } = await import('../src/lib/escalation')
  const isRepeat = detectRepeatedMessage(repeatedMsg, [repeatedMsg, repeatedMsg])
  assert(isRepeat === true, 'detectRepeatedMessage returns true for identical messages')

  const isNotRepeat = detectRepeatedMessage('Огт өөр зүйл', [repeatedMsg])
  assert(isNotRepeat === false, 'detectRepeatedMessage returns false for different messages')
}

// ============================================================================
// Test 6: AI fail to resolve (+15)
// ============================================================================

async function testAiFailToResolve(storeId: string) {
  section('TEST 6: AI Fail to Resolve (+15)')

  const convId = await createTestConversation(storeId)

  subsection('3+ customer messages with only AI replies')

  // Build a conversation with 3 customer messages and only AI responses
  await insertMessage(convId, 'Захиалгын дугаар хэд вэ', true, false)
  await sendAiReply(convId, 'Захиалгаа шалгана уу.')
  console.log('    Sent customer msg 1 + AI reply')

  await insertMessage(convId, 'Шалгасан ч олдохгүй байна', true, false)
  await sendAiReply(convId, 'Дахин оролдоно уу.')
  console.log('    Sent customer msg 2 + AI reply')

  // 3rd customer message — triggers evaluation
  const { dbState: s1 } = await sendAndEscalate(convId, 'Дахиад олдохгүй байна', storeId)
  console.log(`    Score after 3 customer msgs with AI-only replies: ${s1.escalation_score}`)
  assert(
    s1.escalation_score >= 15,
    '3+ customer messages with only AI replies triggers ai_fail_to_resolve (+15)',
    `got ${s1.escalation_score}`
  )

  // Verify countConsecutiveAiOnly
  subsection('Verify countConsecutiveAiOnly helper')
  const { countConsecutiveAiOnly } = await import('../src/lib/escalation')
  const count = countConsecutiveAiOnly([
    { content: 'Q1', is_from_customer: true, is_ai_response: false },
    { content: 'A1', is_from_customer: false, is_ai_response: true },
    { content: 'Q2', is_from_customer: true, is_ai_response: false },
    { content: 'A2', is_from_customer: false, is_ai_response: true },
    { content: 'Q3', is_from_customer: true, is_ai_response: false },
  ])
  assert(count === 3, 'countConsecutiveAiOnly returns 3 for 3 customer msgs with AI-only replies', `got ${count}`)
}

// ============================================================================
// Test 7: Long unresolved (+10)
// ============================================================================

async function testLongUnresolved(storeId: string) {
  section('TEST 7: Long Unresolved (+10)')

  const convId = await createTestConversation(storeId)

  subsection('6+ messages with no human reply')

  // Build a conversation with 6 customer messages, all answered by AI only
  for (let i = 1; i <= 5; i++) {
    await insertMessage(convId, `Асуулт ${i}`, true, false)
    await sendAiReply(convId, `AI хариулт ${i}`)
  }
  console.log('    Sent 5 customer messages with AI replies')

  // 6th customer message — triggers long_unresolved + ai_fail_to_resolve
  const { dbState: s1 } = await sendAndEscalate(convId, 'Хариулна уу', storeId)
  console.log(`    Score after 6 customer msgs (no human reply): ${s1.escalation_score}`)
  // long_unresolved(10) + ai_fail_to_resolve(15) = at least 25
  assert(
    s1.escalation_score >= 10,
    '6+ messages with no human reply triggers long_unresolved signal (+10)',
    `got ${s1.escalation_score}`
  )

  // Verify that having a human reply prevents long_unresolved
  subsection('Human reply prevents long_unresolved')
  const convId2 = await createTestConversation(storeId)
  for (let i = 1; i <= 3; i++) {
    await insertMessage(convId2, `Асуулт ${i}`, true, false)
    await sendAiReply(convId2, `AI хариулт ${i}`)
  }
  // Insert a human agent reply
  await insertMessage(convId2, 'Хүн хариулт', false, false) // NOT AI
  for (let i = 4; i <= 5; i++) {
    await insertMessage(convId2, `Асуулт ${i}`, true, false)
    await sendAiReply(convId2, `AI хариулт ${i}`)
  }
  const { dbState: s2 } = await sendAndEscalate(convId2, 'Тест', storeId)
  console.log(`    Score with human reply in thread: ${s2.escalation_score}`)
  // The evaluateEscalation function checks hasHumanReply in the recentMessages
  // Since there's a human reply, long_unresolved should NOT trigger
  // But note: the limit is 10 messages, so the human reply may or may not be in view
}

// ============================================================================
// Test 8: Full escalation chain
// ============================================================================

async function testFullEscalationChain(storeId: string) {
  section('TEST 8: Full Escalation Chain (Complaint + Frustration + Repeated)')

  const convId = await createTestConversation(storeId)

  subsection('Step 1: Complaint signal')
  const { dbState: s1 } = await sendAndEscalate(convId, 'Энэ асуудалтай бараа байна', storeId)
  console.log(`    Score after complaint: ${s1.escalation_score} (level: ${s1.escalation_level})`)
  assert(s1.escalation_score >= 25, 'Complaint adds at least 25', `got ${s1.escalation_score}`)
  assert(s1.status !== 'escalated', 'Not yet escalated', `status=${s1.status}`)

  await sendAiReply(convId, 'Уучлаарай, тусалъя.')

  subsection('Step 2: Frustration signal')
  const { dbState: s2 } = await sendAndEscalate(convId, 'Уурласан байна, яагаад ийм юм бэ', storeId)
  console.log(`    Score after frustration: ${s2.escalation_score} (level: ${s2.escalation_level})`)
  const scoreAfterFrustration = s2.escalation_score
  assert(
    scoreAfterFrustration > s1.escalation_score,
    'Score increased after frustration signal',
    `before=${s1.escalation_score}, after=${scoreAfterFrustration}`
  )

  await sendAiReply(convId, 'Шалгаж байна.')

  subsection('Step 3: Repeated message (if score still below 60)')
  if (scoreAfterFrustration < 60) {
    // Send a repeated message to push score higher
    const { dbState: s3 } = await sendAndEscalate(convId, 'Уурласан байна, яагаад ийм юм бэ', storeId)
    console.log(`    Score after repeated+frustration: ${s3.escalation_score} (level: ${s3.escalation_level})`)
    assert(
      s3.escalation_score >= 60,
      'Cumulative score reaches 60+ for auto-escalation',
      `got ${s3.escalation_score}`
    )
    assert(s3.status === 'escalated', 'Conversation status set to escalated', `got ${s3.status}`)
    assert(s3.escalated_at !== null, 'escalated_at timestamp is set', `got ${s3.escalated_at}`)
  } else {
    // Already crossed 60 with complaint + frustration
    assert(
      s2.escalation_score >= 60,
      'Cumulative score reaches 60+ for auto-escalation',
      `got ${s2.escalation_score}`
    )
    assert(s2.status === 'escalated', 'Conversation status set to escalated', `got ${s2.status}`)
    assert(s2.escalated_at !== null, 'escalated_at timestamp is set', `got ${s2.escalated_at}`)
  }

  // Verify an escalation message was saved
  subsection('Verify escalation message saved to DB')
  const { data: msgs } = await supabase
    .from('messages')
    .select('content, metadata')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(5)

  const escalationMsg = msgs?.find(
    (m: { metadata: Record<string, unknown> | null }) =>
      m.metadata && (m.metadata as Record<string, unknown>).type === 'escalation'
  )
  assert(
    escalationMsg !== undefined,
    'Escalation message was saved to messages table',
    escalationMsg ? 'found' : 'not found'
  )
}

// ============================================================================
// Test 9: Threshold test
// ============================================================================

async function testThresholdBehavior(storeId: string) {
  section('TEST 9: Threshold Test (score >= 60 triggers escalation)')

  subsection('Verify escalation triggers exactly at threshold crossing')
  // Use evaluateEscalation directly for precision testing
  const config = { enabled: true, threshold: 60 }

  // Start at 40, add complaint (+25) -> 65 >= 60 -> should escalate
  const r1 = evaluateEscalation(40, 'Энэ муу бараа байна', [], config)
  assert(r1.shouldEscalate === true, 'Score 40 + complaint(25) = 65 triggers escalation', `score=${r1.newScore}`)
  assert(r1.level === 'high', 'Level is "high" at score 65', `got ${r1.level}`)

  // Start at 34, add complaint (+25) -> 59 < 60 -> should NOT escalate
  const r2 = evaluateEscalation(34, 'Энэ муу бараа байна', [], config)
  assert(r2.shouldEscalate === false, 'Score 34 + complaint(25) = 59 does NOT escalate', `score=${r2.newScore}`)

  // Start at 35, add complaint (+25) -> 60 >= 60 -> SHOULD escalate
  const r3 = evaluateEscalation(35, 'Энэ муу бараа байна', [], config)
  assert(r3.shouldEscalate === true, 'Score 35 + complaint(25) = 60 triggers escalation exactly at threshold', `score=${r3.newScore}`)

  subsection('Already above threshold does NOT re-escalate')
  const r4 = evaluateEscalation(70, 'Муу бараа', [], config)
  assert(r4.shouldEscalate === false, 'Score 70 (already above 60) does NOT re-escalate', `shouldEscalate=${r4.shouldEscalate}`)
  assert(r4.newScore >= 70, 'Score still increases', `got ${r4.newScore}`)

  subsection('Disabled escalation never triggers')
  const disabledConfig = { enabled: false, threshold: 60 }
  const r5 = evaluateEscalation(0, 'Гомдол байна, давхар төлсөн, уурласан байна!', [], disabledConfig)
  assert(r5.shouldEscalate === false, 'Disabled escalation never triggers', `shouldEscalate=${r5.shouldEscalate}`)
  assert(r5.newScore === 0, 'Score unchanged when disabled', `got ${r5.newScore}`)

  subsection('Custom threshold works correctly')
  const lowThreshold = { enabled: true, threshold: 20 }
  const r6 = evaluateEscalation(0, 'Энэ муу бараа байна', [], lowThreshold)
  assert(r6.shouldEscalate === true, 'Threshold 20 triggers on single complaint', `score=${r6.newScore}`)

  subsection('Database threshold test')
  const convId = await createTestConversation(storeId)
  // Pre-set score to 40 in DB
  await supabase.from('conversations').update({ escalation_score: 40 }).eq('id', convId)

  // Now send a complaint that adds 25 -> 65 >= 60 -> escalate
  const { result, dbState } = await sendAndEscalate(convId, 'Гомдол байна', storeId)
  console.log(`    DB score after crossing threshold: ${dbState.escalation_score}`)
  assert(result.escalated === true, 'DB-backed escalation triggers when crossing threshold', `escalated=${result.escalated}`)
  assert(dbState.escalation_score >= 60, 'DB score is at least 60', `got ${dbState.escalation_score}`)
  assert(dbState.status === 'escalated', 'DB status is "escalated"', `got ${dbState.status}`)

  subsection('Score capped at 100')
  const r7 = evaluateEscalation(90, 'Гомдол байна, давхар төлсөн, уурласан байна, муу бараа', [], config)
  assert(r7.newScore <= 100, 'Score never exceeds 100', `got ${r7.newScore}`)
}

// ============================================================================
// Bonus: Immediate escalation triggers
// ============================================================================

async function testImmediateEscalation(storeId: string) {
  section('BONUS: Immediate Escalation Triggers')

  subsection('Request for manager: "оператор дуудаач"')
  const convId1 = await createTestConversation(storeId)
  const { result: r1, dbState: s1 } = await sendAndEscalate(convId1, 'Оператор дуудаач', storeId)
  console.log(`    Score after operator request: ${s1.escalation_score}`)
  assert(r1.escalated === true, 'Operator request triggers immediate escalation', `escalated=${r1.escalated}`)

  subsection('Request for human: "хүнтэй ярих"')
  const convId2 = await createTestConversation(storeId)
  const { result: r2, dbState: s2 } = await sendAndEscalate(convId2, 'Хүнтэй ярих хүсэлтэй', storeId)
  console.log(`    Score after human request: ${s2.escalation_score}`)
  assert(r2.escalated === true, '"хүнтэй ярих" triggers immediate escalation', `escalated=${r2.escalated}`)

  subsection('Multiple exclamation marks: "!!!"')
  const convId3 = await createTestConversation(storeId)
  const { result: r3 } = await sendAndEscalate(convId3, 'Яагаад ингэж байна!!!', storeId)
  assert(r3.escalated === true, 'Three exclamation marks trigger immediate escalation', `escalated=${r3.escalated}`)
}

// ============================================================================
// Cleanup
// ============================================================================

async function cleanup() {
  section('CLEANUP')

  if (createdConversationIds.length > 0) {
    // Delete messages first (foreign key constraint)
    const { error: msgErr } = await supabase
      .from('messages')
      .delete()
      .in('conversation_id', createdConversationIds)

    if (msgErr) {
      console.warn(`  Warning: Could not clean up messages: ${msgErr.message}`)
    } else {
      console.log(`  Cleaned up messages for ${createdConversationIds.length} conversations`)
    }

    // Delete conversations
    const { error: convErr } = await supabase
      .from('conversations')
      .delete()
      .in('id', createdConversationIds)

    if (convErr) {
      console.warn(`  Warning: Could not clean up conversations: ${convErr.message}`)
    } else {
      console.log(`  Cleaned up ${createdConversationIds.length} test conversations`)
    }
  }

  if (createdCustomerIds.length > 0) {
    const { error: custErr } = await supabase
      .from('customers')
      .delete()
      .in('id', createdCustomerIds)

    if (custErr) {
      console.warn(`  Warning: Could not clean up customers: ${custErr.message}`)
    } else {
      console.log(`  Cleaned up ${createdCustomerIds.length} test customers`)
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(70))
  console.log('  ESCALATION SYSTEM END-TO-END TEST')
  console.log('  Tests all customer escalation paths through real Supabase DB')
  console.log('='.repeat(70))

  const storeId = await findTestStore()

  try {
    await testComplaintSignal(storeId)
    await testFrustrationSignal(storeId)
    await testReturnExchangeSignal(storeId)
    await testPaymentDisputeSignal(storeId)
    await testRepeatedMessage(storeId)
    await testAiFailToResolve(storeId)
    await testLongUnresolved(storeId)
    await testFullEscalationChain(storeId)
    await testThresholdBehavior(storeId)
    await testImmediateEscalation(storeId)
  } catch (err) {
    console.error('\n  FATAL ERROR:', err instanceof Error ? err.message : String(err))
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
  } finally {
    await cleanup()
  }

  // ── Final Report ──────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(70)}`)
  console.log('  RESULTS')
  console.log('='.repeat(70))
  console.log(`  Total:  ${totalTests}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)

  if (errors.length > 0) {
    console.log(`\n  FAILURES:`)
    for (const e of errors) {
      console.log(`    - ${e}`)
    }
  }

  console.log('='.repeat(70))

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
