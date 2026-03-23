import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import type { RecommendationInput, RecommendationOutput, ProductForRecommendation } from './types'
import { normalizeText } from '../chat-ai'

const SYSTEM_PROMPT = `Та Facebook Messenger дээрх монгол дэлгүүрийн борлуулалтын туслах.
Хэрэглэгчийн хайлтад тохирсон бүтээгдэхүүнүүдийг байгалийн хэллэгээр санал болго.
Үнийг ₮ тэмдэгтэйгээр бич. Хариултыг 3-5 өгүүлбэрээр бич.
Зөвхөн өгөгдсөн бүтээгдэхүүнүүдийг санал болго, шинээр зохиож болохгүй.
ЧУХАЛ: Вэбсайт, сагс (cart), онлайн дэлгүүр БАЙХГҮЙ. Захиалга зөвхөн энэ чатаар авна.

ХУВИЛБАРЫН ДҮРЭМ:
- Бүтээгдэхүүн дурдахдаа байгаа хувилбар (өнгө/размер) болон тэдгээрийн үнийг хамт бич.
- Хувилбар байвал "Ямар хувилбарыг авах вэ?" гэж асуу.
- Хувилбар хэд хэдэн байвал: "Хар/Цагаан гэсэн 2 өнгөтэй" гэх мэтээр товч жагсаа.
- Хувилбаргүй бол хувилбарын тухай ДУРДАХГҮЙ.

ӨНГИЙН ДҮРЭМ — ЗААВАЛ ДАГА:
- Хэрэглэгч тодорхой өнгө хүссэн бол зөвхөн ХУВИЛБАРТ БАЙГАА өнгийг хэл.
- Хэрэв хүссэн өнгө байхгүй бол: "Тийм өнгө байхгүй байна. Боломжтой өнгөнүүд: [жагсаа]" гэж хэлнэ.
- Хэрэв өнгийн хувилбар огт байхгүй бол: "Өнгийн сонголт байхгүй, зөвхөн хэмжээгээр байна" гэж хэлнэ.
- ХЭЗЭЭ Ч хувилбарт байхгүй өнгийг байгаа гэж хэлж болохгүй. Энэ ЧУХАЛ ДҮРЭМ.

JSON format:
{ "message": "Монгол хэлээр бичсэн байгалийн хэллэгийн санал" }`

function formatProducts(products: ProductForRecommendation[]): string {
  return products
    .map((p, i) => {
      let line = `${i + 1}. ${p.name} — ${p.base_price}₮`
      if (p.description) line += ` | ${p.description.slice(0, 80)}`
      if (p.sales_script) line += ` | ${p.sales_script}`
      // Include variant info so the AI can mention them
      if (p.variants && p.variants.length > 0) {
        const inStock = p.variants.filter(v => v.stock_quantity > 0)
        if (inStock.length > 0) {
          const variantStr = inStock.map(v => {
            const parts = [v.size, v.color].filter(Boolean).join('/')
            return parts || `${v.price}₮`
          }).join(', ')
          line += ` | Хувилбарууд: ${variantStr}`
        }
      }
      return line
    })
    .join('\n')
}

export async function writeRecommendation(
  input: RecommendationInput
): Promise<RecommendationOutput | null> {
  if (!isOpenAIConfigured()) return null
  if (input.products.length === 0) return null

  try {
    // Normalize Latin-typed Mongolian → Cyrillic so GPT understands
    const query = /[a-zA-Z]{2,}/.test(input.customer_query)
      ? normalizeText(input.customer_query)
      : input.customer_query

    // Color availability guard — detect requested color and warn LLM if unavailable
    const COLOR_DETECT: Record<string, string> = {
      'улаан': 'улаан', 'улан': 'улаан', 'ulaan': 'улаан', 'red': 'улаан',
      'бор': 'бор', 'brown': 'бор',
      'шар': 'шар', 'yellow': 'шар',
      'хөх': 'хөх', 'хох': 'хөх', 'blue': 'хөх',
      'ягаан': 'ягаан', 'pink': 'ягаан', 'нил ягаан': 'нил ягаан',
    }
    const qLower = query.toLowerCase()
    const requestedColor = Object.entries(COLOR_DETECT).find(([kw]) => qLower.includes(kw))
    let colorWarning = ''
    if (requestedColor) {
      const [, colorName] = requestedColor
      const allColors = new Set(
        input.products.flatMap(p =>
          (p.variants || []).map(v => (v as { color?: string }).color?.toLowerCase()).filter(Boolean)
        )
      )
      const hasColor = [...allColors].some(c => c && (c.includes(colorName) || colorName.includes(c)))
      if (!hasColor) {
        if (allColors.size === 0) {
          colorWarning = `\n\n🚫 АНХААРУУЛГА: Хэрэглэгч "${colorName}" өнгийг хүссэн. Гэхдээ эдгээр бүтээгдэхүүнд ӨНГИЙН СОНГОЛТ БАЙХГҮЙ (зөвхөн хэмжээгээр). ЗААВАЛ хэлнэ.`
        } else {
          const avail = [...allColors].filter(Boolean).join(', ')
          colorWarning = `\n\n🚫 АНХААРУУЛГА: Хэрэглэгч "${colorName}" өнгийг хүссэн. Энэ өнгө БАЙХГҮЙ. Боломжтой өнгөнүүд: ${avail}. ЗААВАЛ "тийм өнгө байхгүй" гэж хэлж боломжтой өнгөнүүдийг жагсаана.`
        }
      }
    }

    const userContent = `Хайлт: ${query}\n\nБүтээгдэхүүнүүд:\n${formatProducts(input.products)}${colorWarning}`

    const result = await jsonCompletion<RecommendationOutput>({
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      maxTokens: 400,
    })
    return result.data
  } catch (error) {
    console.error('[recommendation-writer] Failed:', error)
    return null
  }
}
