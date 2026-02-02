import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import type { ComplaintClassificationInput, ComplaintClassificationOutput } from './types'

const SYSTEM_PROMPT = `Та монгол хэлний гомдлыг ангилах мэргэжилтэн.
Хэрэглэгчийн гомдлыг дараах ангиллуудын аль нэгэнд хамааруулна уу:

- food_quality: Хоолны чанар (хүйтэн, түүхий, амтгүй, чанаргүй хоол)
- wrong_item: Буруу бараа (буруу захиалга, андуурсан, өөр зүйл)
- delivery_delay: Хүргэлт удсан (удсан, хоцорсон, ирээгүй, хүлээсэн)
- service_quality: Үйлчилгээний чанар (муу үйлчилгээ, хайхрамжгүй)
- damaged_item: Гэмтэлтэй бараа (эвдэрсэн, гэмтсэн, хугарсан)
- pricing_error: Үнийн алдаа (буруу үнэ, илүү авсан, давхар)
- staff_behavior: Ажилтны зан (бүдүүлэг, хүндэтгэлгүй)
- other: Бусад (дээрх ангилалд багтахгүй)

JSON format:
{
  "category": "ангиллын нэр",
  "confidence": 0.0-1.0,
  "suggested_response": "Монгол хэл дээрх уучлалын хариу (нөхөн олговор амлахгүй)"
}

Зөвхөн өгөгдсөн мессежинд тулгуурлана. suggested_response нь уучлал гуйж, асуудлыг хүлээн зөвшөөрсөн хариу байна — нөхөн олговор, хөнгөлөлт амлахгүй.`

export async function classifyComplaint(
  input: ComplaintClassificationInput
): Promise<ComplaintClassificationOutput | null> {
  if (!isOpenAIConfigured()) return null
  if (!input.complaint_text.trim()) return null

  try {
    const result = await jsonCompletion<ComplaintClassificationOutput>({
      systemPrompt: SYSTEM_PROMPT,
      userContent: input.complaint_text,
      maxTokens: 300,
    })
    return result.data
  } catch (error) {
    console.error('[complaint-classifier] Failed:', error)
    return null
  }
}
