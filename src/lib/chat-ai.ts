/**
 * Shared AI chat logic: intent classification, search helpers, and response generation.
 * Used by both /api/chat/ai (authenticated dashboard) and /api/chat/widget (public widget).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatbotSettings {
  welcome_message?: string
  away_message?: string
  tone?: string
  language?: string
  show_prices?: boolean
  max_products?: number
  auto_handoff?: boolean
  handoff_keywords?: string
}

export interface ProductMatch {
  id: string
  name: string
  description: string
  category: string
  base_price: number
  images: string[]
  sales_script: string | null
}

export interface OrderMatch {
  id: string
  order_number: string
  status: string
  total_amount: number
  tracking_number: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Intent Classification
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<string, string[]> = {
  product_search: [
    'бүтээгдэхүүн', 'бараа', 'юу', 'ямар', 'хувцас', 'гутал', 'цүнх',
    'пүүз', 'аксессуар', 'хайх', 'байна уу', 'байгаа', 'харуулна уу',
    'үнэ', 'үнэтэй', 'хямд', 'шинэ', 'сонирхож', 'авмаар', 'худалдаж',
    'зарна', 'зарах', 'категори', 'төрөл',
  ],
  order_status: [
    'захиалга', 'хүргэлт', 'хаана', 'ирэх', 'илгээсэн', 'явсан',
    'статус', 'трэк', 'дугаар', 'хэзээ', 'захиалсан', 'хүлээж',
  ],
  greeting: [
    'сайн байна', 'сайн уу', 'байна уу', 'hello', 'hi', 'сайхан',
    'өглөөний мэнд', 'мэнд',
  ],
  thanks: [
    'баярлалаа', 'гайхалтай', 'сайхан', 'маш сайн', 'рахмат',
    'харин', 'thanks', 'thank',
  ],
  complaint: [
    'гомдол', 'асуудал', 'муу', 'буруу', 'алдаа', 'сэтгэл ханамжгүй',
    'солих', 'буцаах', 'буцаалт', 'чанар',
  ],
  size_info: [
    'размер', 'хэмжээ', 'size', 'том', 'жижиг', 'дунд',
    's ', 'm ', 'l ', 'xl', 'xxl',
  ],
  payment: [
    'төлбөр', 'төлөх', 'данс', 'шилжүүлэг', 'qpay', 'карт',
    'бэлэн', 'зээл', 'хуваах',
  ],
  shipping: [
    'хүргэлт', 'хүргэх', 'хаяг', 'хотод', 'хөдөө', 'шуудан',
    'унаа', 'ирэх', 'өдөр', 'хоног',
  ],
}

export function classifyIntent(message: string): string {
  const lower = message.toLowerCase()

  let bestIntent = 'general'
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score++
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  return bestIntent
}

// ---------------------------------------------------------------------------
// Search Helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = [
  'байна', 'уу', 'юу', 'та', 'нар', 'надад', 'энэ', 'тэр', 'ямар',
  'ямар нэг', 'нэг', 'хэд', 'хэдэн', 'чи', 'бид', 'тэд', 'манай',
  'танай', 'миний', 'маш', 'их', 'бага', 'мөн', 'бас', 'ба', 'болон',
  'гэж', 'гэсэн', 'гэдэг', 'гэхэд', 'харуулна', 'харуул', 'хайх',
  'сайн', 'өглөөний', 'мэнд', 'сонирхож', 'авмаар', 'байгаа',
]

export const CATEGORY_MAP: Record<string, string> = {
  'хувцас': 'clothing',
  'гутал': 'shoes',
  'пүүз': 'shoes',
  'цүнх': 'bags',
  'аксессуар': 'accessories',
  'бүс': 'accessories',
}

export function extractSearchTerms(message: string): string {
  const words = message.toLowerCase().split(/\s+/)
  const meaningful = words.filter((w) => w.length > 1 && !STOP_WORDS.includes(w))
  return meaningful.join(' ')
}

/**
 * Generic product search. Accepts any Supabase client (browser or service-role).
 */
export async function searchProducts(
  supabase: { from: (table: string) => unknown },
  query: string,
  storeId: string,
  maxProducts?: number
): Promise<ProductMatch[]> {
  const lowerQuery = query.toLowerCase()
  let mappedCategory: string | null = null
  for (const [mn, en] of Object.entries(CATEGORY_MAP)) {
    if (lowerQuery.includes(mn)) {
      mappedCategory = en
      break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery = (supabase as any)
    .from('products')
    .select('id, name, description, category, base_price, images, sales_script')
    .eq('store_id', storeId)
    .eq('status', 'active')

  if (mappedCategory) {
    dbQuery = dbQuery.eq('category', mappedCategory)
  } else if (query.trim()) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`)
  }

  const { data } = await dbQuery.limit(maxProducts || 5)
  return (data as ProductMatch[]) || []
}

/**
 * Generic order search.
 */
export async function searchOrders(
  supabase: { from: (table: string) => unknown },
  query: string,
  storeId: string,
  customerId?: string
): Promise<OrderMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery = (supabase as any)
    .from('orders')
    .select('id, order_number, status, total_amount, tracking_number, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })

  if (customerId) {
    dbQuery = dbQuery.eq('customer_id', customerId)
  }

  if (query) {
    dbQuery = dbQuery.or(`order_number.ilike.%${query}%`)
  }

  const { data } = await dbQuery.limit(5)
  return (data as OrderMatch[]) || []
}

// ---------------------------------------------------------------------------
// Response Generation
// ---------------------------------------------------------------------------

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

const ORDER_STATUS_MAP: Record<string, string> = {
  pending: '⏳ Хүлээгдэж байна',
  confirmed: '✅ Баталгаажсан',
  processing: '📦 Бэлтгэж байна',
  shipped: '🚚 Илгээсэн',
  delivered: '✅ Хүргэгдсэн',
  cancelled: '❌ Цуцлагдсан',
}

export function generateResponse(
  intent: string,
  products: ProductMatch[],
  orders: OrderMatch[],
  storeName: string,
  settings?: ChatbotSettings
): string {
  const showPrices = settings?.show_prices !== false

  switch (intent) {
    case 'greeting':
      return settings?.welcome_message ||
        `Сайн байна уу! 😊 ${storeName}-д тавтай морил. Танд юугаар туслах вэ?\n\nБи танд бүтээгдэхүүний мэдээлэл, захиалгын статус, хүргэлтийн мэдээлэл зэргийг хэлж өгөх боломжтой.`

    case 'thanks':
      return `Баярлалаа! 🙏 Бусад асуулт байвал чөлөөтэй бичээрэй. Бид үргэлж тусалхад бэлэн!`

    case 'product_search': {
      if (products.length === 0) {
        return `Уучлаарай, таны хайсан бүтээгдэхүүн одоогоор байхгүй байна. 😔\n\nӨөр бүтээгдэхүүн сонирхож байвал бичнэ үү, эсвэл бид танд шинэ бүтээгдэхүүн ирэхэд мэдэгдэх боломжтой.`
      }

      let response = `Танд тохирох бүтээгдэхүүнүүд:\n\n`
      products.forEach((p, i) => {
        response += `${i + 1}. **${p.name}**\n`
        if (showPrices) response += `   💰 ${formatPrice(p.base_price)}\n`
        if (p.description) {
          const shortDesc = p.description.length > 80
            ? p.description.substring(0, 80) + '...'
            : p.description
          response += `   📝 ${shortDesc}\n`
        }
        if (p.sales_script) {
          response += `   ✨ ${p.sales_script}\n`
        }
        response += '\n'
      })
      response += `Аль бүтээгдэхүүний талаар дэлгэрэнгүй мэдээлэл авмаар байна?`
      return response
    }

    case 'order_status': {
      if (orders.length === 0) {
        return `Уучлаарай, захиалгын мэдээлэл олдсонгүй. 📦\n\nЗахиалгын дугаараа оруулна уу, эсвэл бид танд тусалж мэдээлэл шалгах боломжтой.`
      }

      let response = `Таны захиалгын мэдээлэл:\n\n`
      orders.forEach((o) => {
        response += `📋 **${o.order_number}**\n`
        response += `   Статус: ${ORDER_STATUS_MAP[o.status] || o.status}\n`
        response += `   Дүн: ${formatPrice(o.total_amount)}\n`
        if (o.tracking_number) {
          response += `   Трэкинг: ${o.tracking_number}\n`
        }
        response += `   Огноо: ${new Date(o.created_at).toLocaleDateString('mn-MN')}\n\n`
      })
      return response
    }

    case 'complaint':
      return `Уучлаарай таны санал хүсэлтийг хүлээн авлаа. 🙏\n\nБидний менежер тантай холбогдож асуудлыг шийдвэрлэнэ. Та утасны дугаараа үлдээнэ үү, эсвэл бид энэ чатаар дамжуулан тусалъя.\n\nТаны сэтгэл ханамж бидний хувьд маш чухал!`

    case 'size_info':
      return `Размерийн мэдээлэл:\n\n📏 **Ерөнхий хэмжээ:**\n• S - Жижиг (36-38)\n• M - Дунд (38-40)\n• L - Том (40-42)\n• XL - Маш том (42-44)\n• XXL - Нэмэлт том (44-46)\n\nТодорхой бүтээгдэхүүний размерийн хүснэгтийг авмаар бол бүтээгдэхүүний нэрийг бичнэ үү.`

    case 'payment':
      return `Төлбөрийн мэдээлэл:\n\n💳 **Бид дараах төлбөрийн хэлбэрүүдийг хүлээн авна:**\n• QPay - QR код уншуулж төлөх\n• Дансаар шилжүүлэг\n• Бэлнээр (хүргэлтийн үед)\n\nТөлбөрийн талаар нэмэлт асуулт байвал бичнэ үү.`

    case 'shipping':
      return `Хүргэлтийн мэдээлэл:\n\n🚚 **Хүргэлтийн нөхцөл:**\n• Улаанбаатар хот: 1-2 ажлын өдөр\n• Хөдөө орон нутаг: 3-5 ажлын өдөр\n• Хүргэлтийн төлбөр захиалгын дүнгээс хамаарна\n\nТа хаягаа бичвэл бид хүргэлтийн төлбөрийг тооцоолж хэлж өгье.`

    default: {
      if (products.length > 0) {
        let response = `Баярлалаа мессеж бичсэнд! Танд дараах бүтээгдэхүүнүүд байна:\n\n`
        products.slice(0, 3).forEach((p, i) => {
          response += `${i + 1}. ${p.name} - ${formatPrice(p.base_price)}\n`
        })
        response += `\nДэлгэрэнгүй мэдээлэл авмаар бол бичнэ үү!`
        return response
      }

      return `Баярлалаа мессеж бичсэнд! 😊\n\nБи танд дараах зүйлсээр тусалж чадна:\n• 📦 Бүтээгдэхүүний мэдээлэл\n• 📋 Захиалгын статус\n• 🚚 Хүргэлтийн мэдээлэл\n• 💳 Төлбөрийн мэдээлэл\n• 📏 Размерийн зөвлөгөө\n\nТа юуны талаар мэдмээр байна?`
    }
  }
}

/**
 * Check if a message matches configured handoff keywords.
 */
export function matchesHandoffKeywords(message: string, settings: ChatbotSettings): boolean {
  if (!settings.auto_handoff || !settings.handoff_keywords) return false
  const keywords = settings.handoff_keywords.split(',').map(k => k.trim().toLowerCase())
  const lower = message.toLowerCase()
  return keywords.some(k => k && lower.includes(k))
}
