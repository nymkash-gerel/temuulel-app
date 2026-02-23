/**
 * Response generation for the chat AI system.
 * Deterministic templates + AI-powered responses with fallback chain.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { normalizeText } from './text-normalizer'
import type {
  ChatbotSettings,
  ProductMatch,
  OrderMatch,
  TableMatch,
  MessageHistoryEntry,
  ActiveVoucherInfo,
  RestaurantContext,
} from './chat-ai-types'
import type { CustomerProfile } from './ai/customer-profile'

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Deterministic template response
// ---------------------------------------------------------------------------

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
// Message History
// ---------------------------------------------------------------------------

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

  return data.reverse().map((m: { content: string; is_from_customer: boolean }) => ({
    role: m.is_from_customer ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))
}

// ---------------------------------------------------------------------------
// AI Response (with fallback chain)
// ---------------------------------------------------------------------------

/**
 * Async wrapper that tries AI-powered response, falling back to deterministic template.
 *
 * Fallback chain:
 * 1. Contextual AI (if history provided + OpenAI configured) — full multi-turn
 * 2. Recommendation writer (for product_search with products) — single-turn AI
 * 3. Deterministic template — always works, zero cost
 */
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
  customerProfile?: CustomerProfile | null
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
        availableTables: restaurantContext?.availableTables?.map(t => ({
          table_name: t.table_name,
          capacity: t.capacity,
          status: t.status,
          location: t.location,
        })),
        busyMode: restaurantContext?.busyMode,
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

// ---------------------------------------------------------------------------
// Handoff keyword matching
// ---------------------------------------------------------------------------

/**
 * Check if a message matches configured handoff keywords.
 */
export function matchesHandoffKeywords(message: string, settings: ChatbotSettings): boolean {
  if (!settings.auto_handoff || !settings.handoff_keywords) return false
  const keywords = settings.handoff_keywords.split(',').map(k => normalizeText(k.trim()))
  const normalized = normalizeText(message)
  return keywords.some(k => k && normalized.includes(k))
}
