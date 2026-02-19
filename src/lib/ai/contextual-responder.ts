/**
 * LLM-tier contextual responder — sends conversation history + product/order
 * facts to GPT-4o-mini for natural multi-turn conversation.
 */

import { isOpenAIConfigured, chatCompletion } from './openai-client'
import type { ChatMessage } from './openai-client'

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

export interface ProductContext {
  name: string
  base_price: number
  description?: string
  product_faqs?: Record<string, string> | null
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
  let prompt = `Та "${input.storeName}" ecommerce дэлгүүрийн чатбот.
Монгол хэлээр хариулна. Богино, эелдэг, мэргэжлийн.
Зөвхөн өгөгдсөн мэдээллийг ашиглана — зохиож болохгүй.

ХЭМЖЭЭ/РАЗМЕР ДҮРЭМ:
- Бүтээгдэхүүний мэдээлэлд "size_fit" гэсэн хэмжээний зөвлөмж байвал ТЭР МЭДЭЭЛЛИЙГ АШИГЛАЖ тохирох размер зөвлөнө.
- Хэрэглэгч жин, өндөр, биеийн хэмжээ хэлсэн бол size_fit мэдээлэлд тулгуурлан тодорхой размер санал болго.
- Жишээ: size_fit-д "160см 55кг хүнд M тохиромжтой" гэсэн бол 160см 55кг хэрэглэгчид M зөвлө.
- size_fit мэдээлэл байхгүй бол зүгээр байгаа размеруудыг жагсааж, "менежерээс лавлана уу" гэж нэм.
- 100% баталгаа өгөхгүй — "яг тохирохыг баталгаажуулахын тулд манай менежерээс лавлана уу" гэж нэмнэ.
Үнийг ₮ тэмдэгтэйгээр бич.`

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
      // Include FAQ data if available
      if (p.product_faqs) {
        const faqEntries = Object.entries(p.product_faqs).filter(([, v]) => v)
        if (faqEntries.length > 0) {
          faqEntries.forEach(([key, value]) => {
            prompt += `   ${key}: ${value}\n`
          })
        }
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
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(input) },
      ...input.history.map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: input.currentMessage },
    ]

    const result = await chatCompletion({ messages, maxTokens: 500 })
    return result.content
  } catch (error) {
    console.error('[contextual-responder] Failed:', error)
    return null
  }
}
