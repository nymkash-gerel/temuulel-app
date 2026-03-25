/**
 * Comprehensive QA Test — 10 realistic multi-turn Facebook conversations.
 * Simulates real Mongolian customers with typos, slang, Latin mixing, interruptions.
 * Outputs structured results for NotebookLM analysis.
 */

import { createClient } from '@supabase/supabase-js'
import { processAIChat } from '../src/lib/chat-ai-handler'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) as string
)

interface Turn { msg: string; expect?: string }
interface Script { name: string; turns: Turn[] }

async function runScript(storeId: string, script: Script) {
  const cid = crypto.randomUUID()
  await sb.from('conversations').upsert(
    { id: cid, store_id: storeId, channel: 'web', status: 'active' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`  SCRIPT: ${script.name}`)
  console.log('═'.repeat(70))

  const issues: string[] = []

  for (let i = 0; i < script.turns.length; i++) {
    const turn = script.turns[i]
    const r = await processAIChat(sb as unknown as Parameters<typeof processAIChat>[0], {
      conversationId: cid,
      customerMessage: turn.msg,
      storeId,
      storeName: 'Монгол Маркет',
      customerId: null,
      chatbotSettings: {},
    })

    const truncResp = r.response.substring(0, 200).replace(/\n/g, ' ')
    console.log(`  [${i + 1}] 📩 "${turn.msg}"`)
    console.log(`      🏷️ ${r.intent} | products=${r.metadata.products_found} | step=${r.orderStep || '-'}`)
    console.log(`      🤖 ${truncResp}`)

    // Check for issues
    if (r.response.includes('undefined') || r.response.includes('null')) {
      issues.push(`Turn ${i + 1}: Response contains undefined/null`)
    }
    if (r.response.length < 5) {
      issues.push(`Turn ${i + 1}: Response too short (${r.response.length} chars)`)
    }
    if (turn.expect) {
      if (turn.expect === 'product_search' && r.intent !== 'product_search') {
        issues.push(`Turn ${i + 1}: Expected product_search but got ${r.intent}`)
      }
      if (turn.expect === 'complaint' && r.intent !== 'complaint') {
        issues.push(`Turn ${i + 1}: Expected complaint but got ${r.intent}`)
      }
      if (turn.expect === 'order_collection' && r.intent !== 'order_collection' && r.intent !== 'order_created') {
        issues.push(`Turn ${i + 1}: Expected order_collection but got ${r.intent}`)
      }
      if (turn.expect === 'has_products' && r.metadata.products_found === 0) {
        issues.push(`Turn ${i + 1}: Expected products but found 0`)
      }
      if (turn.expect === 'no_hallucination' && r.metadata.products_found === 0 && !r.response.match(/байхгүй|олдсонгүй|дууссан|ажилтан/)) {
        issues.push(`Turn ${i + 1}: No products found but response doesn't say "not available" — possible hallucination`)
      }
      if (turn.expect === 'empathy' && !r.response.match(/харамсаж|уучлаарай|санааг|зовсон|ойлгож/)) {
        issues.push(`Turn ${i + 1}: Expected empathy but none detected`)
      }
      if (turn.expect === 'escalation' && !r.response.match(/менежер|холбогд|хүлээн ав/i)) {
        issues.push(`Turn ${i + 1}: Expected escalation but none detected`)
      }
      if (turn.expect === 'name_step' && r.orderStep !== 'name') {
        issues.push(`Turn ${i + 1}: Expected name step but got ${r.orderStep}`)
      }
      if (turn.expect === 'address_step' && r.orderStep !== 'address') {
        issues.push(`Turn ${i + 1}: Expected address step but got ${r.orderStep}`)
      }
      if (turn.expect === 'phone_step' && r.orderStep !== 'phone') {
        issues.push(`Turn ${i + 1}: Expected phone step but got ${r.orderStep}`)
      }
      if (turn.expect === 'confirming' && r.orderStep !== 'confirming') {
        issues.push(`Turn ${i + 1}: Expected confirming but got ${r.orderStep}`)
      }
    }
  }

  if (issues.length > 0) {
    console.log(`  ⚠️  ISSUES (${issues.length}):`)
    issues.forEach(iss => console.log(`      - ${iss}`))
  } else {
    console.log(`  ✅ NO ISSUES`)
  }

  return { name: script.name, issues }
}

async function main() {
  const { data: store } = await sb.from('stores').select('id').eq('name', 'Монгол Маркет').single()
  if (!store) { console.log('ERROR: Store not found'); process.exit(1) }
  const sid = store.id

  const scripts: Script[] = [
    {
      name: '1. Happy Path — Latin slang order',
      turns: [
        { msg: 'sn bnu', expect: undefined },
        { msg: 'tsunx bga yu?', expect: 'product_search' },
        { msg: 'xed we?', expect: undefined },
        { msg: '1', expect: 'name_step' },
        { msg: 'Батаа', expect: 'address_step' },
        { msg: 'БЗД 8 хороо 15 байр', expect: 'phone_step' },
        { msg: '99112233', expect: 'confirming' },
        { msg: 'tiim', expect: 'order_collection' },
      ],
    },
    {
      name: '2. Mind-changer — size question mid-order',
      turns: [
        { msg: 'Цамц байна уу?', expect: 'product_search' },
        { msg: '1', expect: 'name_step' },
        { msg: 'M size тохирох уу 165см 60кг?', expect: undefined },
        { msg: 'Ширээ', expect: undefined },
        { msg: 'БЗД 3 хороо', expect: undefined },
      ],
    },
    {
      name: '3. Unrelated question during checkout',
      turns: [
        { msg: 'захиалмаар байна', expect: undefined },
        { msg: 'цамц авъя', expect: 'order_collection' },
        { msg: '1', expect: 'name_step' },
        { msg: 'Нарин', expect: 'address_step' },
        { msg: 'BZD 26r khoroo. Margaash ireh uu?', expect: undefined },
        { msg: '401r bair', expect: undefined },
        { msg: '88776655', expect: undefined },
      ],
    },
    {
      name: '4. Frustrated customer — delivery complaint',
      turns: [
        { msg: 'Захиалга маань хаана явж байна?', expect: undefined },
        { msg: 'Яагаад ийм удаан байгаа юм!', expect: 'complaint' },
        { msg: 'Одоо ирэхгүй бол болиолоо', expect: 'complaint' },
        { msg: 'Мөнгөө буцааж өг!!!', expect: 'escalation' },
      ],
    },
    {
      name: '5. Brand name in Latin — SKIMS',
      turns: [
        { msg: 'Сайн байна уу', expect: undefined },
        { msg: 'Skims bnu?', expect: 'product_search' },
        { msg: 'xed we ene?', expect: undefined },
        { msg: 'ok avya', expect: undefined },
      ],
    },
    {
      name: '6. Returning customer — memory check',
      turns: [
        { msg: 'Дахиад авъя', expect: undefined },
        { msg: 'Өмнө авсан цамцнаасаа', expect: undefined },
        { msg: 'Хаяг дугаараа өмнө нь үлдээсэн', expect: undefined },
      ],
    },
    {
      name: '7. Complaint during checkout — damaged item',
      turns: [
        { msg: 'цамц авна', expect: 'order_collection' },
        { msg: '1', expect: 'name_step' },
        { msg: 'Болд', expect: 'address_step' },
        { msg: 'Өглөө авсан бараа эвдэрсэн байна!', expect: 'complaint' },
        { msg: 'Оператортой ярих', expect: 'escalation' },
      ],
    },
    {
      name: '8. Phone before name — validation test',
      turns: [
        { msg: 'захиалмаар байна', expect: undefined },
        { msg: 'цамц', expect: 'product_search' },
        { msg: '1', expect: 'name_step' },
        { msg: '99112233', expect: undefined },
        { msg: 'Bat', expect: undefined },
      ],
    },
    {
      name: '9. Aggressive refund — immediate escalation',
      turns: [
        { msg: 'Мөнгөө буцааж өг!!!', expect: 'escalation' },
        { msg: 'Яатарч байна хариулаач', expect: 'complaint' },
        { msg: 'хүнтэй ярих', expect: 'escalation' },
      ],
    },
    {
      name: '10. Discontinued product + alternative',
      turns: [
        { msg: 'офис өмд байгаа юу?', expect: 'product_search' },
        { msg: 'кашемир малгай хэдүү?', expect: 'product_search' },
        { msg: 'Тэгвэл юу байгаа юм бэ?', expect: undefined },
      ],
    },
  ]

  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║  COMPREHENSIVE QA TEST — 10 Multi-Turn Facebook Conversations       ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')

  const allResults: { name: string; issues: string[] }[] = []

  for (const script of scripts) {
    const result = await runScript(sid, script)
    allResults.push(result)
  }

  // Summary
  console.log('\n' + '═'.repeat(70))
  console.log('  SUMMARY')
  console.log('═'.repeat(70))

  let totalIssues = 0
  for (const r of allResults) {
    const status = r.issues.length === 0 ? '✅' : `⚠️ ${r.issues.length} issues`
    console.log(`  ${status} ${r.name}`)
    totalIssues += r.issues.length
  }

  console.log(`\n  Total: ${allResults.length} scripts, ${totalIssues} issues found`)

  if (totalIssues > 0) {
    console.log('\n  ALL ISSUES:')
    for (const r of allResults) {
      for (const iss of r.issues) {
        console.log(`    [${r.name}] ${iss}`)
      }
    }
  }
}

main().catch(console.error)
