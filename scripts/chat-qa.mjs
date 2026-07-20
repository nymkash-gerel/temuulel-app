/**
 * Chat QA driver — жинхэнэ хэрэглэгч мэт /api/chat/widget руу монголоор чатлаж,
 * ярианы бүрэн урсгалыг хэвлэнэ. /chat-qa skill үүнийг ашигладаг.
 *
 * Usage:
 *   node scripts/chat-qa.mjs <scenario-name> <conversation-uuid-v4> <sender-id> <msg1> [msg2 ...]
 *
 * Env:
 *   CHAT_QA_BASE     (default http://localhost:3000)
 *   CHAT_QA_STORE_ID (default local seed store a1b2c3d4-...)
 *
 * АНХААР: store_id болон conversation_id хоёул ЗААВАЛ UUID v4 байх ёстой
 * (Zod strict — version nibble 4). Жишээ: 11111111-1111-4111-8111-111111111111
 */
const BASE = (process.env.CHAT_QA_BASE ?? 'http://localhost:3000') + '/api/chat/widget'
const STORE_ID = process.env.CHAT_QA_STORE_ID ?? 'a1b2c3d4-e5f6-4789-ab01-234567890abc'

const [scenario, convId, senderId, ...messages] = process.argv.slice(2)
if (!scenario || !convId || !senderId || messages.length === 0) {
  console.error('Usage: node scripts/chat-qa.mjs <scenario> <conv-uuid-v4> <sender-id> <msg1> [msg2 ...]')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

console.log(`\n===== СЦЕНАРИ: ${scenario} (conv=${convId}) =====`)
for (const msg of messages) {
  console.log(`\n👤 Хэрэглэгч: ${msg}`)
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store_id: STORE_ID,
      customer_message: msg,
      conversation_id: convId,
      sender_id: senderId,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.log(`❌ HTTP ${res.status}:`, JSON.stringify(json))
    continue
  }
  const reply = json.response ?? json.message ?? json.ai_response ?? JSON.stringify(json)
  console.log(`🤖 Бот: ${typeof reply === 'string' ? reply : JSON.stringify(reply)}`)
  if (json.escalated || json.handoff) console.log(`   ⚠️ escalated/handoff:`, json.escalated ?? json.handoff)
  await sleep(1500) // rate limit: 20 хүсэлт/мин
}
