import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import type { RecommendationInput, RecommendationOutput, ProductForRecommendation } from './types'

const SYSTEM_PROMPT = `Та монгол ecommerce чатботын борлуулалтын туслах.
Хэрэглэгчийн хайлтад тохирсон бүтээгдэхүүнүүдийг байгалийн хэллэгээр санал болго.
Үнийг ₮ тэмдэгтэйгээр бич. Хариултыг 3-5 өгүүлбэрээр бич.
Зөвхөн өгөгдсөн бүтээгдэхүүнүүдийг санал болго, шинээр зохиож болохгүй.

JSON format:
{ "message": "Монгол хэлээр бичсэн байгалийн хэллэгийн санал" }`

function formatProducts(products: ProductForRecommendation[]): string {
  return products
    .map((p, i) => {
      let line = `${i + 1}. ${p.name} — ${p.base_price}₮`
      if (p.description) line += ` | ${p.description.slice(0, 80)}`
      if (p.sales_script) line += ` | ${p.sales_script}`
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
    const userContent = `Хайлт: ${input.customer_query}\n\nБүтээгдэхүүнүүд:\n${formatProducts(input.products)}`

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
