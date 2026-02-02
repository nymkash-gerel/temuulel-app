import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock openai-client
vi.mock('./openai-client', () => ({
  isOpenAIConfigured: vi.fn(),
  jsonCompletion: vi.fn(),
}))

import { classifyComplaint } from './complaint-classifier'
import { isOpenAIConfigured, jsonCompletion } from './openai-client'

const mockIsConfigured = vi.mocked(isOpenAIConfigured)
const mockJsonCompletion = vi.mocked(jsonCompletion)

describe('classifyComplaint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when OpenAI is not configured', async () => {
    mockIsConfigured.mockReturnValue(false)
    const result = await classifyComplaint({ complaint_text: 'Хоол хүйтэн байна' })
    expect(result).toBeNull()
    expect(mockJsonCompletion).not.toHaveBeenCalled()
  })

  it('returns null for empty complaint text', async () => {
    mockIsConfigured.mockReturnValue(true)
    const result = await classifyComplaint({ complaint_text: '  ' })
    expect(result).toBeNull()
  })

  it('classifies food quality complaint correctly', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: 'food_quality',
        confidence: 0.95,
        suggested_response: 'Уучлаарай, хоолны чанарын талаар таны гомдлыг хүлээн авлаа.',
      },
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })

    const result = await classifyComplaint({
      complaint_text: 'Хоол маш хүйтэн ирсэн, 30 минут хүлээсэн',
    })

    expect(result).toEqual({
      category: 'food_quality',
      confidence: 0.95,
      suggested_response: 'Уучлаарай, хоолны чанарын талаар таны гомдлыг хүлээн авлаа.',
    })
  })

  it('classifies wrong item complaint', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: 'wrong_item',
        confidence: 0.9,
        suggested_response: 'Уучлаарай, буруу бараа илгээсэн байна.',
      },
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
    })

    const result = await classifyComplaint({
      complaint_text: 'Латте захиалсан байсан чинь американо ирсэн',
    })

    expect(result?.category).toBe('wrong_item')
    expect(result?.confidence).toBeGreaterThan(0.5)
  })

  it('classifies delivery delay complaint', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: 'delivery_delay',
        confidence: 0.88,
        suggested_response: 'Хүргэлт удааширсан талаар уучлаарай.',
      },
      usage: { prompt_tokens: 90, completion_tokens: 45, total_tokens: 135 },
    })

    const result = await classifyComplaint({
      complaint_text: 'Хүргэлт 2 цаг болсон ирэхгүй байна',
    })

    expect(result?.category).toBe('delivery_delay')
  })

  it('returns null on API error', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockJsonCompletion.mockRejectedValue(new Error('API error'))

    const result = await classifyComplaint({
      complaint_text: 'Хоол хүйтэн ирсэн',
    })

    expect(result).toBeNull()
  })

  it('classifies damaged item complaint', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: 'damaged_item',
        confidence: 0.92,
        suggested_response: 'Гэмтэлтэй бараа хүлээн авсан талаар уучлаарай.',
      },
      usage: { prompt_tokens: 85, completion_tokens: 42, total_tokens: 127 },
    })

    const result = await classifyComplaint({
      complaint_text: 'Хайрцаг нь эвдэрсэн, бараа бүхэлдээ гэмтсэн байна',
    })

    expect(result?.category).toBe('damaged_item')
  })

  it('classifies staff behavior complaint', async () => {
    mockIsConfigured.mockReturnValue(true)
    mockJsonCompletion.mockResolvedValue({
      data: {
        category: 'staff_behavior',
        confidence: 0.85,
        suggested_response: 'Ажилтны зан байдлын талаар уучлаарай.',
      },
      usage: { prompt_tokens: 88, completion_tokens: 44, total_tokens: 132 },
    })

    const result = await classifyComplaint({
      complaint_text: 'Зөөгч маш бүдүүлэг хандсан',
    })

    expect(result?.category).toBe('staff_behavior')
  })
})
