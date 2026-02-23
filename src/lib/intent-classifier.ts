/**
 * Intent classification for Mongolian customer messages.
 * Keyword-based classification with exact, vowel-neutral, and prefix matching.
 */

import { normalizeText, neutralizeVowels } from './text-normalizer'
import { stemText, stemKeyword } from './mn-stemmer'
// Note: trie-based optimization explored but padded.includes() approach needed
// for substring matching behavior. Current perf is <1ms per classification.

// ---------------------------------------------------------------------------
// Keyword lists
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
    // (stemmer handles: загварууд→загвар, өнгөтэй→өнгө, боолтууд→боолт)
    'загвар', 'өнгө', 'өнгөөр',
    'тирко', 'турсик', 'леевчик', 'боолт',
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
    // stemmer handles: цүнхээ→цүнх, пүүзээ→пүүз
    'цунх',
    'пууз',
    'аксесуар', 'аксесор',
    // stemmer handles: үнээ→үнэ, хямдралтай→хямдрал
    'унэ', 'унэтэй',
    'хямдхан', 'хямдрал', 'хямдарсан', 'үнэгүй',
    'шинэхэн', 'шинээр',
    'авах', 'авъя', 'авья', 'авмааар',
    'хайж', 'хайна', 'хайлт',
    // stemmer handles: үзүүлээд→үзүүл
    'харуул', 'үзүүл', 'үзүүлнэ үү',
    'каталог', 'жагсаалт',
    // Interest/desire expressions (stemmer handles: сонирхоод→сонирх, сонирхож→сонирхо)
    'сонирхож', 'сонирхох', 'сонирхи', 'сонирх',
    // Purchase intent (from real FB conversations)
    'авий', 'авии', 'ави', 'авья',
    'авбал', 'авлаа', 'авсан',
    'захиалъя', 'захиалья', 'захиалах', 'захиалая',
    // Availability check (very common in FB Messenger)
    'байгаа юу', 'бий юу', 'бга юу', 'бгаа юу',
    'байна уу',
    // Short forms from Latin typing
    'бга ю', 'бгаа', 'бга', 'бий', 'плаж',
    // Price inquiry (common in product search context)
    'хэд', 'хэдээр',
    // Latin-typed price inquiry abbreviations
    'хд',
    // Latin aliases for product category names
    'умд', 'цамц',
    // Image/photo requests (stemmer handles: зургийг/зургыг→зург, зурагтай→зураг, үзүүлээд→үзүүл)
    'зураг', 'зургаа', 'фото',
    'photo', 'picture', 'pic', 'image', 'show photo', 'show picture',
    'үзүүлээч', 'харуулаач', 'харуулаад',
  ],
  order_status: [
    // Core
    'захиалга', 'хаана', 'илгээсэн', 'явсан',
    'статус', 'трэк', 'дугаар', 'хэзээ', 'захиалсан', 'хүлээж',
    // English
    'order', 'order status', 'tracking', 'track', 'where is', 'shipped',
    'delivery status', 'when will', 'my order', 'order number',
    // Aliases (stemmer handles: захиалгаа→захиалг, дугаараа/дугаарыг→дугаар, хүлээсэн→хүлээ)
    'захялга', 'захиалг', 'захиалаа',
    'ирэхүү', 'ирэх үү', 'ирэхгүй',
    'илгээсэнүү', 'явуулсан',
    'трэкинг',
    'хүлээлгэ',
    'шалгах', 'шалгана', 'шалгамаар',
    'хэзээ ирэх',
    // Time-based arrival phrases (order tracking, not generic shipping)
    'маргааш ирэх', 'өглөө ирэх', 'өнөөдөр ирэх', 'орой ирэх',
    // Ready/completion status
    'бэлэн болох', 'бэлэн болно', 'бэлэн болсон',
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
    // stemmer handles: мэндээ→мэнд
    'мэнд хүргэе',
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
    // Aliases (stemmer handles: баярласан→баярла, баярлсан/баярлж→баярл, баяртай→баяр)
    'баярлаа', 'баярлж',
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
    // Aliases (stemmer handles: гомдолтой→гомдол, асуудалтай→асуудал, буруутай→буруу, алдаатай→алдаа)
    'гомдоллох', 'гомдоол',
    'асуудал гарсан', 'проблем',
    'муухай', 'маш муу', 'хэрэггүй',
    'буруугаар',
    'чанаргүй', 'чанар муу',
    'эвдэрсэн', 'гэмтсэн', 'гэмтэл',
    'уурласан', 'бухимдсан',
    'хариуцлага', 'хариуцлагагүй',
  ],
  return_exchange: [
    // Core — return/exchange policy questions (moved from complaint)
    'буцаах', 'буцаалт', 'солих', 'солилт', 'солиулах',
    // stemmer handles: буцааж→буцаа, буцаагдсан→буцаа, буцаалтын→буцаалт, солилтын→солилт, солиулж→солиул
    'буцаан', 'буцаагдах',
    'солиулж',
    // Latin transliteration
    'butsaah', 'butsaalt', 'butsaa', 'butaah', 'butaa', 'butay',
    // Cyrillic forms of Latin misspellings (normalizer converts Latin→Cyrillic)
    'бутай', 'бутаах', 'бутаа',
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
    // Informal/aliases (stemmer handles: буцааx→буцаах, солиулаx→солиулах)
    'буцааж болох', 'солиулж болох', 'буцаалт хийх',
    'буцааж өгөх', 'солиулж өгөх',
  ],
  size_info: [
    // Core
    'размер', 'хэмжээ', 'size', 'том', 'жижиг', 'дунд',
    'xl', 'xxl',
    // English
    'size chart', 'size guide', 'what size', 'fit', 'measurement',
    'small', 'medium', 'large',
    // Aliases (stemmer handles: размераа/размерийн→размер, сайзаа→сайз, хэмжээний/хэмжээгээ→хэмжээ)
    // Keep хэмжээтэй — needs full-weight match to beat product_search's "ямар"
    'хэмжээтэй', 'сайз',
    'томхон', 'жижигхэн', 'дундаж',
    'тохирох', 'тохируулах',
    'урт', 'богино', 'өргөн', 'нарийн',
    // Body measurements
    'кг', 'см', 'kg', 'cm',
    // stemmer handles: жинтэй→жин, өндөртэй→өндөр
    'жин', 'өндөр',
    'биеийн', 'бие', 'али нь', 'алинийг',
    'тохирно', 'тохирох уу', 'таарах', 'таарна',
    // "тааруу" — sizing-specific form ("болох уу" removed — too generic, conflicts with payment/return)
    'тааруу',
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
    // Aliases (stemmer handles: төлбөрөө→төлбөр, дансаар/дансруу→данс, картаар/картаа→карт, зээлээр→зээл)
    'төлье', 'төлъе', 'төлсөн',
    'данс руу',
    'шилжүүлэх', 'шилжүүлье',
    'бэлнээр', 'бэлэнээр',
    'хуваалаа',
    'хэрхэн төлөх', 'яаж төлөх',
    'мөнгө', 'мөнгөө',
    // Mongolian payment methods
    'кюпэй', 'сошиал пэй', 'socialpay', 'монпэй', 'monpay',
    'хипэй', 'hipay', 'лэнд', 'лизинг', 'хуваан төлөх', 'хуваан төлж',
    'сторпэй', 'storepay',
  ],
  shipping: [
    // Core
    'хүргэлт', 'хүргэх', 'хаяг', 'хотод', 'хөдөө', 'шуудан',
    'унаа', 'өдөр', 'хоног', 'ирэх',
    // English
    'shipping', 'delivery', 'deliver', 'address', 'express',
    'how long', 'when arrive', 'ship to', 'courier',
    // Aliases (stemmer handles: хүргэлтийн→хүргэлт, хаягаа/хаягийн/хаягаар→хаяг)
    'хүргүүлэх', 'хүргээд', 'хүргэнэ үү',
    // stemmer handles: хөдөөрүү→хөдөө
    'хотруу', 'хот руу',
    'хөдөө рүү',
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
    // Time expressions
    'цагт', 'цаг', 'орой',
    // English
    'table', 'reservation', 'reserve', 'book', 'booking',
    'seat', 'seats', 'party', 'dinner', 'lunch',
    // Aliases (stemmer handles: оройн→орой via suffix strip)
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
    // Aliases (stemmer handles: аллергитай→аллерги, харшилтай→харшил)
    'ямар орц', 'юу орсон', 'орц найрлага',
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

// ---------------------------------------------------------------------------
// Pre-computed normalized keywords
// ---------------------------------------------------------------------------

/** Pre-compute normalized keyword lists (done once at module load) */
const NORMALIZED_INTENT_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => [
    intent,
    keywords.map((kw) => normalizeText(kw)),
  ])
)

/** Pre-compute stemmed keyword lists for stem-based matching */
const STEMMED_INTENT_KEYWORDS: Record<string, string[]> = Object.fromEntries(
  Object.entries(NORMALIZED_INTENT_KEYWORDS).map(([intent, keywords]) => [
    intent,
    [...new Set(keywords.map((kw) => stemKeyword(kw)))],
  ])
)

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

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

/** Regex patterns that strongly indicate size_info intent */
const SIZE_PATTERNS = [
  /\d+\s*кг/,    // 60кг, 60 кг
  /\d+\s*см/,    // 165см, 165 см
  /\d+\s*kg/i,   // 60kg (pre-normalization)
  /\d+\s*cm/i,   // 165cm (pre-normalization)
]

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log intent classification results for monitoring.
 * Logs to console in structured JSON format for serverless environments (Vercel).
 */
export function logClassification(
  message: string,
  intent: string,
  confidence: number,
  processingTimeMs: number
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: message.slice(0, 100), // First 100 chars only
    intent,
    confidence,
    processing_time_ms: processingTimeMs,
  }
  
  console.log(JSON.stringify(logEntry))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface IntentResult {
  intent: string
  confidence: number  // 0 = no match, 1+ = keyword hits
}

export interface ClassificationOptions {
  log?: boolean
}

/**
 * Classify intent with confidence score.
 * Uses exact substring match (full weight) + prefix match (half weight).
 */
export function classifyIntentWithConfidence(
  message: string,
  options?: ClassificationOptions
): IntentResult {
  const startTime = Date.now()
  
  const normalized = normalizeText(message)
  const padded = ` ${normalized} `
  const neutralPadded = ` ${neutralizeVowels(normalized)} `
  const stemmedMsg = stemText(normalized)
  const stemmedPadded = ` ${stemmedMsg} `

  let bestIntent = 'general'
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(NORMALIZED_INTENT_KEYWORDS)) {
    let score = 0
    const fullyMatchedWords = new Set<string>()
    const stemMatchedWords = new Set<string>()
    for (const kw of keywords) {
      if (padded.includes(` ${kw} `)) {
        score += 1
        kw.split(' ').forEach((w) => fullyMatchedWords.add(w))
      } else if (neutralPadded.includes(` ${neutralizeVowels(kw)} `)) {
        score += 1
        neutralizeVowels(kw).split(' ').forEach((w) => fullyMatchedWords.add(w))
      } else {
        const matchingWord = prefixMatchWord(normalized, kw)
        if (matchingWord && !fullyMatchedWords.has(matchingWord)) {
          score += 0.5
        }
      }
    }

    // Stem-based matching
    const stemmedKws = STEMMED_INTENT_KEYWORDS[intent] || []
    for (const skw of stemmedKws) {
      if (stemmedPadded.includes(` ${skw} `)) {
        const alreadyCounted = skw.split(' ').every((w) => fullyMatchedWords.has(w) || stemMatchedWords.has(w))
        if (!alreadyCounted) {
          score += 0.75
          skw.split(' ').forEach((w) => stemMatchedWords.add(w))
        }
      }
    }

    if (intent === 'size_info') {
      for (const pattern of SIZE_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(message)) {
          score += 2
          break
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  // Priority tiebreaker: return_exchange/complaint beat product_search when both match
  // e.g. "бараа буцаах" has "бараа" (product_search) + "буцаах" (return_exchange)
  // Only override for strong return/complaint signals (exact keyword match, not prefix)
  if (bestIntent === 'product_search' && bestScore > 0) {
    const RETURN_SIGNALS = ['буцаах', 'буцаалт', 'буцаан', 'солих', 'солилт', 'солиулах', 'буцааж',
      'return', 'refund', 'exchange', 'swap', 'butsaa', 'butsaah', 'butsaalt', 'butaah', 'butaa', 'butay', 'бутай', 'бутаах', 'бутаа', 'solih',
      'тохирохгүй', 'буруу ирсэн', 'гэмтэлтэй', 'эвдэрсэн']
    const COMPLAINT_SIGNALS = ['гомдол', 'муу', 'луйвар', 'хуурамч', 'complaint']
    const normalizedWords = normalized.split(/\s+/)
    const stemmedWords = stemmedMsg.split(/\s+/)

    const hasReturn = RETURN_SIGNALS.some(kw =>
      padded.includes(` ${kw} `) || normalizedWords.some(w => w === kw) ||
      stemmedWords.some(w => w === kw || (kw.length >= 4 && w.startsWith(kw.slice(0, 4))))
    )
    const hasComplaint = COMPLAINT_SIGNALS.some(kw =>
      padded.includes(` ${kw} `) || normalizedWords.some(w => w === kw)
    )

    if (hasReturn) bestIntent = 'return_exchange'
    else if (hasComplaint) bestIntent = 'complaint'
  }

  // Optional logging
  if (options?.log) {
    const processingTime = Date.now() - startTime
    logClassification(message, bestIntent, bestScore, processingTime)
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

/**
 * Hybrid classifier that combines keyword-based and ML-based approaches.
 * Uses the hybrid classification strategy for potentially better accuracy.
 */
export function classifyIntentHybrid(message: string): IntentResult {
  const { hybridClassify } = require('./ai/hybrid-classifier')
  return hybridClassify(message)
}
