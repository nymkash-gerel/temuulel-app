/**
 * Ecommerce Test Script — Replays 15 customer conversations through the chat widget API,
 * then creates corresponding orders, returns, exchanges, gift cards, vouchers, and loyalty
 * transactions through the admin APIs.
 *
 * Usage: npx tsx scripts/ecommerce-test.ts
 *
 * Prerequisites:
 * - App running on localhost:3000
 * - Logged in as shop@temuulel.test / Test1234 (ecommerce store "Монгол Маркет")
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000'

// ─── Auth ────────────────────────────────────────────────────────────────────

let accessToken = ''
let storeId = ''

interface Product {
  id: string
  name: string
  price: number
  category: string
}

interface Customer {
  id: string
  name: string
  phone: string
  address: string
}

const createdCustomers: Map<string, Customer> = new Map()
const createdOrders: Map<string, { id: string; order_number: string; total: number }> = new Map()
const foundProducts: Map<string, Product> = new Map()

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  auth = true
): Promise<unknown> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth && accessToken) {
    headers['Cookie'] = `sb-access-token=${accessToken}`
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!res.ok) {
    console.error(`❌ ${method} ${path} → ${res.status}:`, data)
  }
  return data
}

function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Step 1: Authenticate ────────────────────────────────────────────────────

async function authenticate() {
  log('🔐', 'Authenticating as shop@temuulel.test...')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
    },
    body: JSON.stringify({
      email: 'shop@temuulel.test',
      password: 'Test1234',
    }),
  })

  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) {
    throw new Error(`Auth failed: ${JSON.stringify(data)}`)
  }

  accessToken = data.access_token
  log('✅', 'Authenticated')
}

// ─── Step 2: Get Store ───────────────────────────────────────────────────────

async function getStore() {
  log('🏪', 'Getting store info...')
  const data = await api('GET', '/api/store') as { store?: { id: string; name: string } }
  if (!data.store) {
    // Try alternative endpoint
    const alt = await api('GET', '/api/stores') as { data?: { id: string; name: string }[] }
    if (alt.data?.[0]) {
      storeId = alt.data[0].id
      log('✅', `Store: ${alt.data[0].name} (${storeId})`)
      return
    }
    throw new Error('Could not find store')
  }
  storeId = data.store.id
  log('✅', `Store: ${data.store.name} (${storeId})`)
}

// ─── Step 3: Chat Widget Conversations ───────────────────────────────────────

interface ChatMessage {
  sender: string
  content: string
}

interface Conversation {
  id: string
  scenario: string
  messages: ChatMessage[]
  customerName: string
  customerPhone: string
  customerAddress: string
}

const conversations: Conversation[] = [
  {
    id: 'CONV_001', scenario: 'New order - TV Stand',
    customerName: 'Баярмаа Доржийн', customerPhone: '99123456',
    customerAddress: 'БЗД 1р хороо Чингисийн өргөн чөлөө 15 тоот 23',
    messages: [
      { sender: 'customer', content: 'Сайн байнуу TV тавиур байгаа юу' },
      { sender: 'customer', content: 'Xemjee yumaa xarix gsy?' },
      { sender: 'customer', content: 'Ok avya xurgelt xed boloxoo' },
      { sender: 'customer', content: '99123456' },
      { sender: 'customer', content: 'БЗД 1р хороо Чингисийн өргөн чөлөө 15 тоот 23' },
      { sender: 'customer', content: 'Bayrllaa 👍' },
    ],
  },
  {
    id: 'CONV_002', scenario: 'Size inquiry + order - Cashmere Sweater',
    customerName: 'Энхжаргал Батаа', customerPhone: '95172686',
    customerAddress: 'СХД 3р хороо Их монгол гудамж 45 байр 7 давхар 712',
    messages: [
      { sender: 'customer', content: 'khasmir tsamts bga uu' },
      { sender: 'customer', content: 'Xemjee bga we size' },
      { sender: 'customer', content: 'L avmaar bnu ondor ni 168 jin ni 58' },
      { sender: 'customer', content: 'saral ongo L size' },
      { sender: 'customer', content: '95172686 utasdaa' },
      { sender: 'customer', content: 'СХД 3р хороо Их монгол гудамж 45 байр 7 давхар 712' },
    ],
  },
  {
    id: 'CONV_003', scenario: 'Delivery tracking',
    customerName: 'Цэцэгмаа Ганбат', customerPhone: '00000000',
    customerAddress: '',
    messages: [
      { sender: 'customer', content: 'Sain uu bi өчигдөр USB cengeglech zaxialsan xezee irex we' },
      { sender: 'customer', content: 'dugaraa bn uu hurgeltiin' },
      { sender: 'customer', content: 'odoo yaj shalgax we xezee irexiig' },
      { sender: 'customer', content: 'ok brlaa' },
    ],
  },
  {
    id: 'CONV_004', scenario: 'Complaint - wrong color Face Oil',
    customerName: 'Болормаа Төмөр', customerPhone: '88765432',
    customerAddress: 'ХУД 8р хороо Зайсан толгой 12-34',
    messages: [
      { sender: 'customer', content: 'Sain bnu vitamin C tos avsan chini ongo busad deer zaasnii adilgui bn' },
      { sender: 'customer', content: 'ene deer tsagaan gej zaasan chini shargal bn' },
      { sender: 'customer', content: 'solimoor bn uuchlriy' },
      { sender: 'customer', content: 'ok bayrllaa' },
      { sender: 'customer', content: '88765432' },
      { sender: 'customer', content: 'ХУД 8р хороо Зайсан толгой 12-34' },
    ],
  },
  {
    id: 'CONV_005', scenario: 'Return - Wool Hat (refund to bank)',
    customerName: 'Ганбаатар Сүх', customerPhone: '99887766',
    customerAddress: 'СБД 5р хороо Баян зүрх 78-3',
    messages: [
      { sender: 'customer', content: 'sainuu noson malgai 2 honogiin omno avsn chi xemje tomxn sanaad butsax gj bn' },
      { sender: 'customer', content: 'mунгу butsaax' },
      { sender: 'customer', content: 'dans ruu bolno' },
      { sender: 'customer', content: 'Хаан банк 5012345678' },
      { sender: 'customer', content: '99887766' },
      { sender: 'customer', content: 'СБД 5р хороо Баян зүрх 78-3' },
    ],
  },
  {
    id: 'CONV_006', scenario: 'Stock inquiry + order - Lego',
    customerName: 'Мөнхбат Гантулга', customerPhone: '91234567',
    customerAddress: 'ЧД 12р хороо Бага тойруу 33-12',
    messages: [
      { sender: 'customer', content: 'Lego togl bga uu nasa 6-8' },
      { sender: 'customer', content: 'xuwtsas zaavar bga uu zurgtai' },
      { sender: 'customer', content: 'хэд ширхэг дээр үлдсэн бэ' },
      { sender: 'customer', content: 'ok avya' },
      { sender: 'customer', content: '91234567' },
      { sender: 'customer', content: 'ЧД 12р хороо Бага тойруу 33-12' },
    ],
  },
  {
    id: 'CONV_007', scenario: 'Exchange - broken Bluetooth Earbuds',
    customerName: 'Наранцэцэг Өлзий', customerPhone: '94567890',
    customerAddress: 'БЗД 18р хороо Энхтайваны өргөн чөлөө 99-4-401',
    messages: [
      { sender: 'customer', content: 'Sain uu bluetooth chixvch avsan chini baruun tal ni duugargaxgui bn' },
      { sender: 'customer', content: 'solimoor solixod urt hugatsaa avax uu' },
      { sender: 'customer', content: 'ok bayrllaa duugargadaggui baraa yavuulsan chi uuchlarai' },
      { sender: 'customer', content: '94567890' },
      { sender: 'customer', content: 'БЗД 18р хороо Энхтайваны өргөн чөлөө 99-4-401' },
    ],
  },
  {
    id: 'CONV_008', scenario: 'Payment issue - Smartwatch',
    customerName: 'Ариунаа Бат', customerPhone: '99112233',
    customerAddress: '',
    messages: [
      { sender: 'customer', content: 'sain smartwatch zaxialsan chini mungu shiljuulsen ch hurgelt orcixgui bn' },
      { sender: 'customer', content: '99112233' },
      { sender: 'customer', content: 'trade pay aar' },
      { sender: 'customer', content: 'xezee garax we tegvel' },
      { sender: 'customer', content: 'ok medlee shd' },
    ],
  },
  {
    id: 'CONV_009', scenario: 'Multiple items - 3x Shampoo+Conditioner',
    customerName: 'Дорж Баяр', customerPhone: '96543210',
    customerAddress: 'НЗД 22р хороо Их тэнгэр 56-7',
    messages: [
      { sender: 'customer', content: 'Шампунь кондишнер бий юу' },
      { sender: 'customer', content: '2 bagts avmaar duraar xemjedexuu' },
      { sender: 'customer', content: 'xөнгөлөлт bgaa yum uu olnoor avval' },
      { sender: 'customer', content: 'ok tegvel 3 bagts avya' },
      { sender: 'customer', content: '96543210' },
      { sender: 'customer', content: 'НЗД 22р хороо Их тэнгэр 56-7' },
    ],
  },
  {
    id: 'CONV_010', scenario: 'Price negotiation - Leather Bag',
    customerName: 'Сарантуяа Мөнх', customerPhone: '88998877',
    customerAddress: 'ХУД 4р хороо Их тэнгэр 88 байр 3 давхар',
    messages: [
      { sender: 'customer', content: 'arsan tsunh bga uu xar ungutei' },
      { sender: 'customer', content: 'үнэ xөнгөлөх boloxyy 120 гээд yaixan undur bn' },
      { sender: 'customer', content: 'тэглээ L xemjeetei yum bnu l bga uu' },
      { sender: 'customer', content: 'ok avna 115 bolgoj ug shd' },
      { sender: 'customer', content: 'ok l avya xar ongo' },
      { sender: 'customer', content: '88998877' },
      { sender: 'customer', content: 'ХУД 4р хороо Их тэнгэр 88 байр 3 давхар' },
    ],
  },
  {
    id: 'CONV_011', scenario: 'Urgent delivery - Smartwatch',
    customerName: 'Отгонбаяр Эрдэнэ', customerPhone: '92345678',
    customerAddress: 'СБД 11р хороо Мөнх тэнгэр 77-8-805',
    messages: [
      { sender: 'customer', content: 'Яаралтай хүргэлт хийх боломжтой юу? Маргааш бэлэг өгөх гэж байна' },
      { sender: 'customer', content: 'Smartwatch avmaar xөнгөлөлт byu 125 mung ni' },
      { sender: 'customer', content: '92345678' },
      { sender: 'customer', content: 'СБД 11р хороо Мөнх тэнгэр 77-8-805' },
    ],
  },
  {
    id: 'CONV_012', scenario: 'Wrong item delivered',
    customerName: 'Тэмүүлэн Ганбат', customerPhone: '98765432',
    customerAddress: '',
    messages: [
      { sender: 'customer', content: 'Noson malgai zaxialsan chini bluetooth chixvch irsen' },
      { sender: 'customer', content: '98765432' },
      { sender: 'customer', content: 'ok tegye xezee ocox we' },
    ],
  },
  {
    id: 'CONV_013', scenario: 'Gift wrapping - Cashmere Sweater',
    customerName: 'Нарангэрэл Бат', customerPhone: '91111222',
    customerAddress: 'БЗД 9р хороо Сүхбаатар гудамж 12-34',
    messages: [
      { sender: 'customer', content: 'khasmir tsamts beleg booj bolox uu' },
      { sender: 'customer', content: 'ok bolno M size tsagaan ongo beleg booltoi' },
      { sender: 'customer', content: 'bichig bichij bolox uu beleg deer' },
      { sender: 'customer', content: '"Ээж минь танд" гэж бичүүлье' },
      { sender: 'customer', content: '91111222' },
      { sender: 'customer', content: 'БЗД 9р хороо Сүхбаатар гудамж 12-34' },
    ],
  },
  {
    id: 'CONV_014', scenario: 'Bulk order - 50x Smartwatch',
    customerName: 'Компани Admin', customerPhone: '70123456',
    customerAddress: 'СХД 8р хороо Бизнес Төв 5 давхар',
    messages: [
      { sender: 'customer', content: 'Сайн уу. Smartwatch 20 ширхэг захиалахад хөнгөлөлт өгөх үү? Компанийн бэлэг.' },
      { sender: 'customer', content: '10% bolix uu xiivl 50 shirxeg avval' },
      { sender: 'customer', content: 'ok tegvel 50 shirxeg zaxialna. nevtreh bichig xeregtei yum uu' },
      { sender: 'customer', content: '"Монголиан Тех" ХХК Регистр: 1234567890 Утас: 70123456 Хаяг: СХД 8р хороо Бизнес Төв 5 давхар' },
    ],
  },
  {
    id: 'CONV_015', scenario: 'Late night - USB-C charger',
    customerName: 'Батжаргал Цэнд', customerPhone: '89012345',
    customerAddress: 'ЧД 6р хороо Их тойруу 44-2',
    messages: [
      { sender: 'customer', content: 'Сайн уу одоо ажиллаж байгаа юу' },
      { sender: 'customer', content: 'USB cengeglech biy uu xurdan cengelguur 65W' },
      { sender: 'customer', content: 'apple macbook deer ajillax uu' },
      { sender: 'customer', content: 'ok avya' },
      { sender: 'customer', content: '89012345' },
      { sender: 'customer', content: 'ЧД 6р хороо Их тойруу 44-2' },
    ],
  },
]

// Product name → expected test product mapping
const productMap: Record<string, { name: string; price: number }> = {
  'CONV_001': { name: 'TV тавиур', price: 55000 },
  'CONV_002': { name: 'Кашемир цамц', price: 189000 },
  'CONV_004': { name: 'Витамин C', price: 28000 },
  'CONV_005': { name: 'Ноосон малгай', price: 35000 },
  'CONV_006': { name: 'Lego', price: 42000 },
  'CONV_007': { name: 'Bluetooth чихэвч', price: 85000 },
  'CONV_008': { name: 'Smartwatch', price: 125000 },
  'CONV_009': { name: 'Шампунь', price: 32000 },
  'CONV_010': { name: 'Арьсан цүнх', price: 120000 },
  'CONV_011': { name: 'Smartwatch', price: 125000 },
  'CONV_013': { name: 'Кашемир цамц', price: 189000 },
  'CONV_014': { name: 'Smartwatch', price: 125000 },
  'CONV_015': { name: 'USB-C', price: 45000 },
}

async function runChatConversation(conv: Conversation) {
  log('💬', `[${conv.id}] ${conv.scenario}`)
  let conversationId: string | undefined

  for (const msg of conv.messages) {
    const payload: Record<string, unknown> = {
      store_id: storeId,
      customer_message: msg.content,
    }
    if (conversationId) payload.conversation_id = conversationId

    const result = await api('POST', '/api/chat/widget', payload, false) as {
      response?: string
      intent?: string
      products_found?: number
      conversation_id?: string
    }

    const preview = result.response?.slice(0, 80) || '(no response)'
    console.log(`  👤 ${msg.content.slice(0, 60)}`)
    console.log(`  🤖 [${result.intent}] ${preview}...`)

    // Some implementations return conversation_id
    if (result.conversation_id) conversationId = result.conversation_id

    await sleep(300) // respect rate limits
  }

  return conversationId
}

// ─── Step 4: Create customers ────────────────────────────────────────────────

async function createCustomers() {
  log('👥', 'Creating customers from conversations...')

  const customerData = conversations
    .filter((c) => c.customerPhone !== '00000000' && c.customerAddress)
    .map((c) => ({
      convId: c.id,
      name: c.customerName,
      phone: c.customerPhone,
      address: c.customerAddress,
    }))

  for (const cd of customerData) {
    const result = await api('POST', '/api/customers', {
      name: cd.name,
      phone: cd.phone,
      address: cd.address,
      channel: 'messenger',
    }) as { customer?: { id: string } }

    if (result.customer) {
      createdCustomers.set(cd.convId, {
        id: result.customer.id,
        name: cd.name,
        phone: cd.phone,
        address: cd.address,
      })
      log('  ✅', `${cd.name} (${cd.phone})`)
    }
    await sleep(200)
  }
}

// ─── Step 5: Search products to get real IDs ─────────────────────────────────

async function findProducts() {
  log('📦', 'Finding product IDs...')

  const searches = ['TV тавиур', 'Кашемир', 'Витамин', 'Ноосон малгай', 'Lego',
    'Bluetooth чихэвч', 'Smartwatch', 'Шампунь', 'Арьсан цүнх', 'USB-C']

  for (const q of searches) {
    const result = await api('GET', `/api/products/search?store_id=${storeId}&query=${encodeURIComponent(q)}`) as {
      data?: { id: string; name: string; price: number; category: string }[]
    }
    if (result.data?.[0]) {
      foundProducts.set(result.data[0].name, {
        id: result.data[0].id,
        name: result.data[0].name,
        price: result.data[0].price,
        category: result.data[0].category || '',
      })
      log('  ✅', `${result.data[0].name} → ${result.data[0].id}`)
    } else {
      log('  ⚠️', `No product found for: ${q}`)
    }
    await sleep(200)
  }
}

function findProductForConv(convId: string): Product | undefined {
  const mapping = productMap[convId]
  if (!mapping) return undefined
  for (const [, p] of foundProducts) {
    if (p.name.includes(mapping.name)) return p
  }
  return undefined
}

// ─── Step 6: Create orders ───────────────────────────────────────────────────

async function createOrders() {
  log('🛒', 'Creating orders...')

  // CONV_001: TV Stand - 55,000₮
  await createOrder('CONV_001', 1)
  // CONV_002: Cashmere Sweater L Саарал - 189,000 + 5,000 delivery
  await createOrder('CONV_002', 1, 'L size, Саарал өнгө')
  // CONV_005: Wool Hat (will be returned)
  await createOrder('CONV_005', 1, 'Буцаалтын тест')
  // CONV_006: Lego - 42,000₮
  await createOrder('CONV_006', 1, 'Нас 6-8')
  // CONV_007: Bluetooth Earbuds (will be exchanged)
  await createOrder('CONV_007', 1, 'Солилтын тест')
  // CONV_008: Smartwatch (payment pending)
  await createOrder('CONV_008', 1, 'Trade Pay - баталгаажуулалт хүлээж байна')
  // CONV_009: Shampoo+Conditioner x3 - 96,000₮ free delivery
  await createOrder('CONV_009', 3, '3 багц, үнэгүй хүргэлт')
  // CONV_010: Leather Bag Black L - 120,000₮
  await createOrder('CONV_010', 1, 'Хар өнгө, L хэмжээ')
  // CONV_011: Smartwatch urgent - 125,000 + 5,000
  await createOrder('CONV_011', 1, 'Яаралтай хүргэлт, бэлэг')
  // CONV_013: Cashmere Sweater M White + gift wrap
  await createOrder('CONV_013', 1, 'M size, Цагаан, бэлгийн боодол +3000₮, "Ээж минь танд"')
  // CONV_014: Smartwatch x50 bulk - 112,500₮/each
  await createOrder('CONV_014', 50, 'Монголиан Тех ХХК, 10% хөнгөлөлт, нэхэмжлэхтэй')
  // CONV_015: USB-C 65W charger
  await createOrder('CONV_015', 1, 'Шөнийн захиалга')
}

async function createOrder(convId: string, qty: number, notes?: string) {
  const product = findProductForConv(convId)
  const customer = createdCustomers.get(convId)

  if (!product) {
    log('  ⚠️', `[${convId}] Product not found, skipping order`)
    return
  }

  const result = await api('POST', '/api/orders', {
    store_id: storeId,
    customer_id: customer?.id || null,
    items: [{
      product_id: product.id,
      quantity: qty,
      unit_price: product.price,
    }],
    shipping_address: customer?.address || null,
    notes: notes || null,
    order_type: 'delivery',
  }) as { order_id?: string; order_number?: string; total_amount?: number; error?: string }

  if (result.order_id) {
    createdOrders.set(convId, {
      id: result.order_id,
      order_number: result.order_number || '',
      total: result.total_amount || 0,
    })
    log('  ✅', `[${convId}] ${result.order_number} — ${result.total_amount?.toLocaleString()}₮`)
  }
  await sleep(200)
}

// ─── Step 7: Returns ─────────────────────────────────────────────────────────

async function createReturns() {
  log('↩️', 'Creating returns...')

  // CONV_005: Wool Hat return - refund to bank
  const order005 = createdOrders.get('CONV_005')
  if (order005) {
    const result = await api('POST', '/api/returns', {
      order_id: order005.id,
      return_type: 'full',
      reason: 'Хэмжээ том, тохирсонгүй',
      refund_amount: 35000,
      refund_method: 'bank',
      admin_notes: 'Хаан банк 5012345678 руу буцаана',
    }) as { id?: string; return_number?: string }

    if (result.return_number) {
      log('  ✅', `[CONV_005] ${result.return_number} — Wool Hat return, 35,000₮ to bank`)
    }
  }
}

// ─── Step 8: Exchanges (as return + new order) ──────────────────────────────

async function createExchanges() {
  log('🔄', 'Creating exchanges...')

  // CONV_004: Face Oil - wrong color → exchange
  const order004 = createdOrders.get('CONV_004')
  if (!order004) {
    // Create the original order first for the complaint
    await createOrder('CONV_004', 1, 'Буруу өнгөтэй бүтээгдэхүүн явсан')
    const order = createdOrders.get('CONV_004')
    if (order) {
      const ret = await api('POST', '/api/returns', {
        order_id: order.id,
        return_type: 'full',
        reason: 'Буруу өнгөтэй бүтээгдэхүүн — цагаан гэж заасан чини шаргал ирсэн',
        refund_amount: 0,
        admin_notes: 'Солих — зөв бүтээгдэхүүн дахин явуулна, үнэгүй хүргэлт',
      }) as { return_number?: string }
      if (ret.return_number) {
        log('  ✅', `[CONV_004] ${ret.return_number} — Face Oil exchange (wrong color)`)
      }
    }
  }

  // CONV_007: Bluetooth Earbuds - right side broken → exchange
  const order007 = createdOrders.get('CONV_007')
  if (order007) {
    const ret = await api('POST', '/api/returns', {
      order_id: order007.id,
      return_type: 'full',
      reason: 'Баруун талын чихэвч дуугарахгүй — эвдрэлтэй бараа',
      refund_amount: 0,
      admin_notes: 'Солих — шинэ ажиллагаатай бүтээгдэхүүн явуулна',
    }) as { return_number?: string }
    if (ret.return_number) {
      log('  ✅', `[CONV_007] ${ret.return_number} — Bluetooth earbuds exchange (defective)`)
    }
  }

  // CONV_012: Wrong item delivered (ordered Wool Hat, got Bluetooth earbuds)
  // Create original order first
  const product005 = findProductForConv('CONV_005') // Wool Hat
  if (product005) {
    const customer = createdCustomers.get('CONV_012')
    const orderResult = await api('POST', '/api/orders', {
      store_id: storeId,
      customer_id: customer?.id || null,
      items: [{ product_id: product005.id, quantity: 1, unit_price: product005.price }],
      notes: 'Буруу бараа явсан — ноосон малгай захиалсан, bluetooth чихэвч ирсэн',
      order_type: 'delivery',
    }) as { order_id?: string; order_number?: string }

    if (orderResult.order_id) {
      createdOrders.set('CONV_012', { id: orderResult.order_id, order_number: orderResult.order_number || '', total: product005.price })
      const ret = await api('POST', '/api/returns', {
        order_id: orderResult.order_id,
        return_type: 'full',
        reason: 'Буруу бараа хүргэсэн — ноосон малгай захиалсан, bluetooth чихэвч ирсэн',
        refund_amount: 0,
        admin_notes: 'Жолооч буруу барааг авч, зөв ноосон малгай хүргэнэ',
      }) as { return_number?: string }
      if (ret.return_number) {
        log('  ✅', `[CONV_012] ${ret.return_number} — Wrong item exchange`)
      }
    }
  }
}

// ─── Step 9: Gift Cards ──────────────────────────────────────────────────────

async function createGiftCards() {
  log('🎁', 'Creating gift cards...')

  const cards = [
    { code: 'GIFT-EEJ-001', balance: 50000, note: 'Ээжийн бэлэг' },
    { code: 'GIFT-WELCOME-10K', balance: 10000, note: 'Шинэ хэрэглэгч' },
    { code: 'GIFT-VIP-100K', balance: 100000, note: 'VIP customer' },
    { code: 'GIFT-NEWYEAR-25K', balance: 25000, note: 'Шинэ жилийн бэлэг' },
    { code: 'GIFT-BIRTHDAY-30K', balance: 30000, note: 'Төрсөн өдрийн бэлэг' },
  ]

  for (const card of cards) {
    const result = await api('POST', '/api/gift-cards', {
      code: card.code,
      initial_balance: card.balance,
      current_balance: card.balance,
    }) as { id?: string; code?: string }

    if (result.id) {
      log('  ✅', `${card.code} — ${card.balance.toLocaleString()}₮ (${card.note})`)
    }
    await sleep(200)
  }
}

// ─── Step 10: Vouchers ───────────────────────────────────────────────────────

async function createVouchers() {
  log('🏷️', 'Creating vouchers...')

  // Vouchers are complaint-based compensation in this schema
  // Let's check if there's a direct create endpoint
  const result = await api('POST', '/api/vouchers', {
    voucher_code: 'SORRY-COLOR-10',
    compensation_type: 'percentage',
    compensation_value: 10,
    complaint_category: 'wrong_item',
    complaint_summary: 'Буруу өнгөтэй бүтээгдэхүүн явсан',
    status: 'approved',
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }) as { id?: string; error?: string }

  if (result.id) {
    log('  ✅', 'SORRY-COLOR-10 — 10% off (wrong color complaint)')
  } else {
    log('  ⚠️', `Voucher creation: ${JSON.stringify(result)}`)
  }

  // More vouchers
  const vouchers = [
    { code: 'SORRY-DEFECT-15', type: 'percentage', value: 15, category: 'defective_product', summary: 'Эвдрэлтэй бараа — Bluetooth чихэвч' },
    { code: 'FREESHIP-APOLOGY', type: 'free_delivery', value: 5000, category: 'wrong_delivery', summary: 'Буруу бараа хүргэсэн' },
    { code: 'LOYAL-5000', type: 'fixed', value: 5000, category: 'loyalty_reward', summary: 'Тогтмол хэрэглэгчийн урамшуулал' },
    { code: 'BULK-EXTRA-5', type: 'percentage', value: 5, category: 'bulk_order', summary: 'Бөөний захиалгын нэмэлт хөнгөлөлт' },
  ]

  for (const v of vouchers) {
    await api('POST', '/api/vouchers', {
      voucher_code: v.code,
      compensation_type: v.type,
      compensation_value: v.value,
      complaint_category: v.category,
      complaint_summary: v.summary,
      status: 'approved',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    await sleep(200)
  }
  log('  ✅', `Created ${vouchers.length + 1} vouchers total`)
}

// ─── Step 11: Loyalty Points ─────────────────────────────────────────────────

async function createLoyaltyTransactions() {
  log('⭐', 'Creating loyalty point transactions...')

  // Award points for completed orders (1% of order value = points)
  const earnConvs = ['CONV_001', 'CONV_002', 'CONV_006', 'CONV_009', 'CONV_010', 'CONV_013', 'CONV_015']

  for (const convId of earnConvs) {
    const customer = createdCustomers.get(convId)
    const order = createdOrders.get(convId)
    if (!customer || !order) continue

    const points = Math.floor(order.total / 100) // 1 point per 100₮

    const result = await api('POST', '/api/loyalty-transactions', {
      customer_id: customer.id,
      points,
      transaction_type: 'earn',
      reference_type: 'order',
      reference_id: order.id,
      description: `${order.order_number} захиалгын оноо — ${order.total.toLocaleString()}₮`,
    }) as { id?: string }

    if (result.id) {
      log('  ✅', `${customer.name}: +${points} pts (${order.order_number})`)
    }
    await sleep(200)
  }

  // Bulk order bonus points for CONV_014
  const customer014 = createdCustomers.get('CONV_014')
  const order014 = createdOrders.get('CONV_014')
  if (customer014 && order014) {
    await api('POST', '/api/loyalty-transactions', {
      customer_id: customer014.id,
      points: 5000,
      transaction_type: 'earn',
      reference_type: 'bulk_bonus',
      reference_id: order014.id,
      description: 'Бөөний захиалгын бонус оноо — 50 ширхэг Smartwatch',
    })
    log('  ✅', `Компани Admin: +5000 pts (bulk bonus)`)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  🏪 Temuulel E-commerce Test — Монгол Маркет')
  console.log('═══════════════════════════════════════════════════════════\n')

  try {
    await authenticate()
    await getStore()
    await findProducts()

    console.log('\n── Chat Conversations ──────────────────────────────────\n')
    for (const conv of conversations) {
      await runChatConversation(conv)
      console.log()
    }

    console.log('\n── Admin Operations ────────────────────────────────────\n')
    await createCustomers()
    console.log()
    await createOrders()
    console.log()
    await createReturns()
    console.log()
    await createExchanges()
    console.log()
    await createGiftCards()
    console.log()
    await createVouchers()
    console.log()
    await createLoyaltyTransactions()

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  ✅ Test complete!')
    console.log(`  📊 Customers: ${createdCustomers.size}`)
    console.log(`  📊 Orders: ${createdOrders.size}`)
    console.log(`  📊 Products found: ${foundProducts.size}`)
    console.log('═══════════════════════════════════════════════════════════\n')
  } catch (err) {
    console.error('💥 Fatal error:', err)
    process.exit(1)
  }
}

main()
