/**
 * Auto-tagging and sentiment analysis for customer messages.
 *
 * Two tiers:
 * 1. AI-powered via jsonCompletion (when OpenAI configured)
 * 2. Keyword-based fallback (always works, deterministic)
 */

import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import { normalizeText } from '../chat-ai'
import type { MessageTagOutput } from './types'

// ---------------------------------------------------------------------------
// AI tier
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Та монгол хэлний мессежийн шинжилгээ хийдэг мэргэжилтэн.
Хэрэглэгчийн мессежийг шинжлэн сэтгэл хөдлөл болон товч түлхүүр үгс гаргана.

JSON format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "tags": ["таг1", "таг2"]
}

Зарчим:
- sentiment: мессежийн сэтгэл хөдлөлийг тодорхойл
- tags: 1-3 товч монгол түлхүүр үг (бүтээгдэхүүн, үнэ, хүргэлт, буцаалт, захиалга, гомдол, талархал гэх мэт)
- Зөвхөн өгөгдсөн мессежид байгаа мэдээлэлд тулгуурлана`

export async function analyzeMessage(
  text: string
): Promise<MessageTagOutput | null> {
  if (!isOpenAIConfigured()) return null
  if (!text.trim()) return null

  try {
    const result = await jsonCompletion<MessageTagOutput>({
      systemPrompt: SYSTEM_PROMPT,
      userContent: text,
      maxTokens: 150,
    })
    return result.data
  } catch (error) {
    console.error('[message-tagger] Failed:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Keyword fallback
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = [
  'баярлалаа', 'гайхалтай', 'сайн', 'маш сайн', 'рахмат',
  'гоё', 'зөв', 'таалагдсан', 'сайхан', 'амжилт',
  'дуртай', 'тэгье', 'баяртай', 'гоё байна',
]

const NEGATIVE_WORDS = [
  'гомдол', 'муу', 'буруу', 'алдаа', 'асуудал',
  'чанаргүй', 'эвдэрсэн', 'хуурамч', 'уурласан',
  'бухимдсан', 'гомдсон', 'удааширсан', 'хариугүй',
  'ойлгохгүй', 'тааруу',
]

const TAG_MAP: Record<string, string[]> = {
  'бүтээгдэхүүн': ['бараа', 'бүтээгдэхүүн', 'хувцас', 'гутал', 'цүнх', 'цамц', 'өмд', 'малгай'],
  'үнэ': ['үнэ', 'төлбөр', 'хямд', 'үнэтэй', 'хямдрал', 'хэд'],
  'хүргэлт': ['хүргэлт', 'илгээх', 'хаана', 'хэзээ', 'шуудан', 'хүргэх'],
  'буцаалт': ['буцаах', 'солих', 'буцаалт', 'солилцох'],
  'захиалга': ['захиалга', 'статус', 'трэк', 'захиалах', 'авах'],
  'гомдол': ['гомдол', 'асуудал', 'муу', 'буруу', 'алдаа', 'эвдэрсэн'],
  'талархал': ['баярлалаа', 'рахмат', 'гайхалтай', 'сайн'],
  'размер': ['размер', 'хэмжээ', 'том', 'жижиг', 'дунд'],
  'төлбөр': ['төлбөр', 'төлөх', 'qpay', 'карт', 'данс', 'шилжүүлэх'],
}

export function analyzeMessageKeyword(text: string): MessageTagOutput {
  const normalized = normalizeText(text)
  const padded = ` ${normalized} `

  // Sentiment
  let posCount = 0
  let negCount = 0

  for (const word of POSITIVE_WORDS) {
    if (padded.includes(` ${normalizeText(word)} `)) posCount++
  }
  for (const word of NEGATIVE_WORDS) {
    if (padded.includes(` ${normalizeText(word)} `)) negCount++
  }

  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'
  if (negCount > posCount) sentiment = 'negative'
  else if (posCount > negCount && posCount > 0) sentiment = 'positive'

  // Tags
  const tags: string[] = []
  for (const [tag, keywords] of Object.entries(TAG_MAP)) {
    for (const kw of keywords) {
      if (padded.includes(` ${normalizeText(kw)} `)) {
        tags.push(tag)
        break
      }
    }
  }

  return { sentiment, tags: tags.slice(0, 3) }
}
