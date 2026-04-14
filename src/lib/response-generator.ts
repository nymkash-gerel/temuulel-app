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
  settings?: ChatbotSettings,
  resolution?: import('./resolution-engine').ResolutionContext | null,
): string {
  const showPrices = settings?.show_prices !== false

  switch (intent) {
    case 'greeting':
      return settings?.welcome_message ||
        `${storeName ? `${storeName}-д тавтай морил! ` : ''}Сайн байна уу! 😊 Танд юугаар туслах вэ?\n\nБүтээгдэхүүн, захиалга, хүргэлтийн мэдээлэл — дурын асуулт тавьж болно!`

    case 'thanks':
      return `Баярлалаа! 🙏 Бусад асуулт байвал чөлөөтэй бичээрэй. Бид үргэлж тусалхад бэлэн!`

    case 'product_search': {
      if (products.length === 0) {
        let noProductResponse = `😔 **Уучлаарай, таны хайсан бүтээгдэхүүн олдсонгүй.**\n\n`
        noProductResponse += `🔍 **Дахин хайж үзнэ үү:**\n`
        noProductResponse += `• Бүтээгдэхүүний нэрээр — жишээ нь *"кашемир свитер"*\n`
        noProductResponse += `• Төрлөөр — жишээ нь *"гутал"*, *"хувцас"*, *"цүнх"*\n`
        noProductResponse += `• Үнэн хүрээгээр — жишээ нь *"50,000₮-аас доош"*\n\n`
        noProductResponse += `📋 Бүх бүтээгдэхүүнийг үзэхийг хүсвэл **"бүх бараа"** гэж бичнэ үү.`
        return noProductResponse
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
        // Add empathy if resolution says customer is worried
        const empathyPrefix = resolution?.tone === 'empathetic'
          ? 'Тийм ээ, шалгая! '
          : ''
        return `${empathyPrefix}Захиалгын дугаар эсвэл утасны дугаараа бичнэ үү, шалгаад мэдэгдье 😊`
      }

      let response = `📋 **Таны захиалгын мэдээлэл:**\n\n`
      orders.forEach((o) => {
        response += `🔖 **${o.order_number}**\n`
        response += `   📊 Статус: ${ORDER_STATUS_MAP[o.status] || o.status}\n`
        response += `   💰 Дүн: ${formatPrice(o.total_amount)}\n`
        if (o.tracking_number) {
          response += `   🚚 Трэкинг: \`${o.tracking_number}\`\n`
        }
        response += `   📅 Огноо: ${new Date(o.created_at).toLocaleDateString('mn-MN')}\n\n`
      })
      response += `Захиалгатай холбоотой асуулт байвал бичнэ үү!`
      return response
    }

    case 'complaint': {
      return `😔 Уучлаарай! Асуудлаа захиалгын дугаартай хамт бичнэ үү — 12 цагийн дотор шийднэ. Яаралтай бол "менежер" гэж бичээрэй.`
    }

    case 'return_exchange': {
      let returnResponse = `🔄 Буцаах/солих бол захиалгын дугаар + шалтгаанаа бичнэ үү.`
      if (settings?.return_policy) {
        returnResponse += `\n📋 ${settings.return_policy}`
      }
      returnResponse += `\n24 цагийн дотор хариу өгнө.`
      return returnResponse
    }

    case 'size_info': {
      if (products.length > 0) {
        // Show max 3 products, short descriptions
        const top = products.slice(0, 3)
        let response = `📏 Размер:\n`
        top.forEach((p, i) => {
          response += `${i + 1}. **${p.name}**`
          if (showPrices) response += ` — ${formatPrice(p.base_price)}`
          response += '\n'
        })
        response += `\nЯмар барааны размер мэдэхийг хүсвэл нэрийг нь бичнэ үү!`
        return response
      }

      return `📏 Ерөнхий размер: S(36), M(38), L(40), XL(42), XXL(44)\nЯмар барааны размер мэдэхийг хүсвэл нэрийг нь бичнэ үү!`
    }

    case 'payment': {
      return `💳 Төлбөр: QPay 📱 | Дансаар шилжүүлэг 🏦 | Бэлнээр 💵\nЗахиалга өгөх бол "захиалах" гэж бичнэ үү!`
    }

    case 'shipping': {
      let shipResponse = `🚚 **Хүргэлтийн мэдээлэл**\n\n`
      shipResponse += `📍 **Хүргэлтийн бүсүүд:**\n`

      // Use resolution data for specific fees if available
      if (resolution?.shippingFee) {
        shipResponse += `• УБ хот дотор — **${resolution.shippingFee.toLocaleString()}₮** (24-48 цаг)\n`
        shipResponse += `• Хөдөө орон нутаг — **3-7 ажлын өдөр**\n\n`
        if (resolution.freeShippingThreshold) {
          shipResponse += `🎁 **${resolution.freeShippingThreshold.toLocaleString()}₮**-өөс дээш захиалгад хүргэлт **ҮНЭГҮЙ!**\n\n`
        }
      } else {
        shipResponse += `• Улаанбаатар хот — **1-2 ажлын өдөр**\n`
        shipResponse += `• Хөдөө орон нутаг — **3-5 ажлын өдөр**\n\n`
        shipResponse += `💰 **Хүргэлтийн төлбөр:**\n`
        shipResponse += `• Захиалгын дүн болон бүсээс хамаарна\n\n`
      }

      if (resolution?.isDeliveryOnly) {
        shipResponse += `Зөвхөн хүргэлтээр.\n`
      } else if (resolution?.storeAddress) {
        shipResponse += `🏪 Очиж авах: ${resolution.storeAddress}\n`
      }
      shipResponse += `📮 Хаягаа бичвэл хүргэлтийн төлбөрийг тооцоолж хэлье!`
      return shipResponse
    }

    case 'table_reservation':
      return `🍽️ **Ширээ захиалга**\n\nБид таны захиалгыг хүлээн авахад бэлэн байна!\n\n📝 **Дараах мэдээллийг бичнэ үү:**\n\n1️⃣ **Хэдэн хүн** — жишээ нь 4 хүн\n2️⃣ **Огноо, цаг** — жишээ нь өнөөдөр орой 7:00\n3️⃣ **Нэр, утас** — жишээ нь Болд, 99112233\n4️⃣ **Тусгай хүсэлт** (боломжтой бол) — цонхны ширээ, хүүхдийн сандал гэх мэт\n\n💬 Жишээ: *"4 хүн, өнөөдөр орой 7 цагт, Болд 99112233, цонхны ширээ"*\n\n✅ Менежер **15 минутын дотор** баталгаажуулна.`

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
  customerProfile?: CustomerProfile | null,
  extendedProfile?: string | null,
  latestPurchaseSummary?: string | null,
  resolution?: import('./resolution-engine').ResolutionContext | null,
  customerPrefs?: { weight_kg?: number; height_cm?: number; preferred_size?: string } | null,
  qualityMetaOut?: { confidence: number; detectedIssues: string[]; requiresHumanReview: boolean },
  knowledgeEntries?: { question: string; answer: string }[],
): Promise<string> {
  // Tier 1: Contextual AI with conversation history.
  // Also allow GPT on turn 1 for 'general' and 'complaint' intents — ambiguous and
  // upset first messages need GPT the most. Other intents (product_search, order_status,
  // etc.) have deterministic templates that work well without history context.
  const historyForGPT = history ?? []
  const callGPT = historyForGPT.length > 0 || intent === 'general' || intent === 'complaint'
  if (callGPT) {
    try {
      const { contextualAIResponse } = await import('./ai/contextual-responder')
      const contextResult = await contextualAIResponse({
        history: historyForGPT,
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
        extendedProfile: extendedProfile ?? null,
        latestPurchaseSummary: latestPurchaseSummary ?? null,
        resolution: resolution ?? null,
        customerPrefs: customerPrefs ?? null,
        knowledgeEntries,
      })
      if (contextResult) {
        // Log structured AI metadata for analytics/escalation
        if (contextResult.requires_human_review || contextResult.detected_issues.length > 0) {
          console.log(
            `[ai-response] empathy=${contextResult.empathy_needed} confidence=${contextResult.confidence} ` +
            `human_review=${contextResult.requires_human_review} issues=[${contextResult.detected_issues.join(',')}]`
          )
        }
        // Expose quality metadata to caller
        if (qualityMetaOut) {
          qualityMetaOut.confidence = contextResult.confidence
          qualityMetaOut.detectedIssues = contextResult.detected_issues
          qualityMetaOut.requiresHumanReview = contextResult.requires_human_review
        }
        return contextResult.response
      }
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
  return generateResponse(intent, products, orders, storeName, settings, resolution)
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
  // Use word-boundary-aware check: "хүн" must not match inside "хүнд" (dative suffix).
  // Replace non-letter chars with spaces, then pad for safe substring matching.
  const wordified = normalized.replace(/[^а-яёүөА-ЯЁҮӨa-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
  const padded = ` ${wordified} `
  return keywords.some(k => {
    if (!k) return false
    const kw = k.replace(/[^а-яёүөА-ЯЁҮӨa-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
    return padded.includes(` ${kw} `)
  })
}
