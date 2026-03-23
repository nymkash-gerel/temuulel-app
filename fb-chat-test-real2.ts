/**
 * Real FB Chat Replay Test — Round 2
 * New sample from GOOD TRADE inbox + targeted product scenarios
 * Tests against localhost with real products seeded
 */

const LOCAL_URL = 'http://localhost:3000'
const STORE_ID = '6629f6ad-a670-4bab-af77-ce0b9209ed48'
const DELAY_MS = 1200

// ── Real FB messages (fresh sample, 43 msgs) ─────────────────────────────────
const FB_MSGS = [
  // Greetings
  { msg: 'Hi minii zahialsan boolt havchaar unuudur ireh uu☺️', tag: 'complaint-latin', note: 'ordered hair accessories, asking where they are' },
  { msg: 'Hi bodit zurg bnuu xarj bolxuu', tag: 'browse-latin', note: 'asking for real photo' },
  { msg: 'Hi hawchaar boolt bga yu awah gd', tag: 'order-latin', note: 'wants to buy hair clips/ties' },

  // Size / weight queries
  { msg: '155см 45кг таарах байна уу?', tag: 'size', note: 'should say S (40-50kg)' },
  { msg: 'Хэмжээ', tag: 'size', note: 'bare word "size" — should ask which product' },
  { msg: 'Хэмжээ-Цамц', tag: 'size-product', note: 'size for цамц specifically' },
  { msg: '24 tsag dotor l awah bolomjt ymaa', tag: 'shipping-latin', note: 'can I get it within 24 hours?' },
  { msg: 'M boriig awii', tag: 'order-latin', note: 'want to buy M size (bor = brown? or bore?)' },

  // Color queries
  { msg: 'S size Ulaan ongo', tag: 'color-unavail', note: 'no red in our store — should say so and list available colors' },
  { msg: 'Хар өнгө', tag: 'color', note: 'asking about black color' },
  { msg: 'Бор. Саарал 2 өнгөөс авий.', tag: 'color-order', note: 'wants brown+gray (no brown in store)' },
  { msg: 'цагаан өмсгөл хэр бол 2 үзэж бгаад авч болох уу', tag: 'return-exchange', note: 'can I try 2 sizes and return one?' },
  { msg: 'Гуятайгаас хар м бэлгэндээ л авы', tag: 'order', note: 'wants black M size as gift' },
  { msg: 'Ulaan ongoos 45kg bna uu', tag: 'color+size-latin', note: 'red color (unavailable) + weight 45kg' },

  // Orders / checkout
  { msg: 'Захиалъя', tag: 'order', note: 'wants to order — should ask which product' },
  { msg: '4хл авчий', tag: 'order-xl', note: 'wants XL — should ask which product' },
  { msg: 'XL- ээс нь захиалах гэсэн юм', tag: 'order-xl', note: 'wants XL — ask product' },
  { msg: 'Хавчаарны ком авая', tag: 'order-hairkit', note: 'wants 80ш үсний ком' },
  { msg: '1 bagts dotroo 6n shirheg bizdee 29k enenees ni l awah geed bgaan', tag: 'order-leevchik', note: 'asking about leevchik set price (29k)' },
  { msg: 'Гуятайгаас м бүхэндээ л авж болох уу', tag: 'order-bulk', note: 'wants M of everything' },

  // Stock / availability
  { msg: 'Болж байна уу', tag: 'stock', note: 'checking if available/in stock' },
  { msg: 'Бодит зураг байна уу', tag: 'browse', note: 'asking for real/unfiltered photos' },
  { msg: '29k bagsh байгаа юу', tag: 'price-check', note: 'is there one for 29k — yes, leevchik set' },
  { msg: 'Үнэ 35к гэж байгаа юм ууу', tag: 'price-check', note: 'asking about 35k price — not in our range exactly' },
  { msg: 'End bn', tag: 'confirm-latin', note: '"end" = here / "энд байна" — context unclear' },
  { msg: '3nd bb', tag: 'order-count', note: '3 of it — which product?' },
  { msg: 'Onoodor ireh boluu', tag: 'shipping', note: 'will it arrive today?' },
  { msg: 'Dugaar bnuu', tag: 'contact', note: 'asking for phone number' },

  // Pickup
  { msg: 'Очоод авах газар бнуу', tag: 'pickup', note: 'is there a pickup location?' },
  { msg: 'Маргааш хэрэг болоод бгаа юмаа. Очоод авч болохуу онгорхой юу', tag: 'pickup', note: 'need it tomorrow, can I pick up?' },

  // Shipping / delivery complaints
  { msg: 'Хүргэлт', tag: 'shipping', note: 'just says "delivery" — should ask for more info' },
  { msg: 'Хүргэлт ирсэнгүй', tag: 'complaint-delivery', note: 'delivery not arrived — complaint' },
  { msg: 'Хүргэлт яасын бол ирэхгүй бол 30 минутын дараа ажлаасаа гарлаа', tag: 'complaint-urgent', note: 'urgent — leaving work in 30 min if not delivered' },
  { msg: 'Өнөөдөр хүргэхгүй бол би бүтэн өдөр энэ хаяг дээр байхгүй', tag: 'complaint-schedule', note: 'not at address all day if not delivered today' },
  { msg: 'Хүргэлт маргааш гарах уу', tag: 'shipping', note: 'will delivery go out tomorrow?' },

  // Address / contact
  { msg: 'Хаяг', tag: 'address', note: 'just "address" — mid-checkout context' },
  { msg: 'Хаяг дугаараа үлдээсэн', tag: 'address', note: 'says they already left their address+number' },
  { msg: 'Хаягаа явуулд өгөөч', tag: 'address', note: 'asking store to give their address (pickup?)' },

  // Price / discount
  { msg: 'Үнэ хэд вэ', tag: 'price', note: 'price of what? should ask product' },
  { msg: 'офис өмд хэдүү хямдрал хэвээрээ юу', tag: 'price-discount', note: 'office pants discount still on?' },
  { msg: 'Хямдрал байгаа юу', tag: 'discount', note: 'any discounts?' },

  // Targeted product scenarios (our specific products)
  { msg: 'Body shaper байна уу', tag: 'product-shapewear', note: 'SKIMS body shaper' },
  { msg: 'Leevchik set авмаар байна. M size. Ямар өнгө байдаг вэ?', tag: 'product-leevchik+color', note: 'leevchik M + color options' },
  { msg: 'Үсний ком гэж яг юу юу байдаг юм бэ', tag: 'product-hairkit', note: 'what is in the 80pc hair kit?' },
  { msg: 'Цамц өмд хоёрыг нь хамт авах юм бол хямдардаг уу', tag: 'set-price', note: 'set discount — YES 39k vs 50k' },
  { msg: 'Скимс хэмжээ chart байна уу', tag: 'size-chart', note: 'SKIMS size chart request' },
]

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function ask(convId: string, msg: string): Promise<{ reply: string, status: number }> {
  const res = await fetch(`${LOCAL_URL}/api/chat/widget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: convId,
      customer_message: msg,
      store_id: STORE_ID,
      channel: 'web',
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { reply: data.message || data.response || JSON.stringify(data).slice(0, 200), status: res.status }
}

function evaluate(tag: string, msg: string, reply: string, note: string): string[] {
  const issues: string[] = []
  const r = reply.toLowerCase()
  const m = msg.toLowerCase()

  // Universal checks
  if (reply.length < 20) issues.push('❌ TOO SHORT — not helpful')
  if (r.includes('as an ai') || r.includes('ai assistant')) issues.push('❌ BREAKS PERSONA')
  if (r.includes('олдсонгүй') && !['browse','product','stock'].some(t => tag.includes(t))) {
    issues.push('⚠️ SAYS NOT FOUND unexpectedly')
  }

  // Complaint handling
  if (tag.includes('complaint')) {
    if (!r.includes('уучлаарай') && !r.includes('харамсаж') && !r.includes('ойлгож') && !r.includes('хүлцэл')) {
      issues.push('❌ NO APOLOGY for complaint')
    }
    if (r.includes('сайн') && reply.length < 50) issues.push('⚠️ GREETING REPLY for complaint')
  }

  // Size + weight — should suggest S for 45kg
  if (tag === 'size' && m.includes('45кг')) {
    if (!r.includes('s ') && !r.includes('s-') && !r.includes('s size') && !r.includes('s хэмжээ')) {
      issues.push('❌ WRONG SIZE for 45kg (should suggest S)')
    }
  }

  // Color unavailable — should mention alternatives
  if (tag === 'color-unavail' || (tag.includes('color') && m.includes('ulaan'))) {
    if (!r.includes('байхгүй') && !r.includes('алга') && !r.includes('байхгvй') && !r.includes('байдаггүй')) {
      issues.push('❌ MISSING "no red" response — should say red unavailable')
    }
  }

  // Pickup — store has no pickup, should acknowledge
  if (tag === 'pickup') {
    if (r.includes('тийм') || r.includes('болно') || r.includes('ирж болно')) {
      issues.push('❌ CONFIRMED PICKUP but store may not offer it')
    }
  }

  // Hair kit — should describe contents
  if (tag === 'product-hairkit') {
    if (!r.includes('80') && !r.includes('хавчаар') && !r.includes('боолт') && !r.includes('ком')) {
      issues.push('❌ MISSING hair kit contents description')
    }
  }

  // Set price savings
  if (tag === 'set-price') {
    if (!r.includes('39') && !r.includes('39,000') && !r.includes('хямдарна') && !r.includes('хэмнэ') && !r.includes('сет')) {
      issues.push('❌ MISSING set price (39,000₮) or savings info')
    }
  }

  // Order flow — should ask which product when bare "захиалъя"
  if (tag === 'order' && m === 'захиалъя') {
    if (!r.includes('ямар') && !r.includes('аль') && !r.includes('бүтээгдэхүүн') && !r.includes('product')) {
      issues.push('⚠️ SHOULD ASK which product to order')
    }
  }

  // Price check
  if (tag === 'price') {
    if (!r.match(/\d{4,6}/) && !r.includes('₮') && !r.includes('төг')) {
      issues.push('❌ NO PRICE in price query response')
    }
  }

  return issues
}

async function main() {
  console.log(`\n🧪 FB Chat Real Test — Round 2`)
  console.log(`📦 Store: Монгол Маркет (local, ${STORE_ID.slice(0,8)}...)`)
  console.log(`📨 Messages: ${FB_MSGS.length}\n`)
  console.log('='.repeat(80))

  let ok = 0, flagged = 0, errors = 0
  const flaggedList: Array<{ i: number, msg: string, reply: string, tag: string, issues: string[] }> = []

  for (let i = 0; i < FB_MSGS.length; i++) {
    const { msg, tag, note } = FB_MSGS[i]
    const convId = crypto.randomUUID()

    try {
      const { reply, status } = await ask(convId, msg)
      const issues = evaluate(tag, msg, reply, note)

      const icon = issues.length === 0 ? '✅' : '⚠️'
      console.log(`\n${icon} [${i+1}/${FB_MSGS.length}] "${msg}"`)
      console.log(`   tag: ${tag} | note: ${note}`)
      console.log(`   → ${reply.slice(0, 120)}${reply.length > 120 ? '…' : ''}`)
      if (issues.length) {
        issues.forEach(iss => console.log(`   ${iss}`))
        flaggedList.push({ i: i+1, msg, reply, tag, issues })
        flagged++
      } else {
        ok++
      }
    } catch (e: any) {
      console.log(`\n❌ [${i+1}] "${msg}" → ERROR: ${e.message}`)
      errors++
    }

    await delay(DELAY_MS)
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n📊 RESULTS: ${ok} ok | ${flagged} flagged | ${errors} errors`)

  if (flaggedList.length) {
    console.log('\n🔴 FLAGGED ISSUES SUMMARY:')
    for (const f of flaggedList) {
      console.log(`\n  [${f.i}] "${f.msg}" (${f.tag})`)
      console.log(`  Reply: ${f.reply.slice(0, 150)}`)
      f.issues.forEach(iss => console.log(`  ${iss}`))
    }
  }
}

main()
