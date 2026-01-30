import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./openai-client', () => ({
  isOpenAIConfigured: vi.fn(),
  jsonCompletion: vi.fn(),
}))

import { writeRecommendation } from './recommendation-writer'
import { isOpenAIConfigured, jsonCompletion } from './openai-client'

const MOCK_PRODUCTS = [
  { name: 'Цамц', description: 'Хөнгөн цамц', base_price: 45000, sales_script: null },
  { name: 'Гутал', description: 'Арьсан гутал', base_price: 120000, sales_script: 'Шилдэг борлуулалт' },
]

describe('writeRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when OpenAI is not configured', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(false)
    const result = await writeRecommendation({ products: MOCK_PRODUCTS, customer_query: 'хувцас' })
    expect(result).toBeNull()
    expect(jsonCompletion).not.toHaveBeenCalled()
  })

  it('returns null for empty products', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const result = await writeRecommendation({ products: [], customer_query: 'хувцас' })
    expect(result).toBeNull()
  })

  it('returns recommendation on success', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const mockOutput = {
      message: 'Танд 2 бүтээгдэхүүн санал болгож байна: Цамц 45,000₮ болон Арьсан гутал 120,000₮.',
    }
    vi.mocked(jsonCompletion).mockResolvedValueOnce({
      data: mockOutput,
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
    })

    const result = await writeRecommendation({ products: MOCK_PRODUCTS, customer_query: 'хувцас гутал' })
    expect(result).toEqual(mockOutput)
    expect(jsonCompletion).toHaveBeenCalledOnce()
  })

  it('returns null on API error', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(jsonCompletion).mockRejectedValueOnce(new Error('timeout'))

    const result = await writeRecommendation({ products: MOCK_PRODUCTS, customer_query: 'test' })
    expect(result).toBeNull()
  })
})
