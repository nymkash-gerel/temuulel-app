import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./openai-client', () => ({
  isOpenAIConfigured: vi.fn(),
  jsonCompletion: vi.fn(),
}))

import { generateInsights } from './analytics-insight'
import { isOpenAIConfigured, jsonCompletion } from './openai-client'
import type { AnalyticsStats } from './types'

const SAMPLE_STATS: AnalyticsStats = {
  period: '30d',
  revenue: 5000000,
  revenueChange: 23,
  orderCount: 45,
  avgOrderValue: 111111,
  newCustomers: 12,
  totalCustomers: 80,
  topProducts: [
    { name: 'Хар гутал', quantity: 20, revenue: 1780000 },
    { name: 'Цагаан цамц', quantity: 15, revenue: 525000 },
  ],
  aiResponseRate: 78,
  totalMessages: 340,
  pendingOrders: 5,
  cancelledOrders: 2,
}

describe('generateInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when OpenAI is not configured', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(false)
    const result = await generateInsights(SAMPLE_STATS)
    expect(result).toBeNull()
    expect(jsonCompletion).not.toHaveBeenCalled()
  })

  it('returns null for zero-data stats', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const result = await generateInsights({
      ...SAMPLE_STATS,
      revenue: 0,
      orderCount: 0,
      totalMessages: 0,
    })
    expect(result).toBeNull()
  })

  it('returns insights on success', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const mockOutput = {
      insights: [
        'Орлого өмнөх 30 хоногоос 23% өссөн',
        '"Хар гутал" хамгийн их зарагдсан бүтээгдэхүүн (20 ширхэг)',
      ],
      tone: 'positive' as const,
    }
    vi.mocked(jsonCompletion).mockResolvedValueOnce({
      data: mockOutput,
      usage: { prompt_tokens: 80, completion_tokens: 60, total_tokens: 140 },
    })

    const result = await generateInsights(SAMPLE_STATS)
    expect(result).toEqual(mockOutput)
    expect(jsonCompletion).toHaveBeenCalledOnce()
  })

  it('returns null on API error', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(jsonCompletion).mockRejectedValueOnce(new Error('API error'))

    const result = await generateInsights(SAMPLE_STATS)
    expect(result).toBeNull()
  })
})
