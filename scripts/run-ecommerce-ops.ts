/**
 * E-commerce Operations Test — Direct Supabase operations
 * Tests: customers, orders, returns, exchanges, gift cards, vouchers, loyalty, chat widget
 */
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = 'https://yglemwhbvhupoqniyxog.supabase.co'
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const sb = createClient(SUPA_URL, SUPA_KEY)
let storeId = ''
let accessToken = ''

interface ProductRow { id: string; name: string; base_price: number }
const products = new Map<string, ProductRow>()
const customers = new Map<string, string>() // name → id
const orders = new Map<string, { id: string; number: string }>() // label → order

function log(emoji: string, msg: string) { console.log(`${emoji} ${msg}`) }

async function authenticate() {
  const { data, error } = await sb.auth.signInWithPassword({
    email: 'shop@temuulel.test', password: 'Test1234'
  })
  if (error) throw new Error(`Auth: ${error.message}`)
  accessToken = data.session.access_token
  log('🔐', `Authenticated as ${data.user.email}`)

  const { data: store } = await sb.from('stores')
    .select('id, name, business_type')
    .eq('owner_id', data.user.id).single()
  if (!store) throw new Error('Store not found')
  storeId = store.id
  log('🏪', `Store: ${store.name} (${store.business_type})`)
}

async function loadProducts() {
  const { data } = await sb.from('products')
    .select('id, name, base_price')
    .eq('store_id', storeId).eq('status', 'active')
  if (!data) return
  data.forEach(p => products.set(p.name, p))
  log('📦', `Loaded ${data.length} products`)
}

function findProduct(partial: string): ProductRow | undefined {
  for (const [name, p] of products) {
    if (name.includes(partial)) return p
  }
  return undefined
}

// ── Customers ────────────────────────────────────────────────────────
async function createCustomers() {
  log('\n👥', 'Creating customers...')
  const custs = [
    { name: 'Баярмаа Доржийн', phone: '99123456', address: 'БЗД 1р хороо Чингисийн өргөн чөлөө 15 тоот 23' },
    { name: 'Энхжаргал Батаа', phone: '95172686', address: 'СХД 3р хороо Их монгол гудамж 45 байр 7 давхар 712' },
    { name: 'Болормаа Төмөр', phone: '88765432', address: 'ХУД 8р хороо Зайсан толгой 12-34' },
    { name: 'Ганбаатар Сүх', phone: '99887766', address: 'СБД 5р хороо Баян зүрх 78-3' },
    { name: 'Мөнхбат Гантулга', phone: '91234567', address: 'ЧД 12р хороо Бага тойруу 33-12' },
    { name: 'Наранцэцэг Өлзий', phone: '94567890', address: 'БЗД 18р хороо Энхтайваны өргөн чөлөө 99-4-401' },
    { name: 'Ариунаа Бат', phone: '99112233', address: 'БГД 7р хороо' },
    { name: 'Дорж Баяр', phone: '96543210', address: 'НЗД 22р хороо Их тэнгэр 56-7' },
    { name: 'Сарантуяа Мөнх', phone: '88998877', address: 'ХУД 4р хороо Их тэнгэр 88 байр 3 давхар' },
    { name: 'Отгонбаяр Эрдэнэ', phone: '92345678', address: 'СБД 11р хороо Мөнх тэнгэр 77-8-805' },
    { name: 'Тэмүүлэн Ганбат', phone: '98765432', address: 'БЗД 4р хороо' },
    { name: 'Нарангэрэл Бат', phone: '91111222', address: 'БЗД 9р хороо Сүхбаатар гудамж 12-34' },
    { name: 'Компани Admin', phone: '70123456', address: 'СХД 8р хороо Бизнес Төв 5 давхар' },
    { name: 'Батжаргал Цэнд', phone: '89012345', address: 'ЧД 6р хороо Их тойруу 44-2' },
  ]

  for (const c of custs) {
    const { data, error } = await sb.from('customers').insert({
      store_id: storeId, name: c.name, phone: c.phone, address: c.address, channel: 'messenger'
    }).select('id').single()
    if (error) { log('  ❌', `${c.name}: ${error.message}`); continue }
    customers.set(c.name, data.id)
    log('  ✅', `${c.name} (${c.phone})`)
  }
}

// ── Orders ───────────────────────────────────────────────────────────
async function createOrders() {
  log('\n🛒', 'Creating orders...')

  const orderDefs = [
    { label: 'CONV_001', customer: 'Баярмаа Доржийн', product: 'Зурагтын тавиур', qty: 1, notes: 'TV тавиур захиалга' },
    { label: 'CONV_002', customer: 'Энхжаргал Батаа', product: 'Кашемир цамц', qty: 1, notes: 'L size, Саарал өнгө' },
    { label: 'CONV_004', customer: 'Болормаа Төмөр', product: 'Витамин C', qty: 1, notes: 'Буруу өнгөтэй бүтээгдэхүүн → солих' },
    { label: 'CONV_005', customer: 'Ганбаатар Сүх', product: 'Ноосон малгай', qty: 1, notes: 'Хэмжээ том → буцаалт' },
    { label: 'CONV_006', customer: 'Мөнхбат Гантулга', product: 'Лего', qty: 1, notes: 'Нас 6-8' },
    { label: 'CONV_007', customer: 'Наранцэцэг Өлзий', product: 'чихэвч', qty: 1, notes: 'Баруун тал дуугарахгүй → солих' },
    { label: 'CONV_008', customer: 'Ариунаа Бат', product: 'Ухаалаг цаг', qty: 1, notes: 'Trade Pay, баталгаажуулалт хүлээж байна' },
    { label: 'CONV_009', customer: 'Дорж Баяр', product: 'Шампунь', qty: 3, notes: '3 багц, үнэгүй хүргэлт' },
    { label: 'CONV_010', customer: 'Сарантуяа Мөнх', product: 'Арьсан цүнх', qty: 1, notes: 'Хар өнгө, L хэмжээ' },
    { label: 'CONV_011', customer: 'Отгонбаяр Эрдэнэ', product: 'Ухаалаг цаг', qty: 1, notes: 'Яаралтай хүргэлт, бэлэг' },
    { label: 'CONV_012', customer: 'Тэмүүлэн Ганбат', product: 'Ноосон малгай', qty: 1, notes: 'Буруу бараа хүргэсэн' },
    { label: 'CONV_013', customer: 'Нарангэрэл Бат', product: 'Кашемир цамц', qty: 1, notes: 'M size, Цагаан, бэлгийн боодол "Ээж минь танд"' },
    { label: 'CONV_014', customer: 'Компани Admin', product: 'Ухаалаг цаг', qty: 50, notes: 'Монголиан Тех ХХК, 10% хөнгөлөлт' },
    { label: 'CONV_015', customer: 'Батжаргал Цэнд', product: 'цэнэглэгч', qty: 1, notes: 'Шөнийн захиалга' },
  ]

  for (const o of orderDefs) {
    const product = findProduct(o.product)
    const customerId = customers.get(o.customer)
    if (!product) { log('  ⚠️', `[${o.label}] Product not found: ${o.product}`); continue }

    const orderNumber = `ORD-${Date.now()}-${o.label}`
    const totalAmount = product.base_price * o.qty
    const shippingAmount = o.label === 'CONV_009' ? 0 : 5000 // free shipping for 3+ bagts

    const { data, error } = await sb.from('orders').insert({
      store_id: storeId,
      customer_id: customerId || null,
      order_number: orderNumber,
      status: 'pending',
      total_amount: totalAmount + shippingAmount,
      shipping_amount: shippingAmount,
      payment_status: o.label === 'CONV_008' ? 'pending' : 'paid',
      shipping_address: o.notes,
      notes: o.notes,
      order_type: 'delivery',
    }).select('id, order_number, total_amount').single()

    if (error) { log('  ❌', `[${o.label}] ${error.message}`); continue }

    // Create order items
    await sb.from('order_items').insert({
      order_id: data.id,
      product_id: product.id,
      quantity: o.qty,
      unit_price: product.base_price,
    })

    orders.set(o.label, { id: data.id, number: data.order_number })
    log('  ✅', `[${o.label}] ${data.order_number} — ${totalAmount.toLocaleString()}₮ (${product.name} x${o.qty})`)
  }
}

// ── Returns ──────────────────────────────────────────────────────────
async function createReturns() {
  log('\n↩️', 'Creating returns & exchanges...')

  // CONV_005: Wool Hat — full refund to bank
  const o005 = orders.get('CONV_005')
  if (o005) {
    const { data, error } = await sb.from('return_requests').insert({
      store_id: storeId, order_id: o005.id,
      customer_id: customers.get('Ганбаатар Сүх') || null,
      return_number: `RET-${Date.now()}-005`,
      return_type: 'full', status: 'pending',
      reason: 'Хэмжээ том, тохирсонгүй',
      refund_amount: 35000, refund_method: 'bank',
      admin_notes: 'Хаан банк 5012345678 руу буцаана',
    }).select('id, return_number').single()
    if (data) log('  ✅', `[CONV_005] ${data.return_number} — Ноосон малгай буцаалт 35,000₮`)
    else log('  ❌', `[CONV_005] ${error?.message}`)
  }

  // CONV_004: Face Oil — exchange (wrong color)
  const o004 = orders.get('CONV_004')
  if (o004) {
    const { data } = await sb.from('return_requests').insert({
      store_id: storeId, order_id: o004.id,
      customer_id: customers.get('Болормаа Төмөр') || null,
      return_number: `RET-${Date.now()}-004`,
      return_type: 'full', status: 'approved',
      reason: 'Буруу өнгөтэй бүтээгдэхүүн — цагаан гэж заасан чини шаргал',
      refund_amount: 0,
      admin_notes: 'Солих — зөв бүтээгдэхүүн дахин хүргэнэ',
    }).select('id, return_number').single()
    if (data) log('  ✅', `[CONV_004] ${data.return_number} — Витамин C солилт (буруу өнгө)`)
  }

  // CONV_007: Bluetooth Earbuds — exchange (defective)
  const o007 = orders.get('CONV_007')
  if (o007) {
    const { data } = await sb.from('return_requests').insert({
      store_id: storeId, order_id: o007.id,
      customer_id: customers.get('Наранцэцэг Өлзий') || null,
      return_number: `RET-${Date.now()}-007`,
      return_type: 'full', status: 'approved',
      reason: 'Баруун талын чихэвч дуугарахгүй — эвдрэлтэй бараа',
      refund_amount: 0,
      admin_notes: 'Солих — шинэ бараа хүргэнэ',
    }).select('id, return_number').single()
    if (data) log('  ✅', `[CONV_007] ${data.return_number} — Чихэвч солилт (эвдрэлтэй)`)
  }

  // CONV_012: Wrong item delivered
  const o012 = orders.get('CONV_012')
  if (o012) {
    const { data } = await sb.from('return_requests').insert({
      store_id: storeId, order_id: o012.id,
      customer_id: customers.get('Тэмүүлэн Ганбат') || null,
      return_number: `RET-${Date.now()}-012`,
      return_type: 'full', status: 'approved',
      reason: 'Ноосон малгай захиалсан, bluetooth чихэвч ирсэн',
      refund_amount: 0,
      admin_notes: 'Буруу бараа хүргэсэн — зөв бараа дахин явуулна',
    }).select('id, return_number').single()
    if (data) log('  ✅', `[CONV_012] ${data.return_number} — Буруу бараа хүргэсэн → солих`)
  }
}

// ── Gift Cards ───────────────────────────────────────────────────────
async function createGiftCards() {
  log('\n🎁', 'Creating gift cards...')
  const cards = [
    { code: 'GIFT-EEJ-001', balance: 50000 },
    { code: 'GIFT-WELCOME-10K', balance: 10000 },
    { code: 'GIFT-VIP-100K', balance: 100000 },
    { code: 'GIFT-NEWYEAR-25K', balance: 25000 },
    { code: 'GIFT-BIRTHDAY-30K', balance: 30000 },
  ]
  for (const c of cards) {
    const { data, error } = await sb.from('gift_cards').insert({
      store_id: storeId, code: c.code,
      initial_balance: c.balance, current_balance: c.balance,
    }).select('id, code').single()
    if (data) log('  ✅', `${c.code} — ${c.balance.toLocaleString()}₮`)
    else log('  ❌', `${c.code}: ${error?.message}`)
  }
}

// ── Vouchers ─────────────────────────────────────────────────────────
async function createVouchers() {
  log('\n🏷️', 'Creating vouchers...')
  const vouchers = [
    { code: 'SORRY-COLOR-10', type: 'percentage', value: 10, cat: 'wrong_item', summary: 'Буруу өнгөтэй бүтээгдэхүүн' },
    { code: 'SORRY-DEFECT-15', type: 'percentage', value: 15, cat: 'defective', summary: 'Эвдрэлтэй бараа — Bluetooth чихэвч' },
    { code: 'FREESHIP-APOLOGY', type: 'free_delivery', value: 5000, cat: 'wrong_delivery', summary: 'Буруу бараа хүргэсэн' },
    { code: 'LOYAL-5000', type: 'fixed', value: 5000, cat: 'loyalty', summary: 'Тогтмол хэрэглэгч' },
    { code: 'BULK-EXTRA-5', type: 'percentage', value: 5, cat: 'bulk_order', summary: 'Бөөний захиалгын нэмэлт хөнгөлөлт' },
  ]
  const validUntil = new Date(Date.now() + 30 * 86400000).toISOString()
  for (const v of vouchers) {
    const { data, error } = await sb.from('vouchers').insert({
      store_id: storeId, voucher_code: v.code,
      compensation_type: v.type, compensation_value: v.value,
      complaint_category: v.cat, complaint_summary: v.summary,
      status: 'approved', valid_until: validUntil,
    }).select('id, voucher_code').single()
    if (data) log('  ✅', `${v.code} — ${v.type} ${v.value}`)
    else log('  ❌', `${v.code}: ${error?.message}`)
  }
}

// ── Loyalty Points ───────────────────────────────────────────────────
async function createLoyaltyPoints() {
  log('\n⭐', 'Creating loyalty transactions...')
  const earners = [
    { customer: 'Баярмаа Доржийн', label: 'CONV_001' },
    { customer: 'Энхжаргал Батаа', label: 'CONV_002' },
    { customer: 'Мөнхбат Гантулга', label: 'CONV_006' },
    { customer: 'Дорж Баяр', label: 'CONV_009' },
    { customer: 'Сарантуяа Мөнх', label: 'CONV_010' },
    { customer: 'Нарангэрэл Бат', label: 'CONV_013' },
    { customer: 'Батжаргал Цэнд', label: 'CONV_015' },
  ]
  for (const e of earners) {
    const order = orders.get(e.label)
    const custId = customers.get(e.customer)
    if (!order || !custId) continue
    const points = Math.floor(Number(order.number.length) * 10 + 100) // simplified
    const { error } = await sb.from('loyalty_transactions').insert({
      store_id: storeId, customer_id: custId,
      points: 500, transaction_type: 'earn',
      reference_type: 'order', reference_id: order.id,
      description: `${order.number} захиалгын оноо`,
    })
    if (!error) log('  ✅', `${e.customer}: +500 pts`)
    else log('  ❌', `${e.customer}: ${error.message}`)
  }

  // Bulk bonus
  const bulkCust = customers.get('Компани Admin')
  const bulkOrder = orders.get('CONV_014')
  if (bulkCust && bulkOrder) {
    await sb.from('loyalty_transactions').insert({
      store_id: storeId, customer_id: bulkCust,
      points: 5000, transaction_type: 'earn',
      reference_type: 'bulk_bonus', reference_id: bulkOrder.id,
      description: 'Бөөний захиалгын бонус — 50x Ухаалаг цаг',
    })
    log('  ✅', 'Компани Admin: +5000 pts (bulk bonus)')
  }
}

// ── Chat Widget Test ─────────────────────────────────────────────────
async function testChatWidget() {
  log('\n💬', 'Testing chat widget responses...')
  const messages = [
    'Сайн байнуу',
    'TV тавиур байгаа юу',
    'Кашемир цамц хэд вэ',
    'Bluetooth чихэвч бий юу',
    'хүргэлт хэд хоног',
    'буцаах бодлого',
  ]
  for (const msg of messages) {
    const res = await fetch(`${SUPA_URL}/functions/v1/chat-widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ store_id: storeId, customer_message: msg }),
    }).catch(() => null)

    // Direct classification test (no server needed)
    const { classifyIntent } = await import('../src/lib/chat-ai.js')
    const intent = classifyIntent(msg)
    log('  💬', `"${msg}" → intent: ${intent}`)
  }
}

// ── Summary ──────────────────────────────────────────────────────────
async function summary() {
  const { count: custCount } = await sb.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  const { count: orderCount } = await sb.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  const { count: returnCount } = await sb.from('return_requests').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  const { count: giftCount } = await sb.from('gift_cards').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  const { count: voucherCount } = await sb.from('vouchers').select('id', { count: 'exact', head: true }).eq('store_id', storeId)
  const { count: loyaltyCount } = await sb.from('loyalty_transactions').select('id', { count: 'exact', head: true }).eq('store_id', storeId)

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  📊 Монгол Маркет — Operations Summary')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  👥 Customers:      ${custCount}`)
  console.log(`  🛒 Orders:         ${orderCount}`)
  console.log(`  ↩️  Returns:        ${returnCount}`)
  console.log(`  🎁 Gift Cards:     ${giftCount}`)
  console.log(`  🏷️  Vouchers:       ${voucherCount}`)
  console.log(`  ⭐ Loyalty Txns:   ${loyaltyCount}`)
  console.log('═══════════════════════════════════════════════════\n')
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  🏪 Temuulel E-commerce Operations Test')
  console.log('═══════════════════════════════════════════════════\n')

  await authenticate()
  await loadProducts()
  await createCustomers()
  await createOrders()
  await createReturns()
  await createGiftCards()
  await createVouchers()
  await createLoyaltyPoints()
  await summary()

  console.log('✅ All operations complete!')
}

main().catch(e => { console.error('💥', e); process.exit(1) })
