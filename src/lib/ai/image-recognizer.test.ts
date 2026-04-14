import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the openai-client BEFORE importing image-recognizer
vi.mock('./openai-client', () => ({
  visionCompletion: vi.fn(),
}))

import { recognizeProductImage } from './image-recognizer'
import * as openai from './openai-client'

describe('image-recognizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for unknown products', async () => {
    vi.mocked(openai.visionCompletion).mockResolvedValue({
      content: JSON.stringify({ product_name: 'unknown', search_keywords: [] }),
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    })

    const result = await recognizeProductImage('https://example.com/img.jpg')
    expect(result).toBeNull()
  })

  it('returns product details with search keywords', async () => {
    vi.mocked(openai.visionCompletion).mockResolvedValue({
      content: JSON.stringify({
        product_name: 'Nike Air Max',
        description: 'Хар пүүз',
        category: 'shoes',
        search_keywords: ['Nike', 'Air Max', 'пүүз', 'shoes'],
      }),
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    })

    const result = await recognizeProductImage('https://example.com/shoe.jpg')
    expect(result).not.toBeNull()
    expect(result?.productName).toBe('Nike Air Max')
    expect(result?.category).toBe('shoes')
    expect(result?.searchKeywords).toContain('Nike')
    expect(result?.searchKeywords).toContain('пүүз')
  })

  it('returns null on API error', async () => {
    vi.mocked(openai.visionCompletion).mockRejectedValue(new Error('API error'))

    const result = await recognizeProductImage('https://example.com/img.jpg')
    expect(result).toBeNull()
  })

  it('handles missing search_keywords gracefully', async () => {
    vi.mocked(openai.visionCompletion).mockResolvedValue({
      content: JSON.stringify({ product_name: 'Шүдний сойз' }),
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    })

    const result = await recognizeProductImage('https://example.com/img.jpg')
    expect(result?.searchKeywords).toEqual(['Шүдний сойз'])
  })

  it('handles malformed JSON response', async () => {
    vi.mocked(openai.visionCompletion).mockResolvedValue({
      content: 'not valid json',
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    })

    const result = await recognizeProductImage('https://example.com/img.jpg')
    expect(result).toBeNull()
  })
})
