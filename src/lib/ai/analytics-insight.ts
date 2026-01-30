/**
 * AnalyticsInsightGenerator — summarizes store metrics in natural language.
 * Returns 3-5 Mongolian bullet points highlighting trends, top products, anomalies.
 */

import { jsonCompletion, isOpenAIConfigured } from './openai-client'
import type { AnalyticsStats, InsightOutput } from './types'

const SYSTEM_PROMPT = `Та ecommerce дэлгүүрийн бизнес шинжээч.
Өгөгдсөн тоон мэдээлэлд тулгуурлан 3-5 товч дүгнэлт бичнэ.
Дүгнэлт бүр нэг өгүүлбэр, тодорхой тоон мэдээлэлтэй байна.
Зөвхөн өгөгдсөн тоонуудад тулгуурлана — зохиож болохгүй.
Үнийг ₮ тэмдэгтэйгээр бич. Хувийг % тэмдэгтэйгээр бич.

Хэрэв сөрөг чиг хандлага, анхаарал шаардах зүйл байвал tone-г "warning" гэж тэмдэглэ.
Эерэг чиг хандлага байвал "positive", бусад тохиолдолд "neutral".

JSON format:
{
  "insights": ["дүгнэлт 1", "дүгнэлт 2", ...],
  "tone": "positive" | "neutral" | "warning"
}`

function formatStatsForPrompt(stats: AnalyticsStats): string {
  const periodLabel: Record<string, string> = {
    '7d': 'Сүүлийн 7 хоног',
    '30d': 'Сүүлийн 30 хоног',
    '90d': 'Сүүлийн 90 хоног',
    '1y': 'Сүүлийн жил',
  }

  let text = `Хугацаа: ${periodLabel[stats.period] || stats.period}\n`
  text += `Нийт орлого: ${stats.revenue}₮\n`
  text += `Орлогын өөрчлөлт: ${stats.revenueChange}% (өмнөх үеэс)\n`
  text += `Захиалгын тоо: ${stats.orderCount}\n`
  text += `Дундаж захиалга: ${stats.avgOrderValue}₮\n`
  text += `Шинэ харилцагч: ${stats.newCustomers}\n`
  text += `Нийт харилцагч: ${stats.totalCustomers}\n`
  text += `Хүлээгдэж буй захиалга: ${stats.pendingOrders}\n`
  text += `Цуцлагдсан захиалга: ${stats.cancelledOrders}\n`
  text += `AI хариултын хувь: ${stats.aiResponseRate}%\n`
  text += `Нийт мессеж: ${stats.totalMessages}\n`

  if (stats.topProducts.length > 0) {
    text += '\nШилдэг бүтээгдэхүүн:\n'
    stats.topProducts.forEach((p, i) => {
      text += `${i + 1}. ${p.name} — ${p.quantity} ширхэг — ${p.revenue}₮\n`
    })
  }

  return text
}

/**
 * Generate AI-powered insights from analytics stats.
 * Returns null if OpenAI is not configured, data is empty, or on error.
 */
export async function generateInsights(
  stats: AnalyticsStats
): Promise<InsightOutput | null> {
  if (!isOpenAIConfigured()) return null
  if (stats.revenue === 0 && stats.orderCount === 0 && stats.totalMessages === 0) return null

  try {
    const result = await jsonCompletion<InsightOutput>({
      systemPrompt: SYSTEM_PROMPT,
      userContent: formatStatsForPrompt(stats),
      maxTokens: 400,
    })
    return result.data
  } catch (error) {
    console.error('[analytics-insight] Failed:', error)
    return null
  }
}
