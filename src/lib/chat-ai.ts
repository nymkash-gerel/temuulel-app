/**
 * Shared AI chat logic: intent classification, search helpers, and response generation.
 * Used by both /api/chat/ai (authenticated dashboard) and /api/chat/widget (public widget).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

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
  escalation_enabled?: boolean
  escalation_threshold?: number
  escalation_message?: string
  return_policy?: string
}

export interface ProductVariantInfo {
  size: string | null
  color: string | null
  price: number
  stock_quantity: number
}

export interface ProductMatch {
  id: string
  name: string
  description: string
  category: string
  base_price: number
  images: string[]
  sales_script: string | null
  product_faqs?: Record<string, string> | null
  ai_context?: string | null
  variants?: ProductVariantInfo[]
  // Restaurant features
  available_today?: boolean
  sold_out?: boolean
  allergens?: string[]
  spicy_level?: number
  is_vegan?: boolean
  is_halal?: boolean
  is_gluten_free?: boolean
  dietary_tags?: string[]
}

export interface TableMatch {
  id: string
  table_name: string
  capacity: number
  status: string
  location: string | null
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
// Text Normalizer — handles Cyrillic/Latin swaps, common typos, punctuation
// ---------------------------------------------------------------------------

/** Latin digraphs that map to single Cyrillic characters (order matters — longest first) */
const LATIN_DIGRAPHS: [string, string][] = [
  ['ts', 'ц'], ['sh', 'ш'], ['ch', 'ч'],
  ['kh', 'х'], ['zh', 'ж'], ['yu', 'ю'],
  ['ya', 'я'], ['yo', 'ё'], ['ye', 'е'],
]

/** Map of Latin characters commonly used instead of Cyrillic equivalents */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф',
  g: 'г', h: 'х', i: 'и', j: 'ж', k: 'к', l: 'л',
  m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с',
  t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
}

/**
 * Normalize a message for keyword matching:
 * 1. Lowercase
 * 2. Replace Latin digraphs (ts→ц, sh→ш, ch→ч, etc.)
 * 3. Replace remaining Latin chars with Cyrillic equivalents
 * 4. Strip punctuation and extra whitespace
 */
export function normalizeText(text: string): string {
  let result = text.toLowerCase()
  // Replace digraphs first (before single-char replacement eats the letters)
  for (const [latin, cyrillic] of LATIN_DIGRAPHS) {
    result = result.split(latin).join(cyrillic)
  }
  // Replace remaining Latin characters with Cyrillic equivalents
  result = result.replace(/[a-z]/g, (ch) => LATIN_TO_CYRILLIC[ch] || ch)
  // Strip punctuation (keep Cyrillic, digits, spaces)
  result = result.replace(/[^\u0400-\u04ff\u0600-\u06ff\d\s]/g, ' ')
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ').trim()
  return result
}

/**
 * Neutralize Mongolian vowel pairs so Latin-typed text matches Cyrillic keywords.
 * Latin "e" → Cyrillic "е" but Mongolian keywords use "э" (хэмжээ, хэд, үнэ)
 * Latin "u" → Cyrillic "у" but Mongolian keywords use "ү" (үнэ, хүргэлт)
 * Latin "o" → Cyrillic "о" but Mongolian keywords use "ө" (өдөр, дөрөв)
 *
 * This function reduces both forms to the same base so they can match:
 * neutralizeVowels("хемжее") === neutralizeVowels("хэмжээ") // both → "хемжее"
 */
export function neutralizeVowels(text: string): string {
  return text
    .replace(/э/g, 'е')
    .replace(/ү/g, 'у')
    .replace(/ө/g, 'о')
    .replace(/й/g, 'и')  // Latin "i" → "и" but Mongolian uses "й" at word endings
}

// ---------------------------------------------------------------------------
// Intent Classification
// ---------------------------------------------------------------------------

/**
 * Keyword lists with aliases: misspellings, slang, informal forms, and
 * transliterated variants that Mongolian customers commonly use.
 */
const INTENT_KEYWORDS: Record<string, string[]> = {
  product_search: [
    // Core
    'бүтээгдэхүүн', 'бараа', 'ямар', 'хувцас', 'гутал', 'цүнх',
    'пүүз', 'аксессуар', 'хайх', 'харуулна уу',
    'үнэ', 'үнэтэй', 'хямд', 'шинэ', 'сонирхож', 'авмаар', 'худалдаж',
    'зарна', 'зарах', 'категори', 'төрөл',
    // Product category names (common search terms)
    'цамц', 'даашинз', 'өмд', 'куртка', 'пальто', 'хүрэм', 'дээл',
    'малгай', 'кашемир', 'ноолуур', 'ноолууран',
    'оймс', 'бээлий', 'ороолт', 'цүнхний',
    // Common product terms from real conversations
    'загвар', 'загварууд', 'өнгө', 'өнгөөр', 'өнгөтэй',
    'тирко', 'турсик', 'леевчик', 'боолт', 'боолтууд',
    'бензэн', 'комд', 'дотортой', 'шилэн', 'гуятай', 'гуягүй',
    // English
    'product', 'products', 'item', 'buy', 'purchase', 'shop', 'catalog',
    'price', 'cheap', 'expensive', 'new arrival', 'show me', 'browse',
    'search', 'find', 'looking for', 'want to buy', 'how much',
    'available', 'in stock',
    // English product names (also triggers product_search intent)
    'cashmere', 'shirt', 'hat', 'bag', 'shoes', 'pants', 'jacket',
    'coat', 'watch', 'earphone', 'headphone', 'charger', 'toy', 'lego',
    'shampoo', 'cream',
    // Aliases — misspellings, informal, transliterated
    'бутээгдэхүүн', 'бутээгдхүүн', 'бүтээгдхүүн',
    'барааа', 'бараагаа',
    'хувцаас', 'хувцс',
    'гуталаа', 'гутлаа',
    'цунх', 'цүнхээ',
    'пууз', 'пүүзээ',
    'аксесуар', 'аксесор',
    'унэ', 'унэтэй', 'үнээ',
    'хямдхан', 'хямдралтай', 'хямдрал', 'хямдарсан', 'үнэгүй',
    'шинэхэн', 'шинээр',
    'авах', 'авъя', 'авья', 'авмааар',
    'хайж', 'хайна', 'хайлт',
    'харуул', 'үзүүл', 'үзүүлнэ үү',
    'каталог', 'жагсаалт',
    // Interest/desire expressions
    'сонирхож', 'сонирхоод', 'сонирхох', 'сонирхи', 'сонирх',
    // Purchase intent (from real FB conversations)
    'авий', 'авии', 'ави', 'авья',
    'авбал', 'авлаа', 'авсан',
    'захиалъя', 'захиалья', 'захиалах', 'захиалая',
    // Availability check (very common in FB Messenger)
    // Note: "бну"/"бнуу" omitted here to avoid conflict with greeting "сн бну"
    // Standalone "бну" falls through to general → still triggers product search in widget
    'байгаа юу', 'бий юу', 'бга юу', 'бгаа юу',
    'байна уу',
    // Short forms from Latin typing
    'бга ю', 'бгаа', 'бга', 'бий', 'плаж',
    // Price inquiry (common in product search context)
    'хэд', 'хэдээр',
    // Latin-typed price inquiry abbreviations (hd=хэд, une=үнэ, ve=вэ)
    'хд',
    // Latin aliases for product category names
    'умд', 'цамц',
    // Home appliance / furniture terms (commonly searched with "байна уу?")
    'тавиур', 'телевизор', 'хөргөгч', 'угаалгын', 'зурагт', 'компьютер',
    'тавилга', 'гэрийн цахилгаан', 'гэрийн хэрэгсэл',
    // Image/photo requests (trigger product cards with images)
    'зураг', 'зургийг', 'зургаа', 'зургыг', 'зурагтай', 'фото',
    'photo', 'picture', 'pic', 'image', 'show photo', 'show picture',
    'үзүүлээч', 'харуулаач', 'харуулаад', 'үзүүлээд',
  ],
  order_status: [
    // Core — Note: 'хүргэлт' moved to shipping (it means "delivery", not "order status")
    'захиалга', 'хаана', 'илгээсэн', 'явсан',
    'статус', 'трэк', 'дугаар', 'хэзээ', 'захиалсан', 'хүлээж',
    // English
    'order', 'order status', 'tracking', 'track', 'where is', 'shipped',
    'delivery status', 'when will', 'my order', 'order number',
    // Aliases
    'захялга', 'захиалг', 'захиалаа', 'захиалгаа',
    'ирэхүү', 'ирэх үү', 'ирэхгүй',
    'илгээсэнүү', 'явуулсан',
    'трэкинг',
    'дугаараа', 'дугаарыг',
    'хүлээсэн', 'хүлээлгэ',
    'шалгах', 'шалгана', 'шалгамаар',
    'хэзээ ирэх',
    // Time-based arrival phrases (order tracking, not generic shipping)
    'маргааш ирэх', 'өглөө ирэх', 'өнөөдөр ирэх', 'орой ирэх',
  ],
  greeting: [
    // Core
    'сайн байна', 'сайн уу', 'байна уу', 'сайхан',
    'өглөөний мэнд', 'мэнд',
    // English
    'hello', 'hi', 'hey', 'good morning', 'good evening', 'greetings',
    // Aliases
    'сайн бн', 'сн бн уу', 'сайн бна', 'сайнуу', 'сайн уу',
    'юу байна', 'сонин юу байна',
    'мэндээ', 'мэнд хүргэе',
    'амар', 'амрагтай',
    'оройн мэнд',
    // Slang/abbreviations (from real FB Messenger conversations)
    'бнау', 'бна уу', 'сбну', 'сайн уу',
    'сн бну', 'сн бнуу', 'сн бн',
    'сайнбну', 'сайнбнуу', 'сн уу',
  ],
  thanks: [
    // Core
    'баярлалаа', 'гайхалтай', 'сайхан', 'маш сайн', 'рахмат', 'харин',
    // English
    'thanks', 'thank', 'thank you', 'appreciate', 'great', 'awesome',
    'perfect', 'wonderful',
    // Aliases
    'баярлаа', 'баярласан', 'баярлсан', 'баярлж', 'баяртай',
    'гоё', 'гое', 'гое байна',
    'сайн байна лээ', 'зүгээр', 'за',
    'маш гоё', 'маш зөв',
    'рахмэт',
    'мерси',
  ],
  complaint: [
    // Core — negative sentiment (return keywords moved to return_exchange)
    'гомдол', 'асуудал', 'муу', 'буруу', 'алдаа', 'сэтгэл ханамжгүй',
    'чанар',
    // English
    'complaint', 'problem', 'issue', 'broken', 'damaged', 'defective',
    'wrong', 'bad', 'terrible',
    'not working', 'disappointed', 'unhappy', 'angry',
    // Aliases
    'гомдоллох', 'гомдолтой', 'гомдоол',
    'асуудалтай', 'асуудал гарсан', 'проблем',
    'муухай', 'маш муу', 'хэрэггүй',
    'буруутай', 'буруугаар',
    'алдаатай',
    'чанаргүй', 'чанар муу',
    'эвдэрсэн', 'гэмтсэн', 'гэмтэл',
    'уурласан', 'бухимдсан',
    'хариуцлага', 'хариуцлагагүй',
    // Delivery delay complaints
    'ирэхгүй', 'хэзээ ирэх', 'хоног болсон', 'хоног өнгөрсөн',
    'удаан болсон', 'хүрсэнгүй', 'хүрэхгүй', 'захиалга ирсэнгүй',
    'байхгүй болсон', 'алга болсон', 'олдохгүй',
  ],
  return_exchange: [
    // Core — return/exchange policy questions (moved from complaint)
    'буцаах', 'буцаалт', 'солих', 'солилт', 'солиулах',
    'буцаан', 'буцааж', 'буцаагдах',
    // Suffixed forms (Mongolian genitive/accusative — prevents prefix-only 0.5 scoring)
    'буцаалтын', 'солилтын', 'солиулж', 'буцаагдсан',
    // Return-specific nouns
    'хураамж',
    // Policy-specific phrases
    'буцаах бодлого', 'буцаах нөхцөл', 'буцаалтын нөхцөл',
    'солих боломж', 'буцаах боломж',
    // Fit/size mismatch (common return reason)
    'тохирохгүй', 'өөр хэмжээ', 'өөр өнгө', 'өөрчлөх',
    // English
    'return', 'return policy', 'exchange', 'refund',
    'can i return', 'exchange policy', 'swap',
    'want to exchange', 'want to return',
    // Informal/aliases
    'буцааж болох', 'солиулж болох', 'буцаалт хийх',
    'буцааж өгөх', 'солиулж өгөх',
    'буцааx', 'солиулаx',
  ],
  size_info: [
    // Core
    'размер', 'хэмжээ', 'size', 'том', 'жижиг', 'дунд',
    'xl', 'xxl',
    // English
    'size chart', 'size guide', 'what size', 'fit', 'measurement',
    'small', 'medium', 'large',
    // Aliases
    'размераа', 'размерийн', 'сайз', 'сайзаа',
    'хэмжээтэй', 'хэмжээний', 'хэмжээгээ',
    'томхон', 'жижигхэн', 'дундаж',
    'тохирох', 'тохируулах',
    'урт', 'богино', 'өргөн', 'нарийн',
    // Body measurements
    'кг', 'см', 'kg', 'cm',
    'жин', 'жинтэй', 'өндөр', 'өндөртэй',
    'биеийн', 'бие', 'али нь', 'алинийг',
    'тохирно', 'тохирох уу', 'таарах', 'таарна',
    // "болох уу" / "тааруу" — common sizing question forms
    'болох уу', 'болху', 'блху', 'тааруу',
    // Latin-typed (common FB Messenger abbreviations)
    'hemjee', 'razmer', 'saiz',
  ],
  payment: [
    // Core
    'төлбөр', 'төлөх', 'данс', 'шилжүүлэг', 'qpay', 'карт',
    'бэлэн', 'зээл', 'хуваах',
    // English
    'payment', 'pay', 'how to pay', 'bank transfer', 'card', 'cash',
    'installment', 'credit', 'invoice',
    // Aliases
    'төлбөрөө', 'төлье', 'төлъе', 'төлсөн',
    'дансаар', 'дансруу', 'данс руу',
    'шилжүүлэх', 'шилжүүлье',
    'картаар', 'картаа',
    'бэлнээр', 'бэлэнээр',
    'зээлээр', 'хуваалаа',
    'хэрхэн төлөх', 'яаж төлөх',
    'мөнгө', 'мөнгөө',
    // Mongolian payment methods
    'кюпэй', 'сошиал пэй', 'socialpay', 'монпэй', 'monpay',
    'хипэй', 'hipay', 'лэнд', 'лизинг', 'хуваан төлөх',
    'сторпэй', 'storepay',
  ],
  shipping: [
    // Core
    'хүргэлт', 'хүргэх', 'хаяг', 'хотод', 'хөдөө', 'шуудан',
    'унаа', 'өдөр', 'хоног', 'ирэх',
    // English
    'shipping', 'delivery', 'deliver', 'address', 'express',
    'how long', 'when arrive', 'ship to', 'courier',
    // Aliases
    'хүргүүлэх', 'хүргээд', 'хүргэнэ үү', 'хүргэлтийн',
    'хаягаа', 'хаягийн', 'хаягаар',
    'хотруу', 'хот руу',
    'хөдөөрүү', 'хөдөө рүү',
    'шууданаар',
    'хэдэн өдөр', 'хэдэн хоног',
    'хурдан', 'яаралтай хүргэлт',
    'өнөөдөр хүргэх', 'маргааш',
    // Latin transliterations (from real FB conversations)
    'хургелт', 'хургэлт',
    // Mongolian geography-specific
    'аймаг', 'сум', 'дүүрэг', 'хороо', 'орон нутаг',
    'хан уул', 'баянгол', 'сүхбаатар', 'чингэлтэй', 'баянзүрх',
    'сонгинохайрхан', 'налайх', 'багануур',
    // Address structure (customer providing delivery address)
    'байр', 'баир', 'давхар', 'тоот', 'орц', 'хотхон', 'хороолол',
  ],
  // Restaurant-specific intents
  table_reservation: [
    // Core
    'ширээ', 'суудал', 'захиал', 'захиалах', 'резерв', 'бронь',
    'хүн', 'хүний', 'зочин', 'орой', 'оройн', 'өглөө',
    'үдийн', 'хоол', 'зоогийн',
    // Table-specific
    'сул', 'чөлөөтэй', 'байна уу', 'бий юу',
    'суух', 'суудлын',
    // Time expressions (avoid bare 'цаг' — too ambiguous, matches "ухаалаг цаг" = smart watch)
    'цагт', 'хэдэн цагт',
    // English
    'table', 'reservation', 'reserve', 'book', 'booking',
    'seat', 'seats', 'party', 'dinner', 'lunch',
    // Aliases
    'ширээний', 'ширээ авах', 'ширээ захиалах',
    'суудал авах', 'суудал захиалах',
    'резервлэх', 'броньлох',
    'орой хоол', 'үдийн хоол',
  ],
  allergen_info: [
    // Core allergens
    'харшил', 'харшлийн', 'аллерги', 'орц', 'найрлага',
    'глютен', 'глютенгүй', 'сүү', 'сүүний', 'самар',
    'самрын', 'өндөг', 'өндөгний', 'загас', 'далайн',
    // Dietary preferences
    'вега', 'веган', 'вегетари', 'халал', 'халяль',
    'цэвэр', 'органик',
    // Spicy level
    'халуун', 'халуунтай', 'ногоон чинжүү', 'амт',
    // English
    'allergy', 'allergies', 'allergen', 'ingredient',
    'gluten', 'gluten-free', 'dairy', 'nuts', 'egg',
    'vegan', 'vegetarian', 'halal', 'spicy',
    // Aliases
    'ямар орц', 'юу орсон', 'орц найрлага',
    'аллергитай', 'харшилтай',
    'глютенгүй юу', 'сүү орсон уу',
  ],
  menu_availability: [
    // Core
    'цэс', 'меню', 'өнөөдөр', 'өнөөдрийн', 'бэлэн',
    'дууссан', 'үлдсэн', 'байна уу', 'идэж',
    // Food items
    'хоол', 'хоолны', 'уух', 'ундаа',
    // Availability check
    'байгаа юу', 'бий юу', 'авч болох',
    // English
    'menu', 'available', 'today', 'sold out',
    'in stock', 'can order',
    // Aliases
    'өнөөдрийн цэс', 'яг одоо', 'одоо байгаа',
    'хоол байна уу', 'ямар хоол', 'юу захиалах',
    'дуусчхсан уу', 'дуусав уу',
  ],
}

/** Pre-compute normalized keyword lists (done once at module load) */
const NORMALIZED_INTENT_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => [
    intent,
    keywords.map((kw) => normalizeText(kw)),
  ])
)

/** Minimum prefix length for partial matching (trigram) */
const MIN_PREFIX_LEN = 4

/**
 * Find a message word that prefix-matches the keyword.
 * Returns the matching word or null. Used for dedup tracking.
 */
function prefixMatchWord(normalizedMsg: string, keyword: string): string | null {
  if (keyword.length < MIN_PREFIX_LEN) return null
  const words = normalizedMsg.split(' ')
  return words.find((w) => w.startsWith(keyword) || keyword.startsWith(w) && w.length >= MIN_PREFIX_LEN) ?? null
}

export interface IntentResult {
  intent: string
  confidence: number  // 0 = no match, 1+ = keyword hits
}

/**
 * Classify intent with confidence score.
 * Uses exact substring match (full weight) + prefix match (half weight).
 */
/** Regex patterns that strongly indicate size_info intent */
const SIZE_PATTERNS = [
  /\d+\s*кг/,    // 60кг, 60 кг
  /\d+\s*см/,    // 165см, 165 см
  /\d+\s*kg/i,   // 60kg (pre-normalization)
  /\d+\s*cm/i,   // 165cm (pre-normalization)
]

export function classifyIntentWithConfidence(message: string): IntentResult {
  const normalized = normalizeText(message)
  // Pad with spaces so word-boundary checks work at start/end
  const padded = ` ${normalized} `

  let bestIntent = 'general'
  let bestScore = 0

  const neutralPadded = ` ${neutralizeVowels(normalized)} `

  for (const [intent, keywords] of Object.entries(NORMALIZED_INTENT_KEYWORDS)) {
    let score = 0
    // Track message words that contributed to a full match.
    // Prevents prefix inflation: e.g. "размер" fully matching should not
    // also accumulate +0.5 prefix scores from "размераа", "размерийн".
    const fullyMatchedWords = new Set<string>()
    for (const kw of keywords) {
      // Word-boundary match: keyword must be surrounded by spaces
      if (padded.includes(` ${kw} `)) {
        score += 1 // Full match
        kw.split(' ').forEach((w) => fullyMatchedWords.add(w))
      } else if (neutralPadded.includes(` ${neutralizeVowels(kw)} `)) {
        score += 1 // Vowel-neutral match (Latin-typed Mongolian)
        neutralizeVowels(kw).split(' ').forEach((w) => fullyMatchedWords.add(w))
      } else {
        const matchingWord = prefixMatchWord(normalized, kw)
        if (matchingWord && !fullyMatchedWords.has(matchingWord)) {
          score += 0.5 // Partial/prefix match — half weight (deduped)
        }
      }
    }

    // Boost size_info for body measurement patterns (60кг, 165см, etc.)
    if (intent === 'size_info') {
      for (const pattern of SIZE_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(message)) {
          score += 2 // Strong signal — body measurements present
          break
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  // Tiebreaker: if greeting ties with product_search, prefer product_search
  // e.g. "ТВ тавиур байна уу?" — "байна уу" scores 1 for BOTH, but it's a product query
  if (bestIntent === 'greeting' && bestScore <= 1) {
    const productScore = (() => {
      let s = 0
      const kws = NORMALIZED_INTENT_KEYWORDS['product_search'] || []
      for (const kw of kws) {
        if (padded.includes(` ${kw} `) || neutralPadded.includes(` ${neutralizeVowels(kw)} `)) {
          s += 1
        }
      }
      return s
    })()
    if (productScore >= bestScore && normalized.split(/\s+/).length > 2) {
      bestIntent = 'product_search'
    }
  }

  return { intent: bestIntent, confidence: bestScore }
}

/** Confidence threshold below which we ask clarification instead of guessing */
export const LOW_CONFIDENCE_THRESHOLD = 0.5

/**
 * Backwards-compatible wrapper: returns just the intent string.
 */
export function classifyIntent(message: string): string {
  return classifyIntentWithConfidence(message).intent
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
  // Generic product/commerce terms (not useful as search filters)
  'бараа', 'бара', 'барааа', 'бараагаа',
  'бүтээгдэхүүн', 'бутээгдэхүүн', 'бутээгдхүүн', 'бүтээгдхүүн',
  'худалдаж', 'зарна', 'зарах', 'авах', 'авъя', 'авья',
  'үзүүл', 'үзүүлнэ', 'ймар', 'бн', 'ве', 'вэ',
]

export const CATEGORY_MAP: Record<string, string> = {
  // Clothing
  'хувцас': 'clothing', 'хувцаас': 'clothing', 'хувцс': 'clothing',
  'кийим': 'clothing', 'өмсөх': 'clothing',
  'цамц': 'clothing', 'даашинз': 'clothing', 'өмд': 'clothing',
  'куртка': 'clothing', 'пальто': 'clothing', 'хүрэм': 'clothing',
  'дээл': 'clothing', 'малгай': 'clothing',
  // Mongolian cashmere/textile products
  'кашемир': 'clothing', 'ноолуур': 'clothing', 'ноолууран': 'clothing',
  // Shoes
  'гутал': 'shoes', 'гуталаа': 'shoes', 'гутлаа': 'shoes',
  'пүүз': 'shoes', 'пууз': 'shoes', 'пүүзээ': 'shoes',
  'шаахай': 'shoes',
  // Bags
  'цүнх': 'bags', 'цунх': 'bags', 'цүнхээ': 'bags',
  'уут': 'bags',
  // Accessories
  'аксессуар': 'accessories', 'аксесуар': 'accessories', 'аксесор': 'accessories',
  'бүс': 'accessories', 'бүсээ': 'accessories',
  'зүүлт': 'accessories', 'бөгж': 'accessories', 'бугуйвч': 'accessories',
}

export function extractSearchTerms(message: string): string {
  const words = normalizeText(message).split(/\s+/)
  const meaningful = words.filter((w) => w.length > 1 && !STOP_WORDS.includes(w))
  return meaningful.join(' ')
}

/**
 * Extract the original Latin words from a message (before Cyrillic normalization).
 * Used as a fallback search — "cashmere" won't match "Кашемир" after normalization
 * because c→с but Mongolian uses к.
 */
export function extractLatinTerms(message: string): string[] {
  const latinWordRegex = /[a-zA-Z]{3,}/g
  const matches = message.match(latinWordRegex) || []
  return matches.map((w) => w.toLowerCase())
}

/**
 * Map of common English product terms to their Mongolian equivalents.
 * Handles cases where Latin→Cyrillic char mapping doesn't produce the right word.
 */
const ENGLISH_TO_MONGOLIAN: Record<string, string[]> = {
  cashmere: ['кашемир', 'ноолуур'],
  shirt: ['цамц'],
  hat: ['малгай'],
  bag: ['цүнх', 'уут'],
  shoes: ['гутал'],
  pants: ['өмд'],
  jacket: ['куртка', 'хүрэм'],
  coat: ['пальто'],
  watch: ['цаг'],
  earphone: ['чихэвч'],
  earphones: ['чихэвч'],
  headphone: ['чихэвч'],
  headphones: ['чихэвч'],
  charger: ['цэнэглэгч'],
  toy: ['тоглоом'],
  lego: ['лего'],
  shampoo: ['шампунь'],
  cream: ['тос'],
}

/**
 * Mongolian synonym groups — words within each group are interchangeable.
 * When a search query contains one word, we also search for its synonyms.
 * This handles кашемир = ноолуур, арьс = leather, etc.
 */
const MONGOLIAN_SYNONYMS: string[][] = [
  ['кашемир', 'ноолуур', 'ноолууран'],
  ['арьс', 'арьсан', 'leather'],
  ['гутал', 'шаахай', 'пүүз'],
  ['цүнх', 'уут', 'bag'],
]

/** Given a search word, return any synonyms from MONGOLIAN_SYNONYMS */
function expandSynonyms(word: string): string[] {
  const extras: string[] = []
  for (const group of MONGOLIAN_SYNONYMS) {
    if (group.some((syn) => word.includes(syn) || syn.includes(word))) {
      extras.push(...group.filter((syn) => syn !== word))
    }
  }
  return extras
}

export interface SearchProductsOptions {
  maxProducts?: number
  /** Filter to only available items (restaurant menus) */
  availableOnly?: boolean
  /** Original message before Cyrillic normalization — used to extract Latin words for search */
  originalQuery?: string
}

/**
 * Generic product search. Accepts any Supabase client (browser or service-role).
 */
export async function searchProducts(
  supabase: SupabaseClient<Database>,
  query: string,
  storeId: string,
  options: SearchProductsOptions = {}
): Promise<ProductMatch[]> {
  const { maxProducts = 5, availableOnly = false, originalQuery } = options
  const normalizedQuery = normalizeText(query)
  let mappedCategory: string | null = null
  for (const [mn, en] of Object.entries(CATEGORY_MAP)) {
    if (normalizedQuery.includes(mn)) {
      mappedCategory = en
      break
    }
  }

  // product_faqs and ai_context exist in DB but not in generated Supabase types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery = (supabase
    .from('products') as any)
    .select(`
      id, name, description, category, base_price, images, sales_script,
      product_faqs, ai_context,
      available_today, sold_out, allergens, spicy_level,
      is_vegan, is_halal, is_gluten_free, dietary_tags,
      product_variants(size, color, price, stock_quantity)
    `)
    .eq('store_id', storeId)
    .eq('status', 'active')

  // For restaurant menus, filter to available items only
  if (availableOnly) {
    dbQuery = dbQuery.eq('available_today', true).eq('sold_out', false)
  }

  if (mappedCategory) {
    dbQuery = dbQuery.eq('category', mappedCategory)
  } else {
    const searchTerms = extractSearchTerms(query)
    // Extract Latin words from the ORIGINAL message (before Cyrillic normalization)
    // query is already Cyrillic-normalized so extractLatinTerms(query) would find nothing
    const latinSource = originalQuery || query
    const latinWords = extractLatinTerms(latinSource)
    const translatedWords = latinWords.flatMap((w) => ENGLISH_TO_MONGOLIAN[w] || [])

    const baseWords = searchTerms.split(/\s+/).filter(Boolean)
    // Expand Mongolian synonyms (ноолуур → кашемир, etc.)
    const synonymWords = baseWords.flatMap((w) => expandSynonyms(w))

    const allSearchWords = [
      ...baseWords,
      ...synonymWords,     // Mongolian synonyms (e.g. "ноолуур" → "кашемир")
      ...latinWords,       // original Latin (e.g. "cashmere" matches product names)
      ...translatedWords,  // Mongolian equivalents (e.g. "кашемир")
    ]

    if (allSearchWords.length > 0) {
      const conditions = allSearchWords
        .flatMap((w) => [
          `name.ilike.%${w}%`,
          `description.ilike.%${w}%`,
          `search_aliases.cs.{${w}}`,
        ])
        .join(',')
      dbQuery = dbQuery.or(conditions)
    }
  }

  const { data } = await dbQuery.limit(maxProducts)
  if (!data) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((row: any) => {
    const rawVariants = row.product_variants as { size: string | null; color: string | null; price: number; stock_quantity: number }[] | undefined
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      category: row.category ?? '',
      base_price: row.base_price ?? 0,
      images: (row.images ?? []) as string[],
      sales_script: row.sales_script,
      product_faqs: (row.product_faqs ?? null) as Record<string, string> | null,
      ai_context: (row.ai_context ?? null) as string | null,
      variants: rawVariants && rawVariants.length > 0 ? rawVariants : undefined,
      // Restaurant features
      available_today: row.available_today ?? true,
      sold_out: row.sold_out ?? false,
      allergens: (row.allergens ?? []) as string[],
      spicy_level: row.spicy_level ?? 0,
      is_vegan: row.is_vegan ?? false,
      is_halal: row.is_halal ?? false,
      is_gluten_free: row.is_gluten_free ?? false,
      dietary_tags: (row.dietary_tags ?? []) as string[],
    } as ProductMatch
  })
}

/**
 * Search for available tables at a restaurant.
 * Returns tables that are currently available or could be reserved.
 */
export async function searchAvailableTables(
  supabase: SupabaseClient<Database>,
  storeId: string,
  partySize?: number,
  dateTime?: Date
): Promise<TableMatch[]> {
  let dbQuery = supabase
    .from('table_layouts')
    .select('id, name, capacity, status, section')
    .eq('store_id', storeId)
    .eq('status', 'available')
    .eq('is_active', true)
    .order('capacity', { ascending: true })

  if (partySize) {
    dbQuery = dbQuery.gte('capacity', partySize)
  }

  const { data } = await dbQuery.limit(10)
  if (!data) return []

  // If a specific date/time is requested, filter out tables with conflicting reservations
  if (dateTime) {
    const reservationWindow = new Date(dateTime)
    const windowStart = new Date(reservationWindow.getTime() - 2 * 60 * 60 * 1000) // 2 hours before
    const windowEnd = new Date(reservationWindow.getTime() + 2 * 60 * 60 * 1000) // 2 hours after

    const { data: reservations } = await supabase
      .from('table_reservations')
      .select('table_id')
      .eq('store_id', storeId)
      .in('status', ['confirmed', 'pending'])
      .gte('reservation_time', windowStart.toISOString())
      .lte('reservation_time', windowEnd.toISOString())

    const reservedTableIds = new Set(reservations?.map(r => r.table_id) ?? [])
    return data
      .filter(t => !reservedTableIds.has(t.id))
      .map(row => ({
        id: row.id,
        table_name: row.name,
        capacity: row.capacity,
        status: row.status,
        location: row.section,
      }))
  }

  return data.map(row => ({
    id: row.id,
    table_name: row.name,
    capacity: row.capacity,
    status: row.status,
    location: row.section,
  }))
}

/**
 * Check if a store is in busy mode.
 */
export async function checkStoreBusyMode(
  supabase: SupabaseClient<Database>,
  storeId: string
): Promise<{ busy_mode: boolean; busy_message: string | null; estimated_wait_minutes: number | null }> {
  const { data } = await supabase
    .from('stores')
    .select('busy_mode, busy_message, estimated_wait_minutes')
    .eq('id', storeId)
    .single()

  return {
    busy_mode: data?.busy_mode ?? false,
    busy_message: data?.busy_message ?? null,
    estimated_wait_minutes: data?.estimated_wait_minutes ?? null,
  }
}

/**
 * Generic order search.
 */
export async function searchOrders(
  supabase: SupabaseClient<Database>,
  query: string,
  storeId: string,
  customerId?: string
): Promise<OrderMatch[]> {
  let dbQuery = supabase
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
        return `Уучлаарай, таны хайсан бүтээгдэхүүн одоогоор олдсонгүй. 😔\n\nТа бүтээгдэхүүний нэр эсвэл төрлөөр хайж үзнэ үү. Жишээ нь: "гутал", "хувцас", "цүнх"`
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

    case 'return_exchange':
      if (settings?.return_policy) {
        return `🔄 **Буцаалт/Солилтын бодлого:**\n\n${settings.return_policy}\n\nНэмэлт асуулт байвал бичнэ үү!`
      }
      return `🔄 Буцаалт/солилтын талаар менежерээс лавлана уу.\n\nМанай менежер тантай холбогдож дэлгэрэнгүй мэдээлэл өгнө. Та утасны дугаараа үлдээнэ үү!`

    case 'size_info': {
      if (products.length > 0) {
        let response = `📏 **Размерийн мэдээлэл:**\n\nТаны биеийн хэмжээнд тулгуурлан манай бүтээгдэхүүнүүд:\n\n`
        products.forEach((p, i) => {
          response += `${i + 1}. **${p.name}**\n`
          if (showPrices) response += `   💰 ${formatPrice(p.base_price)}\n`
          if (p.description) {
            const sizeDesc = p.description.length > 150
              ? p.description.substring(0, 150) + '...'
              : p.description
            response += `   📝 ${sizeDesc}\n`
          }
          response += '\n'
        })
        response += `Тодорхой бүтээгдэхүүний размерийн талаар дэлгэрэнгүй асуувал бичнэ үү!`
        return response
      }

      return `📏 **Размерийн мэдээлэл:**\n\n• S - Жижиг (36-38)\n• M - Дунд (38-40)\n• L - Том (40-42)\n• XL - Маш том (42-44)\n• XXL - Нэмэлт том (44-46)\n\nТодорхой бүтээгдэхүүний размерийн хүснэгтийг авмаар бол бүтээгдэхүүний нэрийг бичнэ үү.`
    }

    case 'payment':
      return `Төлбөрийн мэдээлэл:\n\n💳 **Бид дараах төлбөрийн хэлбэрүүдийг хүлээн авна:**\n• QPay - QR код уншуулж төлөх\n• Дансаар шилжүүлэг\n• Бэлнээр (хүргэлтийн үед)\n\nТөлбөрийн талаар нэмэлт асуулт байвал бичнэ үү.`

    case 'shipping':
      return `Хүргэлтийн мэдээлэл:\n\n🚚 **Хүргэлтийн нөхцөл:**\n• Улаанбаатар хот: 1-2 ажлын өдөр\n• Хөдөө орон нутаг: 3-5 ажлын өдөр\n• Хүргэлтийн төлбөр захиалгын дүнгээс хамаарна\n\nТа хаягаа бичвэл бид хүргэлтийн төлбөрийг тооцоолж хэлж өгье.`

    case 'table_reservation':
      return `🍽️ **Ширээ захиалга:**\n\nБид таны захиалгыг хүлээн авахад бэлэн байна!\n\nДараах мэдээллийг бичнэ үү:\n• Хэдэн хүн?\n• Аль өдөр, хэдэн цагт?\n• Нэр, утасны дугаар\n\nЖишээ: "4 хүн, өнөөдөр орой 7 цагт, Болд 99112233"\n\nМенежер тантай холбогдож баталгаажуулна.`

    case 'allergen_info': {
      if (products.length > 0) {
        let response = `🥗 **Орц найрлага / Харшлийн мэдээлэл:**\n\n`
        products.forEach((p, i) => {
          response += `${i + 1}. **${p.name}**\n`
          if (p.allergens && p.allergens.length > 0) {
            response += `   ⚠️ Харшил: ${p.allergens.join(', ')}\n`
          } else {
            response += `   ✅ Түгээмэл харшлийн бүтээгдэхүүнгүй\n`
          }
          if (p.is_vegan) response += `   🌱 Веган\n`
          if (p.is_halal) response += `   ☪️ Халал\n`
          if (p.is_gluten_free) response += `   🌾 Глютенгүй\n`
          if (p.spicy_level && p.spicy_level > 0) {
            response += `   🌶️ Халуун түвшин: ${'🌶️'.repeat(p.spicy_level)}\n`
          }
          response += '\n'
        })
        response += `Тодорхой бүтээгдэхүүний талаар дэлгэрэнгүй асуухыг хүсвэл нэрийг нь бичнэ үү!`
        return response
      }
      return `🥗 **Орц найрлага / Харшлийн мэдээлэл:**\n\nБид дараах мэдээллийг бүх бүтээгдэхүүнд тэмдэглэсэн:\n• 🌱 Веган\n• ☪️ Халал\n• 🌾 Глютенгүй\n• 🌶️ Халуун түвшин\n\nТодорхой бүтээгдэхүүний орц найрлагыг мэдэхийг хүсвэл нэрийг нь бичнэ үү!`
    }

    case 'menu_availability': {
      if (products.length > 0) {
        const available = products.filter(p => p.available_today && !p.sold_out)
        const soldOut = products.filter(p => p.sold_out)

        let response = `📋 **Өнөөдрийн цэс:**\n\n`
        if (available.length > 0) {
          response += `✅ **Бэлэн байгаа:**\n`
          available.forEach((p, i) => {
            response += `${i + 1}. ${p.name} — ${formatPrice(p.base_price)}\n`
          })
        }
        if (soldOut.length > 0) {
          response += `\n❌ **Дууссан:**\n`
          soldOut.forEach((p) => {
            response += `• ${p.name}\n`
          })
        }
        response += `\nЯмар хоол захиалах вэ?`
        return response
      }
      return `📋 **Өнөөдрийн цэс:**\n\nМанай бүх цэс идэвхтэй байна. Ямар хоол захиалах вэ?\n\nЦэс үзэхийг хүсвэл "цэс" гэж бичнэ үү.`
    }

    case 'product_suggestions': {
      let response = `Уучлаарай, таны хайсан бүтээгдэхүүн олдсонгүй. Гэхдээ манай дэлгүүрт дараах бүтээгдэхүүнүүд байна:\n\n`
      products.forEach((p, i) => {
        response += `${i + 1}. **${p.name}**\n`
        if (showPrices) response += `   💰 ${formatPrice(p.base_price)}\n`
        if (p.description) {
          const shortDesc = p.description.length > 80
            ? p.description.substring(0, 80) + '...'
            : p.description
          response += `   📝 ${shortDesc}\n`
        }
        response += '\n'
      })
      response += `Аль бүтээгдэхүүний талаар дэлгэрэнгүй мэдмээр байна?`
      return response
    }

    case 'low_confidence': {
      if (products.length > 0) {
        let response = `Таны хайлтад тохирох бүтээгдэхүүнүүд:\n\n`
        products.forEach((p, i) => {
          response += `${i + 1}. **${p.name}**\n`
          if (showPrices) response += `   💰 ${formatPrice(p.base_price)}\n`
          if (p.description) {
            const shortDesc = p.description.length > 80
              ? p.description.substring(0, 80) + '...'
              : p.description
            response += `   📝 ${shortDesc}\n`
          }
          response += '\n'
        })
        response += `Аль бүтээгдэхүүний талаар дэлгэрэнгүй мэдмээр байна?`
        return response
      }

      return `Уучлаарай, таны асуултыг бүрэн ойлгосонгүй. 🤔\n\nТа доорх сэдвүүдээс сонгоно уу:\n• 📦 Бүтээгдэхүүн хайх\n• 📋 Захиалга шалгах\n• 🚚 Хүргэлтийн мэдээлэл\n• 💳 Төлбөрийн мэдээлэл\n• 📏 Размерийн зөвлөгөө\n• 💬 Менежертэй холбогдох\n\nЭсвэл асуултаа дахин бичнэ үү!`
    }

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

// ---------------------------------------------------------------------------
// Message History (for LLM context window)
// ---------------------------------------------------------------------------

export interface MessageHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Fetch the last N messages from a conversation for LLM context.
 */
export async function fetchRecentMessages(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  limit = 6
): Promise<MessageHistoryEntry[]> {
  const { data } = await supabase
    .from('messages')
    .select('content, is_from_customer')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  // Reverse to chronological order
  return data.reverse().map((m: { content: string; is_from_customer: boolean }) => ({
    role: m.is_from_customer ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))
}

// ---------------------------------------------------------------------------
// AI Response Generation
// ---------------------------------------------------------------------------

/**
 * Async wrapper that tries AI-powered response, falling back to deterministic template.
 *
 * Fallback chain:
 * 1. Contextual AI (if history provided + OpenAI configured) — full multi-turn
 * 2. Recommendation writer (for product_search with products) — single-turn AI
 * 3. Deterministic template — always works, zero cost
 */
export interface ActiveVoucherInfo {
  voucher_code: string
  compensation_type: string
  compensation_value: number
  valid_until: string
}

export interface RestaurantContext {
  availableTables?: TableMatch[]
  busyMode?: {
    busy_mode: boolean
    busy_message?: string | null
    estimated_wait_minutes?: number | null
  }
}

export async function generateAIResponse(
  intent: string,
  products: ProductMatch[],
  orders: OrderMatch[],
  storeName: string,
  customerQuery: string,
  settings?: ChatbotSettings,
  history?: MessageHistoryEntry[],
  activeVouchers?: ActiveVoucherInfo[],
  restaurantContext?: RestaurantContext,
  customerProfile?: import('./ai/customer-profile').CustomerProfile | null
): Promise<string> {
  // Tier 1: Contextual AI with conversation history
  if (history && history.length > 0) {
    try {
      const { contextualAIResponse } = await import('./ai/contextual-responder')
      const contextResult = await contextualAIResponse({
        history,
        currentMessage: customerQuery,
        intent,
        products: products.map((p) => ({
          name: p.name,
          base_price: p.base_price,
          description: p.description,
          product_faqs: p.product_faqs,
          ai_context: p.ai_context,
          variants: p.variants,
          // Restaurant features
          allergens: p.allergens,
          spicy_level: p.spicy_level,
          is_vegan: p.is_vegan,
          is_halal: p.is_halal,
          is_gluten_free: p.is_gluten_free,
          sold_out: p.sold_out,
        })),
        orders: orders.map((o) => ({
          order_number: o.order_number,
          status: o.status,
          total_amount: o.total_amount,
        })),
        storeName,
        returnPolicy: settings?.return_policy,
        activeVouchers,
        // Restaurant context
        availableTables: restaurantContext?.availableTables?.map(t => ({
          table_name: t.table_name,
          capacity: t.capacity,
          status: t.status,
          location: t.location,
        })),
        busyMode: restaurantContext?.busyMode,
        customerProfile: customerProfile ?? null,
      })
      if (contextResult) return contextResult
    } catch {
      // Fall through to recommendation writer
    }
  }

  // Tier 2: Single-turn recommendation writer
  if ((intent === 'product_search' || intent === 'product_suggestions') && products.length > 0) {
    try {
      const { writeRecommendation } = await import('./ai/recommendation-writer')
      const aiResult = await writeRecommendation({
        products: products.map((p) => ({
          name: p.name,
          description: p.description,
          base_price: p.base_price,
          sales_script: p.sales_script,
          variants: p.variants,
        })),
        customer_query: customerQuery,
      })
      if (aiResult?.message) return aiResult.message
    } catch {
      // Fall through to template
    }
  }

  // Tier 3: Deterministic template
  return generateResponse(intent, products, orders, storeName, settings)
}

/**
 * Check if a message matches configured handoff keywords.
 */
export function matchesHandoffKeywords(message: string, settings: ChatbotSettings): boolean {
  if (!settings.auto_handoff || !settings.handoff_keywords) return false
  const keywords = settings.handoff_keywords.split(',').map(k => normalizeText(k.trim()))
  const normalized = normalizeText(message)
  return keywords.some(k => k && normalized.includes(k))
}
