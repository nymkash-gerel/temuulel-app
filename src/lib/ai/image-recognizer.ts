/**
 * Image Recognition Module
 * Identifies products in customer-sent images using GPT-4o Vision
 */

import { visionCompletion } from './openai-client'
import { optimizeImageUrl } from './image-optimizer'

export interface ImageRecognitionResult {
  productName: string
  description: string
  category: string
  searchKeywords: string[]
}

const VISION_SYSTEM_PROMPT = `Та бүтээгдэхүүн таних мэргэжилтэн. Хэрэглэгч зураг илгээхэд бүтээгдэхүүнийг тодорхойлно.

JSON хэлбэрээр хариулна:
{
  "product_name": "Бүтээгдэхүүний нэр (Монгол хэлээр)",
  "description": "Богино тодорхойлолт",
  "category": "bags|shoes|clothing|accessories|electronics|home|beauty|toys|food|other",
  "search_keywords": ["хайлтын", "түлхүүр", "үгс"]
}

Заавар:
- Бренд нэрийг оруулна (Nike, Adidas, Samsung гэх мэт)
- Өнгийг тодорхойлно
- Хэмжээг таамаглахгүй
- search_keywords нь Монгол + English хоёуланг агуулна
- Хэрэв бүтээгдэхүүн биш бол: {"product_name": "unknown", "search_keywords": []}`

/**
 * Recognize product in a customer-sent image.
 * Returns search keywords for matching against store catalog.
 */
export async function recognizeProductImage(imageUrl: string): Promise<ImageRecognitionResult | null> {
  try {
    let result
    try {
      // First attempt — optimized URL
      result = await visionCompletion(
        VISION_SYSTEM_PROMPT,
        optimizeImageUrl(imageUrl),
        'Энэ зурган дээр ямар бүтээгдэхүүн байна вэ?'
      )
    } catch (firstErr) {
      // Fallback: retry with original URL (in case CDN rewrite broke something)
      console.warn('[image-recognizer] First attempt failed, retrying with original URL:', firstErr)
      result = await visionCompletion(
        VISION_SYSTEM_PROMPT,
        imageUrl,
        'Энэ зурган дээр ямар бүтээгдэхүүн байна вэ?'
      )
    }

    const parsed = JSON.parse(result.content) as {
      product_name: string
      description?: string
      category?: string
      search_keywords?: string[]
    }

    if (!parsed.product_name || parsed.product_name === 'unknown') {
      return null
    }

    return {
      productName: parsed.product_name,
      description: parsed.description || '',
      category: parsed.category || 'other',
      searchKeywords: parsed.search_keywords || [parsed.product_name],
    }
  } catch (err) {
    console.error('[image-recognizer] Failed:', err)
    return null
  }
}
