/**
 * LLM-tier contextual responder — sends conversation history + product/order
 * facts to GPT-4o-mini for natural multi-turn conversation.
 */

import { isOpenAIConfigured, chatCompletion } from './openai-client'
import type { ChatMessage } from './openai-client'
import { normalizeText } from '../chat-ai'

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
  // Restaurant features
  availableTables?: TableContext[]
  busyMode?: BusyModeContext
}

function buildSystemPrompt(input: ContextualInput): string {
  let prompt = `Та "${input.storeName}" дэлгүүрийн Facebook Messenger чатбот.
Монгол хэлээр хариулна. Богино, эелдэг, мэргэжлийн.
Зөвхөн өгөгдсөн мэдээллийг ашиглана — зохиож болохгүй.

ЧУХАЛ — ЗАХИАЛГЫН ДҮРЭМ:
- Энэ бол Messenger чатбот. Вэбсайт, сагс (cart), онлайн дэлгүүр БАЙХГҮЙ.
- "Сагсанд нэмнэ үү", "вэбсайтаас үзнэ үү", "онлайн захиалга өгнө үү" гэж ХЭЗЭЭ Ч ХЭЛЭХГҮЙ.
- Хэрэглэгч захиалга өгөхийг хүсвэл ЭНЭ ЧАТААР шууд захиалга авна:
  1. Ямар бараа, хэдэн ширхэг хэрэгтэйг асуу
  2. Хүргэлтийн хаяг, утасны дугаар ав
  3. Менежер баталгаажуулж холбогдоно гэж мэдэгд
- Жишээ: "Захиалахыг хүсвэл ямар бараа, хэдэн ширхэг хэрэгтэйг бичнэ үү. Бид хаяг, утасны дугаар аваад хүргэлт зохион байгуулна!"

ХЭМЖЭЭ/ӨНГӨ ДҮРЭМ:
- Бүтээгдэхүүний "Хувилбарууд" хэсэгт ЯГ ямар размер, өнгө, нөөц (ширхэг) байгааг жагсаасан.
- ЗӨВХӨН тэр жагсаалтад байгаа размер, өнгийг хэл — ШИНЭЭР ЗОХИОХГҮЙ.
- Жагсаалтад байхгүй размер, өнгийг хэрэглэгч асуувал "Одоогоор тэр хувилбар байхгүй байна" гэж хариулна.

РАЗМЕР ЗӨВЛӨГӨӨ:
- Хэрэглэгч биеийн хэмжээ (өндөр, жин) бичвэл ЗААВАЛ тохирох размер зөвлө.
- "Хувилбарууд" дээрх НӨӨЦТЭЙ размеруудаас ЗӨВХӨН сонго — нөөцгүй размер санал БОЛГОХГҮЙ.
- "size_fit" мэдээлэл байвал түүнийг ашигла. Байхгүй бол ерөнхий стандартаар зөвлө:
  S: 155-165см, 50-60кг | M: 163-173см, 60-70кг | L: 170-180см, 68-80кг | XL: 178-185см, 78-90кг
- Хариултад: тохирох размер + өнгө + үнэ + нөөцийн тоо бичнэ.
- Жишээ: "Таны хэмжээнд M размер тохирно. M/Цагаан — 189,000₮ (3 ширхэг нөөцтэй)"
- 100% баталгаа өгөхгүй — "тохирох магадлалтай" гэж бич.

ҮНИЙН ДҮРЭМ:
- Бүтээгдэхүүн дурдах бүрт ЗААВАЛ үнийг хамт бич. Жишээ: "Кашемир цамц — 189,000₮"
- Үнийг ₮ тэмдэгтэйгээр бич. Үнэгүй хариулт ХЭЗЭЭ Ч БҮҮҮ ӨГ.
- Хэрэглэгч үнэ асуувал шууд хариулна — "менежерээс лавлана уу" гэж БОЛОХГҮЙ.

ЗУРГИЙН ДҮРЭМ:
- Бүтээгдэхүүний зургийг Messenger карт (card) хэлбэрээр АВТОМАТААР илгээнэ.
- "Зураг харуулах боломжгүй" гэж ХЭЗЭЭ Ч БҮҮҮ ХЭЛ.
- Хэрэглэгч зураг асуувал: "Бүтээгдэхүүний зургийг доор илгээж байна" гэж хариулна.
- Зураг байхгүй бол: "Одоогоор зураг байхгүй байна, тун удахгүй нэмнэ" гэж хариулна.

ИЖИЛ УТГАТАЙ НЭРШИЛ:
- "Кашемир" = "Ноолуур" = "Ноолууран" (бүгд cashmere гэсэн утгатай)
- "Арьсан" = "Leather"
- Хэрэглэгч эдгээр үгийн аль нэгийг хэрэглэвэл тохирох бүтээгдэхүүнийг ШУУД танилцуул.
- "Байхгүй" гэж БҮҮҮ ХЭЛ — ижил утгатай бүтээгдэхүүн жагсаалтад байвал түүнийг санал болго.`

  // Busy mode warning (restaurants)
  if (input.busyMode?.busy_mode) {
    prompt += '\n\n⚠️ ЗАВГҮЙ ГОРИМ ИДЭВХТЭЙ:\n'
    prompt += 'Одоогоор захиалга түр хаасан байна.\n'
    if (input.busyMode.busy_message) {
      prompt += `Мессеж: ${input.busyMode.busy_message}\n`
    }
    if (input.busyMode.estimated_wait_minutes) {
      prompt += `Хүлээлтийн хугацаа: ${input.busyMode.estimated_wait_minutes} минут\n`
    }
    prompt += 'Хэрэглэгч захиалга өгөхийг хүсвэл энэ мэдээллийг хэлж, дараа дахин оролдохыг хүс.\n'
  }

  if (input.products.length > 0) {
    prompt += '\n\nБүтээгдэхүүнүүд:\n'
    input.products.forEach((p, i) => {
      prompt += `${i + 1}. ${p.name} — ${p.base_price}₮`
      if (p.sold_out) prompt += ' [ДУУССАН]'
      if (p.description) prompt += ` | ${p.description.slice(0, 150)}`
      prompt += '\n'
      // Include allergen/dietary info for restaurants
      const dietary: string[] = []
      if (p.is_vegan) dietary.push('🌱 Веган')
      if (p.is_halal) dietary.push('☪️ Халал')
      if (p.is_gluten_free) dietary.push('🌾 Глютенгүй')
      if (p.spicy_level && p.spicy_level > 0) dietary.push(`🌶️ x${p.spicy_level}`)
      if (dietary.length > 0) {
        prompt += `   Тэмдэглэгээ: ${dietary.join(', ')}\n`
      }
      if (p.allergens && p.allergens.length > 0) {
        prompt += `   ⚠️ Харшил: ${p.allergens.join(', ')}\n`
      }
      // Include variant data (sizes, colors, stock)
      if (p.variants && p.variants.length > 0) {
        const variantLines = p.variants.map((v) => {
          const parts: string[] = []
          if (v.size) parts.push(v.size)
          if (v.color) parts.push(v.color)
          parts.push(`${v.stock_quantity} ширхэг`)
          return parts.join(' / ')
        })
        prompt += `   Хувилбарууд: ${variantLines.join(', ')}\n`
        prompt += `   ⚠️ ЗӨВХӨН дээрх хувилбарууд байна — өөр размер, өнгө ЗОХИОХГҮЙ.\n`
      }
      // Include FAQ data if available
      if (p.product_faqs) {
        const faqEntries = Object.entries(p.product_faqs).filter(([, v]) => v)
        if (faqEntries.length > 0) {
          faqEntries.forEach(([key, value]) => {
            prompt += `   ${key}: ${value}\n`
          })
        }
      }
      // Include merchant's AI instructions for this product
      if (p.ai_context) {
        prompt += `   📌 Заавар: ${p.ai_context}\n`
      }
    })
  }

  // Available tables (restaurants)
  if (input.availableTables && input.availableTables.length > 0) {
    prompt += '\n\nБОЛОМЖТОЙ ШИРЭЭНҮҮД:\n'
    input.availableTables.forEach((t) => {
      prompt += `• ${t.table_name} — ${t.capacity} хүн`
      if (t.location) prompt += ` (${t.location})`
      prompt += '\n'
    })
    prompt += 'Ширээ захиалах бол хэрэглэгчээс нэр, утас, хүний тоо, цаг авна.\n'
  }

  if (input.orders.length > 0) {
    prompt += '\n\nЗахиалгууд:\n'
    input.orders.forEach((o) => {
      prompt += `• ${o.order_number} — ${o.status} — ${o.total_amount}₮\n`
    })
  }

  if (input.returnPolicy) {
    prompt += `\n\nБУЦААЛТ/СОЛИЛТЫН БОДЛОГО:\n${input.returnPolicy}\nХэрэглэгч буцаалт, солилт, буцаан олголтын тухай асуувал энэ бодлогоор хариулна.\n`
  } else {
    prompt += `\nБуцаалт/солилтын тухай асуувал "менежерээс лавлана уу" гэж хариулна.\n`
  }

  if (input.activeVouchers && input.activeVouchers.length > 0) {
    prompt += '\n\nХӨНГӨЛӨЛТИЙН ЭРХ:\nЭнэ харилцагч дараах хөнгөлөлтийн эрхтэй:\n'
    input.activeVouchers.forEach((v) => {
      const label =
        v.compensation_type === 'percent_discount' ? `${v.compensation_value}% хөнгөлөлт` :
        v.compensation_type === 'fixed_discount' ? `${v.compensation_value}₮ хөнгөлөлт` :
        v.compensation_type === 'free_shipping' ? 'Үнэгүй хүргэлт' : 'Үнэгүй бараа'
      prompt += `• Код: ${v.voucher_code} — ${label} (хүчинтэй: ${new Date(v.valid_until).toLocaleDateString('mn-MN')} хүртэл)\n`
    })
    prompt += 'Захиалга хийх үед энэ хөнгөлөлтийн кодыг ашиглахыг сануулж болно.\n'
  }

  return prompt
}

/**
 * Generate a contextual AI response using conversation history.
 * Returns null if OpenAI is not configured or on failure.
 */
export async function contextualAIResponse(input: ContextualInput): Promise<string | null> {
  if (!isOpenAIConfigured()) return null
  if (input.history.length === 0) return null

  try {
    // Normalize Latin-typed Mongolian to Cyrillic so GPT understands it.
    // e.g. "nooluuuran tsamts" → "ноолуууран цамц"
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
