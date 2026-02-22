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
    const userContent = `Хайлт: ${query}\n\nБүтээгдэхүүнүүд:\n${formatProducts(input.products)}`

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
