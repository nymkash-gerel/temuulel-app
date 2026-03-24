import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./openai-client', () => ({
  isOpenAIConfigured: vi.fn(),
  chatCompletionJSON: vi.fn(),
}))

import { contextualAIResponse } from './contextual-responder'
import { isOpenAIConfigured, chatCompletionJSON } from './openai-client'
import type { ContextualInput } from './contextual-responder'

function makeInput(overrides: Partial<ContextualInput> = {}): ContextualInput {
  return {
    history: [{ role: 'user', content: 'Сайн байна уу' }, { role: 'assistant', content: 'Сайн байна уу!' }],
    currentMessage: 'Цамц байна уу?',
    intent: 'product_search',
    products: [{ name: 'Цамц', base_price: 45000 }],
    orders: [],
    storeName: 'Тест Дэлгүүр',
    ...overrides,
  }
}

describe('contextualAIResponse (JSON mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when OpenAI is not configured', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(false)
    const result = await contextualAIResponse(makeInput())
    expect(result).toBeNull()
    expect(chatCompletionJSON).not.toHaveBeenCalled()
  })

  it('returns null for non-GPT intents without history', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const result = await contextualAIResponse(makeInput({ history: [], intent: 'product_search' }))
    expect(result).toBeNull()
  })

  it('allows GPT on turn 1 for complaint intent', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: {
        response: 'Маш харамсаж байна.',
        empathy_needed: true,
        confidence: 0.9,
        requires_human_review: true,
        detected_issues: ['complaint'],
      },
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })

    const result = await contextualAIResponse(makeInput({ history: [], intent: 'complaint', currentMessage: 'Бараа муу байна!' }))
    expect(result).not.toBeNull()
    expect(result!.empathy_needed).toBe(true)
    expect(result!.requires_human_review).toBe(true)
    expect(result!.detected_issues).toContain('complaint')
  })

  it('returns null for product_search with no products', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const result = await contextualAIResponse(makeInput({ intent: 'product_search', products: [] }))
    expect(result).toBeNull()
  })

  it('returns null for standalone digit messages (phone/order numbers)', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const result = await contextualAIResponse(makeInput({ currentMessage: '99112233' }))
    expect(result).toBeNull()
  })

  it('returns structured JSON response on success', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const mockResponse = {
      response: 'Тийм! Цамц байна. 45,000₮. Авах уу?',
      empathy_needed: false,
      confidence: 0.95,
      requires_human_review: false,
      detected_issues: [],
    }
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: mockResponse,
      usage: { prompt_tokens: 200, completion_tokens: 60, total_tokens: 260 },
    })

    const result = await contextualAIResponse(makeInput())
    expect(result).toEqual(mockResponse)
    expect(chatCompletionJSON).toHaveBeenCalledOnce()
  })

  it('normalizes missing optional fields with safe defaults', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    // GPT may omit optional fields — our code should fill defaults
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: {
        response: 'Тийм, бараа байна.',
        // empathy_needed, confidence, requires_human_review, detected_issues all missing
      },
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    })

    const result = await contextualAIResponse(makeInput())
    expect(result).not.toBeNull()
    expect(result!.response).toBe('Тийм, бараа байна.')
    expect(result!.empathy_needed).toBe(false)
    expect(result!.confidence).toBe(0.5)
    expect(result!.requires_human_review).toBe(false)
    expect(result!.detected_issues).toEqual([])
  })

  it('returns null when response field is missing from JSON', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: { empathy_needed: false, confidence: 0.5 }, // no response field
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    })

    const result = await contextualAIResponse(makeInput())
    expect(result).toBeNull()
  })

  it('returns null on API error', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(chatCompletionJSON).mockRejectedValueOnce(new Error('rate limit'))

    const result = await contextualAIResponse(makeInput())
    expect(result).toBeNull()
  })

  it('sends JSON mode request with response_format', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: {
        response: 'Хариулт',
        empathy_needed: false,
        confidence: 0.8,
        requires_human_review: false,
        detected_issues: [],
      },
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    })

    await contextualAIResponse(makeInput())

    // Verify chatCompletionJSON was called (which internally uses response_format: json_object)
    expect(chatCompletionJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
        ]),
        maxTokens: 500,
      })
    )
  })

  it('includes JSON schema instructions in system prompt', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: {
        response: 'Test',
        empathy_needed: false,
        confidence: 0.8,
        requires_human_review: false,
        detected_issues: [],
      },
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
    })

    await contextualAIResponse(makeInput())

    const call = vi.mocked(chatCompletionJSON).mock.calls[0][0]
    const systemMsg = call.messages.find(m => m.role === 'system')
    expect(systemMsg?.content).toContain('ХАРИУЛТЫН ФОРМАТ — ЗААВАЛ JSON')
    expect(systemMsg?.content).toContain('"response"')
    expect(systemMsg?.content).toContain('"empathy_needed"')
    expect(systemMsg?.content).toContain('"confidence"')
  })

  it('handles empathy detection for complaint with delivery delay', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(chatCompletionJSON).mockResolvedValueOnce({
      data: {
        response: 'Таны санааг зовсонд уучлаарай. Захиалгын статус шалгая.',
        empathy_needed: true,
        confidence: 0.85,
        requires_human_review: false,
        detected_issues: ['delivery_delay'],
      },
      usage: { prompt_tokens: 150, completion_tokens: 40, total_tokens: 190 },
    })

    const result = await contextualAIResponse(makeInput({
      intent: 'order_status',
      currentMessage: 'Захиалга маань хаана ирсэнгүй',
    }))

    expect(result!.empathy_needed).toBe(true)
    expect(result!.detected_issues).toContain('delivery_delay')
  })
})
