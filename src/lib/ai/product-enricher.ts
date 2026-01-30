import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import type { ProductEnrichmentInput, ProductEnrichmentOutput } from './types'

const SYSTEM_PROMPT = `Та монгол имэйл худалдааны бүтээгдэхүүний мэдээллийг баяжуулах мэргэжилтэн.

Бүтээгдэхүүний нэр, тайлбар, ангилал, үнэ-г авч дараах JSON-ийг гаргана уу:

{
  "search_aliases": [
    "бүтээгдэхүүний нэрний кирилл хувилбар",
    "latin transliteration",
    "english translation",
    "товчилсон хувилбар",
    "түгээмэл алдаатай бичвэр",
    "digraph хувилбарууд (ts→ц, sh→ш, ch→ч гэх мэт)"
  ],
  "product_faqs": {
    "size_fit": "Хэмжээ, тохиромжийн талаар мэдээлэл (хэрэв хамааралтай бол)",
    "material": "Материал, бүтэц, найрлагын талаар",
    "care": "Арчилгаа, угаалга, хадгалалтын зөвлөгөө",
    "delivery": "Хүргэлтийн ерөнхий мэдээлэл",
    "warranty": "Баталгаа, буцаалт, солилцооны нөхцөл",
    "recommended_for": "Хэнд зориулагдсан, ямар үед тохиромжтой"
  }
}

Чухал зааварууд:
- search_aliases: Бүх боломжит хайлтын үгсийг оруулна. Кирилл, латин, англи, товчлол, алдаатай бичвэр, digraph хувилбарууд.
  Жишээ: "ноолууран цамц" → ["ноолууран цамц", "nooluulan tsamts", "cashmere sweater", "ноолуур цамц", "nooluran tsamts", "цамц", "tsamts", "sweater"]
- product_faqs: Монгол хэлээр бичнэ. ЗӨВХӨН тайлбарт бичигдсэн мэдээлэлд тулгуурлана.
  - size_fit: Зөвхөн тайлбарт тодорхой хэмжээ, см, кг байвал бичнэ. "S-XL байна" гэх мэт тодорхойгүй мэдээллийг БҮҮР бичихгүй — хоосон орхино. Жин/өндрийн зөвлөгөө зохиохгүй.
  - material: Зөвхөн тайлбарт бичсэн материалыг оруулна.
  - care, delivery, warranty: Тайлбарт байвал бичнэ, байхгүй бол хоосон орхино.
  - recommended_for: Тайлбарт тодорхой бичсэн бол оруулна.
  - Мэдэхгүй, тодорхойгүй зүйлийг ЗОХИОХГҮЙ. Хоосон "" орхино.
- Зөвхөн JSON буцаана, нэмэлт тайлбар бичихгүй.`

/**
 * Enrich a product with search aliases and pre-built FAQ answers.
 * Returns null if OpenAI is not configured or if enrichment fails.
 */
export async function enrichProduct(
  input: ProductEnrichmentInput
): Promise<ProductEnrichmentOutput | null> {
  if (!isOpenAIConfigured()) return null
  if (!input.name.trim()) return null

  const userContent = [
    `Нэр: ${input.name}`,
    `Тайлбар: ${input.description || 'байхгүй'}`,
    `Ангилал: ${input.category || 'тодорхойгүй'}`,
    `Үнэ: ${input.base_price}₮`,
  ].join('\n')

  try {
    const result = await jsonCompletion<ProductEnrichmentOutput>({
      systemPrompt: SYSTEM_PROMPT,
      userContent,
      maxTokens: 800,
      temperature: 0.3,
    })

    // Validate and sanitize output
    const data = result.data
    return {
      search_aliases: Array.isArray(data.search_aliases)
        ? data.search_aliases.filter((a) => typeof a === 'string' && a.trim()).map((a) => a.toLowerCase().trim())
        : [],
      product_faqs: data.product_faqs && typeof data.product_faqs === 'object'
        ? data.product_faqs
        : {},
    }
  } catch (error) {
    console.error('[product-enricher] Failed:', error)
    return null
  }
}
