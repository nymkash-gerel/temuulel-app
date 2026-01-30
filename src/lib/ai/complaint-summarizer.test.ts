import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./openai-client', () => ({
  isOpenAIConfigured: vi.fn(),
  jsonCompletion: vi.fn(),
}))

import { summarizeComplaint } from './complaint-summarizer'
import { isOpenAIConfigured, jsonCompletion } from './openai-client'

describe('summarizeComplaint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when OpenAI is not configured', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(false)
    const result = await summarizeComplaint({ complaint_text: 'Эвдэрсэн бараа ирсэн' })
    expect(result).toBeNull()
    expect(jsonCompletion).not.toHaveBeenCalled()
  })

  it('returns null for empty complaint text', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const result = await summarizeComplaint({ complaint_text: '  ' })
    expect(result).toBeNull()
  })

  it('returns summary on success', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    const mockOutput = {
      summary: 'Бараа эвдэрсэн ирсэн',
      main_issues: ['эвдэрсэн', 'гэмтсэн'],
      sentiment: 'angry' as const,
      action_hint: 'Солих эсвэл буцаах санал тавих',
    }
    vi.mocked(jsonCompletion).mockResolvedValueOnce({
      data: mockOutput,
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
    })

    const result = await summarizeComplaint({ complaint_text: 'Эвдэрсэн бараа ирсэн' })
    expect(result).toEqual(mockOutput)
    expect(jsonCompletion).toHaveBeenCalledOnce()
  })

  it('returns null on API error', async () => {
    vi.mocked(isOpenAIConfigured).mockReturnValue(true)
    vi.mocked(jsonCompletion).mockRejectedValueOnce(new Error('API error'))

    const result = await summarizeComplaint({ complaint_text: 'Муу бараа' })
    expect(result).toBeNull()
  })
})
