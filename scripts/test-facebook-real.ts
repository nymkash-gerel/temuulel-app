/**
 * test-facebook-real.ts
 *
 * Real Facebook conversation replay tests.
 * Tests the chatbot against actual customer messages from Facebook Messenger.
 *
 * Scenarios: 10-15
 *
 * Usage:
 *   E2E_RATE_LIMIT_BYPASS=true npx tsx scripts/test-facebook-real.ts
 */

import {
  chat,
  delay,
  ok,
  dbOk,
  dbFail,
  scenarioResult,
  section,
  extractCustomerMessages,
  getSupabase,
  LOCAL,
  getSummary,
  printSummary,
} from './helpers/test-utils'

const sb = getSupabase()
const NOW = Date.now()

// ============================================================================
// Scenario 10: Real FB Chat — Togs Jargal (hardest conversation, 216 msgs)
// ============================================================================

async function scenario10(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 10: Real FB Chat \u2014 Togs Jargal (216 msgs)')
  const sid = `web_e2e_togsjargal_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/tgszargal_1106833577156223/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Some real FB messages got invalid responses')
}

// ============================================================================
// Scenario 11: Real FB Chat — Pola Ris (most messy Latin, 132 instances)
// ============================================================================

async function scenario11(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 11: Real FB Chat \u2014 Pola Ris (messy Latin)')
  const sid = `web_e2e_polaris_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/polaris_4042349015842621/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Some messy Latin FB messages got invalid responses')
}

// ============================================================================
// Scenario 12: Real FB Chat — Batchimeg (name contains "hi")
// ============================================================================

async function scenario12(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 12: Real FB Chat \u2014 Batchimeg (name contains "hi")')
  const sid = `web_e2e_batchimeg_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/batchimegnarangerel_122222533226018334/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
    // Special check: "Batchimeg" name must NOT trigger greeting
    if (
      msgs[i].toLowerCase().includes('batchimeg') &&
      r.intent === 'greeting'
    ) {
      dbFail(`"${msgs[i]}" triggered greeting \u2014 name "Batchimeg" contains "hi"`)
      pass = false
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 13: Real FB Chat — Rural Customer (Ovorkhangai)
// ============================================================================

async function scenario13(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 13: Real FB Chat \u2014 Rural Customer (Ovorkhangai)')
  const sid = `web_e2e_rural_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/enkhboldariunzaya_2290552584725919/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Rural customer messages got invalid responses')
}

// ============================================================================
// Scenario 14: Real FB Chat — Angry Customer (17 complaints)
// ============================================================================

async function scenario14(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 14: Real FB Chat \u2014 Angry Customer (17 complaints)')
  const sid = `web_e2e_angry_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/hgancimeg_2006037763572702/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  let escalationFired = false
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (r.intent === 'complaint' || r.intent === 'escalation' || r.intent === 'escalated')
      escalationFired = true
    if (!valid) pass = false
  }

  // Check if escalation was triggered in DB
  if (convId) {
    await delay(1000)
    const { data: conv } = await sb
      .from('conversations')
      .select('escalation_score, status')
      .eq('id', convId)
      .single()

    if (conv && (conv.escalation_score >= 40 || conv.status === 'escalated')) {
      dbOk(
        `Escalation detected: score=${conv.escalation_score}, status=${conv.status}`
      )
    } else if (escalationFired) {
      dbOk('Complaint intent detected in responses')
    } else {
      dbFail('No escalation detected for angry customer')
      pass = false
    }

    // ── FULL FLOW: Check escalation_score in DB, then send return request ──
    if (conv) {
      const scoreBeforeReturn = conv.escalation_score || 0
      console.log('  \u2500\u2500 Full flow: Return/exchange request after complaints \u2500\u2500')

      // Customer says they got the wrong product
      const retR = await chat(api, storeId, sid, '\u0411\u0443\u0440\u0443\u0443 \u0431\u0430\u0440\u0430\u0430 \u0438\u0440\u0441\u044d\u043d \u0441\u043e\u043b\u0438\u0443\u043b\u0436 \u0431\u043e\u043b\u043e\u0445 \u0443\u0443?', convId)
      ok(msgs.length + 1, `"\u0411\u0443\u0440\u0443\u0443 \u0431\u0430\u0440\u0430\u0430 \u0438\u0440\u0441\u044d\u043d \u0441\u043e\u043b\u0438\u0443\u043b\u0436 \u0431\u043e\u043b\u043e\u0445 \u0443\u0443?" \u2192 ${retR.intent}`)

      // Verify return_exchange intent
      if (retR.intent === 'return_exchange' || retR.intent === 'complaint' || retR.intent === 'return') {
        dbOk(`Return/exchange intent detected: ${retR.intent}`)
      } else {
        dbFail(`Expected return_exchange/complaint intent, got: ${retR.intent}`)
        pass = false
      }

      // Check escalation score increased further
      await delay(1000)
      const { data: convAfter } = await sb
        .from('conversations')
        .select('escalation_score')
        .eq('id', convId)
        .single()

      if (convAfter && convAfter.escalation_score > scoreBeforeReturn) {
        dbOk(`Escalation score increased: ${scoreBeforeReturn} \u2192 ${convAfter.escalation_score}`)
      } else if (convAfter) {
        console.log(`  DB: \u26a0\ufe0f  Escalation score did not increase: ${scoreBeforeReturn} \u2192 ${convAfter.escalation_score}`)
      }
    }
  }

  scenarioResult(pass)
}

// ============================================================================
// Scenario 15: Real FB Chat — Multi-Product
// ============================================================================

async function scenario15(api: string, storeId: string) {
  section('\ud83d\udccb Scenario 15: Real FB Chat \u2014 Multi-Product')
  const sid = `web_e2e_multiproduct_${NOW}`
  const filePath =
    process.env.HOME +
    "/Downloads/this_profile's_activity_across_facebook/messages/inbox/narsarod_3740824826240331/message_1.json"

  const msgs = extractCustomerMessages(filePath, 'GOOD TRADE', 8)
  if (msgs.length === 0) {
    ok(1, 'Skipped \u2014 FB message file not found or empty')
    scenarioResult(true)
    return
  }

  let pass = true
  let convId: string | undefined
  for (let i = 0; i < msgs.length; i++) {
    const r = await chat(api, storeId, sid, msgs[i], convId)
    convId = r.conversationId
    const valid = r.aiStatus === 200 && r.response.length > 0
    ok(i + 1, `"${msgs[i].slice(0, 40)}${msgs[i].length > 40 ? '...' : ''}" \u2192 ${r.intent} (${valid ? '\u2705' : '\ud83d\udd34'})`)
    if (!valid) pass = false
  }

  scenarioResult(pass)
  if (!pass) dbFail('Multi-product conversation got invalid responses')
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n\ud83d\udd2c FACEBOOK REAL CHAT TESTS \u2014 ${today}`)
  console.log('\u2550'.repeat(55))

  // Resolve store
  const { data: store, error: storeErr } = await sb
    .from('stores')
    .select('id, name')
    .eq('name', '\u041c\u043e\u043d\u0433\u043e\u043b \u041c\u0430\u0440\u043a\u0435\u0442')
    .single()

  if (storeErr || !store) {
    console.error(`\ud83d\udd34 Store "\u041c\u043e\u043d\u0433\u043e\u043b \u041c\u0430\u0440\u043a\u0435\u0442" not found: ${storeErr?.message}`)
    process.exit(1)
  }

  const storeId = store.id
  console.log(`Store: ${store.name} (${storeId})`)
  console.log()

  // Run all 6 Facebook scenarios sequentially
  await scenario10(LOCAL, storeId)
  await scenario11(LOCAL, storeId)
  await scenario12(LOCAL, storeId)
  await scenario13(LOCAL, storeId)
  await scenario14(LOCAL, storeId)
  await scenario15(LOCAL, storeId)

  // Print summary and exit
  printSummary('FACEBOOK REAL CHAT TESTS')
  const { failed } = getSummary()
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('\ud83d\udd34 Fatal error:', err)
  process.exit(1)
})
