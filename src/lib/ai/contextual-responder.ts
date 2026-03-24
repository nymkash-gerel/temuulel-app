/**
 * LLM-tier contextual responder — sends conversation history + product/order
 * facts to GPT-4o-mini for natural multi-turn conversation.
 *
 * Optimized prompt: ~2,000 tokens base (down from ~4,500).
 * Context-dependent sections only included when relevant to the intent.
 */

import { isOpenAIConfigured, chatCompletionJSON } from './openai-client'
import type { ChatMessage } from './openai-client'
import { normalizeText } from '../chat-ai'
import type { CustomerProfile } from './customer-profile'
import type { ResolutionContext } from '../resolution-engine'
import type { ContextualAIResponseJSON } from './types'

export type { ContextualAIResponseJSON }

export interface MessageHistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

export interface ActiveVoucherContext {
  voucher_code: string
  compensation_type: string
  compensation_value: number
  valid_until: string
}

export interface ProductVariantContext {
  size: string | null
  color: string | null
  price: number
  stock_quantity: number
}

export interface ProductContext {
  name: string
  base_price: number
  description?: string
  product_faqs?: Record<string, string> | null
  ai_context?: string | null
  variants?: ProductVariantContext[]
  // Restaurant features
  allergens?: string[]
  spicy_level?: number
  is_vegan?: boolean
  is_halal?: boolean
  is_gluten_free?: boolean
  sold_out?: boolean
}

export interface TableContext {
  table_name: string
  capacity: number
  status: string
  location?: string | null
}

export interface BusyModeContext {
  busy_mode: boolean
  busy_message?: string | null
  estimated_wait_minutes?: number | null
}

export interface ContextualInput {
  history: MessageHistoryEntry[]
  currentMessage: string
  intent: string
  products: ProductContext[]
  orders: { order_number: string; status: string; total_amount: number }[]
  storeName: string
  returnPolicy?: string
  activeVouchers?: ActiveVoucherContext[]
  customerProfile?: CustomerProfile | null
  extendedProfile?: string | null
  latestPurchaseSummary?: string | null
  // Restaurant features
  availableTables?: TableContext[]
  busyMode?: BusyModeContext
  // Resolution Engine context
  resolution?: ResolutionContext | null
}

// ---------------------------------------------------------------------------
// Prompt builder — modular, intent-aware, token-efficient
// ---------------------------------------------------------------------------

function buildSystemPrompt(input: ContextualInput): string {
  const isResolution = ['complaint', 'escalated'].includes(input.intent)
  const isCare = ['order_status', 'shipping_info'].includes(input.intent)
  const isAssist = ['order_collection', 'order_created'].includes(input.intent)
  const isSizeQuery = input.intent === 'size_info'
  // product_detail = mid-order product question (color, material, etc.) — product already selected
  const isProductDetail = input.intent === 'product_detail'
  const isGiftQuery = /бэлэг|санал болг|юу авбал|зөвлө/.test(normalizeText(input.currentMessage))

  // --- Core identity + universal rules (always included) ---
  // Explicit no-products rule — included in EVERY prompt when catalog is empty.
  // This prevents GPT from inventing product names/prices even for general queries.
  const noProductsRule = input.products.length === 0
    ? '\n- БАРАА БАЙХГҮЙ: Дэлгүүрт одоогоор бараа байхгүй. Бараа нэр, үнэ зохиохгүй. "Уучлаарай, одоогоор бараа байхгүй байна. Удахгүй нэмэх болно." гэж хариулна.'
    : ''

  let prompt = `Та "${input.storeName}" дэлгүүрийн туслах Temuulel. Монгол хэлээр хариулна. English if they write in English.

ДҮРЭМ:
- Богино, шууд, байгалийн хариулт. Нэг мессежид нэг асуулт.
- AI/chatbot/хиймэл оюун гэж ХЭЗЭЭ Ч бүү хэл.
- "Өөр юугаар тусалах вэ?" гэсэн робот хариулт ХОРИОТОЙ.
- Мэдэхгүй зүйлийг зохиохгүй.
- Бүтээгдэхүүн дурдах бүрт үнийг ₮-тэй бич.
- Зураг автомат илгээнэ. "Зураг харуулах боломжгүй" / "зураг үзүүлэх боломжгүй" / "зураг байхгүй" гэж ХЭЗЭЭ Ч бүү хэл — ХОРИОТОЙ. Зураг асуувал: "Зураг доорх картанд харагдана" эсвэл бүтээгдэхүүний тайлбар хийж хариулна.
- Захиалга/хаяг/утас цуглуулахыг СИСТЕМ хийнэ — чи бүү хий. Бараа жагсаалт харуулсны дараа "Аль нэгийг авмаар байна вэ? Бараа дугаараа бичнэ үү (1, 2, 3...):" гэж хэл.
- Захиалга БАТАЛГААЖУУЛАХ мессеж ХЭЗЭЭ Ч бүү явуул — "Захиалгыг баталгаажуулж байна", "Захиалга амжилттай" гэсэн хариу ХОРИОТОЙ. Систем захиалга үүсгэнэ.
- Асуулт асуувал (размер, өнгө, нөөц) шууд хариулна — захиалга руу бүү чигл.
- Мэндчилгээнд дэлгүүрийн нэрийг бүү давт — widget header-т харагдана. "Сайн байна уу! Танд юугаар туслах вэ?" хэлбэрт хариулна.
- Жагсаалтад БАЙХГҮЙ тодорхой бүтээгдэхүүн асуувал (жишээ нь: "офис өмд", "кашемир малгай", "ноолуур цамц") — ӨӨР бараа САНАЛ БОЛГОХГҮЙ. Зөвхөн: "Тийм бүтээгдэхүүн одоогоор манай жагсаалтад байхгүй байна. Ажилтан шалгаад тантай холбогдоно 😊" гэж хариулна.
- Хэрэглэгч 2 бараа ХАМТ авах нь хямдардаг уу гэвэл — жагсаалтад сет/bundle бараа байвал тэрийгээ дурдаж үнийн харьцуулалт хий. Жишээ: "Тийм! Цамц+Өмд сет 39,000₮, тусдаа авахаасаа 11,000₮ хэмнэнэ 🎁"
- БАРАА ЖАГСААЛТ ДҮРЭМ: Хэрэв 5-аас олон бараа байвал БҮГДИЙГ жагсаахгүй. Хамгийн тохирох 3-ийг сонгож жагсаа. "Үнэ хэд вэ?", "Хямдрал байгаа юу?" гэсэн ерөнхий асуулт ирвэл — "Ямар бараа сонирхож байна вэ?" гэж асуу, бүх барааг dump хийж болохгүй.
- ДУУССАН БАРАА: Хэрэв хэрэглэгч тодорхой нэртэй бараа хайсан ч олдоогүй бол (жишээ нь "офис өмд", "кашемир малгай") — "Энэ бараа одоогоор дууссан байна. Ажилтнаас дахин ирэх эсэхийг тодруулаад хариу өгье 😊" гэж хариулна. Санамсаргүй бараа САНАЛ БОЛГОХГҮЙ.${noProductsRule}`

  // --- Mode-specific rules (only one active at a time) ---
  const isHumanAgentRequest = /хүнтэй ярих|хүн хэрэгтэй|хүн дуудах|оператор|менежер|хүнтэй холбогд|амьд хүн|huntei yarih|hun heregteii|operator/i.test(input.currentMessage)

  if (isResolution) {
    prompt += `

ГОМДОЛ ГОРИМ:
1. Эхлээд сэтгэлийг хүлээн зөвшөөр ("Маш харамсаж байна")
2. Нэг асуулт тавьж дэлгэрэнгүй ав, эсвэл шийдэл санал болго
3. Бараа зарах/санал болгох ХОРИОТОЙ. Хэт эерэг хариу БОЛОХГҮЙ.${isHumanAgentRequest ? '\n4. Хэрэглэгч хүнтэй ярихыг хүссэн тул: "Таны хүсэлтийг хүлээн авлаа. Манай менежер тантай удахгүй холбогдоно." гэж товч хариул.' : ''}`
  } else if (isCare) {
    prompt += `

ЗАХИАЛГЫН СТАТУС: Тодорхой мэдээлэл өг, тайвшруул. Бараа санал болгохгүй.`
  } else if (isAssist) {
    prompt += `

ЗАХИАЛГА ГОРИМ: Хурдан дуусга. Худалдааны тактик хэрэглэхгүй.`
  }

  // --- Customer profile (if available) ---
  if (input.customerProfile) {
    const cp = input.customerProfile.formatted
    prompt += `

ХАРИЛЦАГЧ: ${cp.name} | ${cp.loyaltyTier} | Түүх: ${cp.orderHistorySummary} | Идэвхтэй: ${cp.activeOrderSummary}${cp.openIssuesSummary !== 'Байхгүй' ? ` | Гомдол: ${cp.openIssuesSummary}` : ''}${cp.issueWarning}${cp.vipNote}${cp.newCustomerNote}`
  }

  // --- Extended profile (demographics, preferences) ---
  if (input.extendedProfile) {
    prompt += `\nПРОФИЛ: ${input.extendedProfile}`
  }

  // --- Latest purchase (for return/complaint auto-lookup) ---
  if (input.latestPurchaseSummary && (isResolution || input.intent === 'return_exchange')) {
    prompt += `\n\nСҮҮЛИЙН ЗАХИАЛГА: ${input.latestPurchaseSummary}
Буцаалт/гомдол ирвэл эхлээд энэ захиалгатай холбоотой эсэхийг асуу.`
  }

  // --- Resolution Engine context (enriched business data) ---
  const resolution = input.resolution
  if (resolution) {
    if (resolution.tone === 'empathetic') {
      prompt += '\n\n⚠️ АНХААР: Харилцагч санаа зовж байна. Эхлээд өрөвдөл илэрхийлээд ("Тийм ээ, шалгая!" эсвэл "Маш харамсаж байна"), дараа нь тодорхой мэдээлэл өг.'
    }

    if (resolution.activeDelivery) {
      const d = resolution.activeDelivery
      prompt += `\n\n📦 ХҮРГЭЛТИЙН МЭДЭЭЛЭЛ: Статус: ${d.status}${d.driverName ? `, Жолооч: ${d.driverName}` : ''}${d.estimatedTime ? `, Хүлээгдэж буй: ${d.estimatedTime}` : ''}`
      prompt += '\n  ☝️ ЗААВАЛ дээрх бодит мэдээллийг хариултдаа оруул. "Маш харамсаж байна" гэх ерөнхий хариу ХОРИОТОЙ — бодит статус, жолоочийн нэр, хүлээгдэж буй хугацааг хэл.'
    }

    if (resolution.hasHistory && resolution.lastAddress) {
      prompt += `\n\n📋 ӨМНӨХ МЭДЭЭЛЭЛ: Хаяг: ${resolution.lastAddress}${resolution.lastPhone ? `, Утас: ${resolution.lastPhone}` : ''}. Хэрэв захиалагч хаяг утсаа үлдээсэн гэвэл "Өмнөх хаяг руу хүргэх үү?" гэж асуу.`
    }

    if (resolution.isDeliveryOnly) {
      prompt += '\n\n🏪 ДЭЛГҮҮР: Манайх зөвхөн хүргэлтээр бараа гарж байна. Очиж авах боломжгүй.'
    } else if (resolution.storeAddress) {
      prompt += `\n\n🏪 ДЭЛГҮҮРИЙН ХАЯГ: ${resolution.storeAddress}${resolution.storeHours ? ` | Цаг: ${resolution.storeHours}` : ''}`
    }

    if (resolution.shippingFee) {
      prompt += `\n\n💰 ХҮРГЭЛТИЙН ТӨЛБӨР: ${resolution.shippingFee}₮`
      if (resolution.freeShippingThreshold) {
        prompt += ` (${resolution.freeShippingThreshold}₮-өөс дээш захиалгад үнэгүй)`
      }
    }

    // Pickup detection: if customer asks about picking up in person
    const isPickupQuestion = /очоод|авч болох|байршил|хаана байдаг|дэлгүүр|салбар|ochij|ochd|awbal/i.test(input.currentMessage)
    if (isPickupQuestion) {
      if (resolution.isDeliveryOnly) {
        prompt += '\n\n📍 ОЧИЖ АВАХ: Манайх зөвхөн хүргэлтээр бараа гарж байна. Очиж авах боломжгүй.'
      } else if (resolution.storeAddress) {
        prompt += `\n\n📍 ДЭЛГҮҮРИЙН БАЙРШИЛ: ${resolution.storeAddress}${resolution.storeHours ? ` | Ажлын цаг: ${resolution.storeHours}` : ''}`
      }
    }
  }

  // --- Size chart (only for size queries) ---
  if (isSizeQuery) {
    prompt += `

РАЗМЕР ЗӨВЛӨГӨӨ:
- Биеийн хэмжээ бичвэл тохирох размер зөвлө. Нөөцтэй размераас ЗӨВХӨН сонго.
- S: 150-163см/45-60кг | M: 160-173см/58-72кг | L: 170-180см/68-82кг | XL: 178-188см/78-95кг
- Жин өндрөөс чухал. Хязгаараас давсан бол дараагийн том размер зөвлө.
- "Тохирох магадлалтай" гэж бич (100% баталгаа бүү өг). Нөөцийн тоо бүү харуул.
- Хувилбаруудад байхгүй размер/өнгийг бүү зохио.
- ЧУХАЛ: Размер зөвлөсний дараа "Бараа дугаараа бичнэ үү (1, 2, 3...)" гэх мэт бараа сонгох хүсэлт БҮҮБИЧ — хэрэглэгч аль хэдийн бараа сонгосон байна.
- Хэрэв хэрэглэгч бараа сонгоогүй бол: "Аль барааны хэмжээг асууж байна вэ? Та бараагаа сонгоно уу." гэж асуу.`
  }

  // --- Mid-order product detail (color, material, etc.) — product already selected ---
  if (isProductDetail) {
    prompt += `\n- ЧУХАЛ: Хэрэглэгч бараа аль хэдийн сонгосон. "Бараа дугаараа бичнэ үү" эсвэл "Аль нэгийг авмаар байна уу?" гэж ХЭЗЭЭ Ч бүү хэл.`
  }

  // --- Gift advice (only when gift-related) ---
  if (isGiftQuery) {
    prompt += `

БЭЛЭГ: Хэн рүү, төсөв асуу. 2-3 тохирох бараа санал болго. Яагаад тохирохыг товч тайлбарла.`
  }

  // --- Variant rules (only when products have variants) ---
  const hasVariants = input.products.some(p => p.variants && p.variants.length > 0)
  if (hasVariants) {
    prompt += `

ХУВИЛБАР ДҮРЭМ:
• Зөвхөн ХУВИЛБАР жагсаалтад БАЙГАА размер/өнгийг хэл
• Хэрэв өнгийн хувилбар байхгүй бол "Өнгийн сонголт байхгүй" гэж хариулна — ХЭЗЭЭ Ч өнгийг зохиож хэлж болохгүй
• Хэрэв хүсэгдсэн өнгө жагсаалтад байхгүй бол "Тийм өнгө байхгүй, боломжтой өнгөнүүд:" гэж хариулж жагсаана
• БАТАЛГААЖААГҮЙ МЭДЭЭЛЭЛ хэлж болохгүй`
  }

  // --- Color availability guard (prevent hallucination) ---
  // If customer asked for a specific color, check if it exists in variants
  if (input.products.length > 0) {
    const COLOR_MAP: Record<string, string> = {
      'улаан': 'улаан', 'улан': 'улаан', 'ulaan': 'улаан', 'red': 'улаан',
      'бор': 'бор', 'brown': 'бор',
      'шар': 'шар', 'yellow': 'шар',
      'хөх': 'хөх', 'хох': 'хөх', 'blue': 'хөх',
      'нил': 'нил ягаан', 'purple': 'нил ягаан',
      'ягаан': 'ягаан', 'pink': 'ягаан',
      'цагаан': 'цагаан', 'white': 'цагаан',
      'хар': 'хар', 'black': 'хар',
      'саарал': 'саарал', 'gray': 'саарал', 'grey': 'саарал',
      'ногоон': 'ногоон', 'green': 'ногоон',
      'цэнхэр': 'цэнхэр', 'цайвар цэнхэр': 'цайвар цэнхэр',
      'улбар': 'улбар ягаан', 'orange': 'улбар ягаан',
    }
    const msgLower = input.currentMessage.toLowerCase()
    const allColors = new Set(
      input.products.flatMap(p => (p.variants || []).map(v => v.color?.toLowerCase()).filter(Boolean))
    )
    const requested = Object.entries(COLOR_MAP).find(([kw]) => msgLower.includes(kw))
    if (requested) {
      const [, colorName] = requested
      const hasColor = [...allColors].some(c => c && (c.includes(colorName) || colorName.includes(c.split(' ')[0])))
      if (!hasColor) {
        if (allColors.size === 0) {
          prompt += `\n\n🚫 ӨНГИЙН АНХААРУУЛГА: Хэрэглэгч "${colorName}" өнгийг хүссэн. Гэхдээ энэ бүтээгдэхүүнд ӨНГИЙН СОНГОЛТ БАЙХГҮЙ — зөвхөн хэмжээгээр байна. ЗААВАЛ: "Өнгийн сонголт байхгүй, зөвхөн S/M/L/XL хэмжээгээр байна" гэж хэлнэ.`
        } else {
          const avail = [...allColors].filter(Boolean).join(', ')
          prompt += `\n\n🚫 ӨНГИЙН АНХААРУУЛГА: Хэрэглэгч "${colorName}" өнгийг хүссэн. Энэ өнгө БАЙХГҮЙ. Боломжтой өнгөнүүд: ${avail}. ЗААВАЛ тийм өнгө байхгүй гэж хэлж, боломжтой өнгөнүүдийг жагсаана. ХЭЗЭЭ Ч байхгүй өнгийг байгаа гэж хэлж болохгүй.`
        }
      }
    }
  }

  // --- Busy mode (restaurants) ---
  if (input.busyMode?.busy_mode) {
    prompt += `\n\n⚠️ ЗАВГҮЙ: Захиалга түр хаасан.`
    if (input.busyMode.busy_message) prompt += ` ${input.busyMode.busy_message}`
    if (input.busyMode.estimated_wait_minutes) prompt += ` Хүлээлт: ${input.busyMode.estimated_wait_minutes} мин.`
  }

  // --- Products (always structured the same way) ---
  if (input.products.length > 0) {
    prompt += `\n\n⚠️ ДООРХ ${input.products.length} БАРАА ОЛДСОН — "байхгүй" гэж ХЭЗЭЭ Ч хэлж болохгүй. Заавал жагсаалтаас дурд.`
    prompt += '\n\nБАРАА:'
    input.products.forEach((p, i) => {
      prompt += `\n${i + 1}. ${p.name} — ${p.base_price}₮`
      if (p.sold_out) prompt += ' [ДУУССАН]'
      if (p.description) prompt += ` | ${p.description.slice(0, 120)}`
      // Dietary tags (compact)
      const tags: string[] = []
      if (p.is_vegan) tags.push('веган')
      if (p.is_halal) tags.push('халал')
      if (p.is_gluten_free) tags.push('глютенгүй')
      if (p.spicy_level && p.spicy_level > 0) tags.push(`🌶️×${p.spicy_level}`)
      if (p.allergens && p.allergens.length > 0) tags.push(`⚠️${p.allergens.join(',')}`)
      if (tags.length > 0) prompt += ` [${tags.join(', ')}]`
      // Variants (compact)
      if (p.variants && p.variants.length > 0) {
        const hasColors = p.variants.some(v => v.color)
        const vLines = p.variants.map(v => {
          const parts: string[] = []
          if (v.size) parts.push(v.size)
          if (v.color) parts.push(v.color)
          parts.push(v.stock_quantity > 0 ? '✓' : '✗')
          return parts.join('/')
        })
        prompt += `\n   Хувилбар: ${vLines.join(', ')}`
        if (!hasColors) prompt += ` [өнгийн сонголт байхгүй]`
      }
      // FAQ (compact)
      if (p.product_faqs) {
        const faqs = Object.entries(p.product_faqs).filter(([, v]) => v)
        if (faqs.length > 0) {
          faqs.forEach(([k, v]) => { prompt += `\n   ${k}: ${v}` })
        }
      }
      if (p.ai_context) prompt += `\n   📌 ${p.ai_context}`
    })
  }

  // --- Tables (restaurants) ---
  if (input.availableTables && input.availableTables.length > 0) {
    prompt += '\n\nШИРЭЭ:'
    input.availableTables.forEach(t => {
      prompt += `\n• ${t.table_name} — ${t.capacity} хүн`
      if (t.location) prompt += ` (${t.location})`
    })
    prompt += '\nЗахиалахад нэр, утас, хүний тоо, цаг авна.'
  }

  // --- Orders ---
  if (input.orders.length > 0) {
    prompt += '\n\nЗАХИАЛГА:'
    input.orders.forEach(o => {
      prompt += `\n• ${o.order_number} — ${o.status} — ${o.total_amount}₮`
    })
  }

  // --- Return policy ---
  if (input.returnPolicy) {
    prompt += `\n\nБУЦААЛТ: ${input.returnPolicy}`
  } else if (['return_exchange'].includes(input.intent)) {
    prompt += `\nБуцаалт/солилтын тухай менежерээс лавлана уу.`
  }

  // --- Vouchers ---
  if (input.activeVouchers && input.activeVouchers.length > 0) {
    prompt += '\n\nХӨНГӨЛӨЛТ:'
    input.activeVouchers.forEach(v => {
      const label =
        v.compensation_type === 'percent_discount' ? `${v.compensation_value}%` :
        v.compensation_type === 'fixed_discount' ? `${v.compensation_value}₮` :
        v.compensation_type === 'free_shipping' ? 'Үнэгүй хүргэлт' : 'Үнэгүй бараа'
      prompt += `\n• ${v.voucher_code} — ${label} (${new Date(v.valid_until).toLocaleDateString('mn-MN')} хүртэл)`
    })
  }

  // --- JSON output schema (always last) ---
  prompt += `

ХАРИУЛТЫН ФОРМАТ — ЗААВАЛ JSON:
{
  "response": "Харилцагчид илгээх Монгол хэлний хариулт",
  "empathy_needed": true/false,
  "confidence": 0.0-1.0,
  "requires_human_review": true/false,
  "detected_issues": []
}

JSON ДҮРЭМ:
- response: Байгалийн Монгол хариулт, 1-5 өгүүлбэр
- empathy_needed: true = гомдол, санаа зовсон, буцаалт
- confidence: 0.0 = мэдэхгүй, 1.0 = бүрэн итгэлтэй
- requires_human_review: true = хүнд шилжүүлэх хэрэгтэй (гомдол, маргаан, хүн хүссэн)
- detected_issues: ["complaint", "delivery_delay", "wrong_item", "needs_stock_check", "customer_upset", "return_request", "payment_issue"] зэргээс тохирохыг сонго, хоосон [] бол асуудалгүй`

  return prompt
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a contextual AI response using conversation history.
 * Returns structured JSON with response text + metadata, or null on failure.
 */
export async function contextualAIResponse(input: ContextualInput): Promise<ContextualAIResponseJSON | null> {
  if (!isOpenAIConfigured()) return null
  // Allow GPT on turn 1 for 'general' and 'complaint' — ambiguous and upset first
  // messages need GPT most. All other intents without history fall to templates.
  const TURN1_GPT_INTENTS = ['general', 'complaint']
  if (input.history.length === 0 && !TURN1_GPT_INTENTS.includes(input.intent)) return null

  // Guard: never let GPT generate responses for product queries when the store
  // has no matching products. Without this, GPT invents product names and prices.
  // Returning null falls through to the deterministic template which correctly
  // says "product not found" without hallucinating.
  if (input.intent === 'product_search' && input.products.length === 0) return null

  // Guard: standalone digits (≥5) look like phone numbers or order numbers.
  // GPT hallucinates order confirmations when it sees them — let the deterministic
  // handler deal with digits to prevent "Захиалгыг баталгаажуулж байна" fake responses.
  if (/^\d{5,}$/.test(input.currentMessage.trim())) return null

  try {
    // Normalize Latin-typed Mongolian to Cyrillic so GPT understands it.
    const normalizeMsgContent = (text: string): string => {
      const hasLatin = /[a-zA-Z]{2,}/.test(text)
      return hasLatin ? normalizeText(text) : text
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(input) },
      ...input.history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.role === 'user' ? normalizeMsgContent(h.content) : h.content,
      })),
      { role: 'user' as const, content: normalizeMsgContent(input.currentMessage) },
    ]

    const result = await chatCompletionJSON<ContextualAIResponseJSON>({ messages, maxTokens: 700 })
    const data = result.data

    // Validate the required 'response' field exists
    if (!data.response || typeof data.response !== 'string') {
      console.error('[contextual-responder] Invalid JSON: missing response field')
      return null
    }

    // Normalize optional fields with safe defaults
    return {
      response: data.response,
      empathy_needed: data.empathy_needed ?? false,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      requires_human_review: data.requires_human_review ?? false,
      detected_issues: Array.isArray(data.detected_issues) ? data.detected_issues : [],
    }
  } catch (error) {
    console.error('[contextual-responder] Failed:', error)
    return null
  }
}
