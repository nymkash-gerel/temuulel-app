/**
 * LLM-tier contextual responder — sends conversation history + product/order
 * facts to GPT-4o-mini for natural multi-turn conversation.
 *
 * Optimized prompt: ~2,000 tokens base (down from ~4,500).
 * Context-dependent sections only included when relevant to the intent.
 */

import { isOpenAIConfigured, chatCompletion } from './openai-client'
import type { ChatMessage } from './openai-client'
import { normalizeText } from '../chat-ai'
import type { CustomerProfile } from './customer-profile'

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
}

// ---------------------------------------------------------------------------
// Prompt builder — modular, intent-aware, token-efficient
// ---------------------------------------------------------------------------

function buildSystemPrompt(input: ContextualInput): string {
  const isResolution = ['complaint', 'escalated'].includes(input.intent)
  const isCare = ['order_status', 'shipping_info'].includes(input.intent)
  const isAssist = ['order_collection', 'order_created'].includes(input.intent)
  const isSizeQuery = input.intent === 'size_info'
  const isGiftQuery = /бэлэг|санал болг|юу авбал|зөвлө/.test(normalizeText(input.currentMessage))

  // --- Core identity + universal rules (always included) ---
  let prompt = `Та "${input.storeName}" дэлгүүрийн туслах Temuulel. Монгол хэлээр хариулна. English if they write in English.

ДҮРЭМ:
- Богино, шууд, байгалийн хариулт. Нэг мессежид нэг асуулт.
- AI/chatbot/хиймэл оюун гэж ХЭЗЭЭ Ч бүү хэл.
- "Өөр юугаар тусалах вэ?" гэсэн робот хариулт ХОРИОТОЙ.
- Мэдэхгүй зүйлийг зохиохгүй.
- Бүтээгдэхүүн дурдах бүрт үнийг ₮-тэй бич.
- Зураг Messenger карт-аар автомат илгээнэ. "Зураг харуулах боломжгүй" гэж бүү хэл.
- Захиалга/хаяг/утас цуглуулахыг СИСТЕМ хийнэ — чи бүү хий. Бараа жагсаалт харуулсны дараа шууд "Аль нэгийг авмаар байна вэ? Дугаараа бичнэ үү:" гэж хэл. "захиалъя" гэж бичихийг шаардахгүй.
- Асуулт асуувал (размер, өнгө, нөөц) шууд хариулна — захиалга руу бүү чигл.
- Мэндчилгээнд дэлгүүрийн нэрийг бүү давт — widget header-т харагдана. "Сайн байна уу! Танд юугаар туслах вэ?" хэлбэрт хариулна.`

  // --- Mode-specific rules (only one active at a time) ---
  if (isResolution) {
    prompt += `

ГОМДОЛ ГОРИМ:
1. Эхлээд сэтгэлийг хүлээн зөвшөөр ("Маш харамсаж байна")
2. Нэг асуулт тавьж дэлгэрэнгүй ав, эсвэл шийдэл санал болго
3. Бараа зарах/санал болгох ХОРИОТОЙ. Хэт эерэг хариу БОЛОХГҮЙ.`
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

  // --- Size chart (only for size queries) ---
  if (isSizeQuery) {
    prompt += `

РАЗМЕР ЗӨВЛӨГӨӨ:
- Биеийн хэмжээ бичвэл тохирох размер зөвлө. Нөөцтэй размераас ЗӨВХӨН сонго.
- S: 150-163см/45-60кг | M: 160-173см/58-72кг | L: 170-180см/68-82кг | XL: 178-188см/78-95кг
- Жин өндрөөс чухал. Хязгаараас давсан бол дараагийн том размер зөвлө.
- "Тохирох магадлалтай" гэж бич (100% баталгаа бүү өг). Нөөцийн тоо бүү харуул.
- Хувилбаруудад байхгүй размер/өнгийг бүү зохио.`
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

ХУВИЛБАР: Зөвхөн жагсаалтад байгаа размер/өнгийг хэл. Байхгүйг "Одоогоор байхгүй" гэж хариулна.`
  }

  // --- Busy mode (restaurants) ---
  if (input.busyMode?.busy_mode) {
    prompt += `\n\n⚠️ ЗАВГҮЙ: Захиалга түр хаасан.`
    if (input.busyMode.busy_message) prompt += ` ${input.busyMode.busy_message}`
    if (input.busyMode.estimated_wait_minutes) prompt += ` Хүлээлт: ${input.busyMode.estimated_wait_minutes} мин.`
  }

  // --- Products (always structured the same way) ---
  if (input.products.length > 0) {
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
        const vLines = p.variants.map(v => {
          const parts: string[] = []
          if (v.size) parts.push(v.size)
          if (v.color) parts.push(v.color)
          parts.push(v.stock_quantity > 0 ? '✓' : '✗')
          return parts.join('/')
        })
        prompt += `\n   Хувилбар: ${vLines.join(', ')}`
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

  return prompt
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a contextual AI response using conversation history.
 * Returns null if OpenAI is not configured or on failure.
 */
export async function contextualAIResponse(input: ContextualInput): Promise<string | null> {
  if (!isOpenAIConfigured()) return null
  if (input.history.length === 0) return null

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

    const result = await chatCompletion({ messages, maxTokens: 500 })
    return result.content
  } catch (error) {
    console.error('[contextual-responder] Failed:', error)
    return null
  }
}
