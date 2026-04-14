import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit tests for visionCompletion and transcribeAudio.
 * Mock the OpenAI SDK and fetch globally.
 */

// Mock fetch for audio download
global.fetch = vi.fn()

// Mock OpenAI SDK
const mockChatCreate = vi.fn()
const mockTranscribe = vi.fn()

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } }
    audio = { transcriptions: { create: mockTranscribe } }
  },
}))

vi.mock('@/lib/sentry-helpers', () => ({
  withSpan: (_name: string, _op: string, cb: () => Promise<unknown>) => cb(),
}))

vi.mock('./circuit-breaker', () => ({
  withCircuitBreaker: (cb: () => Promise<unknown>) => cb(),
  CircuitOpenError: class extends Error {},
}))

// Provide File globally (Node 18+ has it, but fallback)
if (typeof File === 'undefined') {
  // @ts-expect-error polyfill for test
  global.File = class File {
    constructor(public parts: unknown[], public name: string, public opts: unknown) {}
  }
}

import { visionCompletion, transcribeAudio } from './openai-client'

describe('visionCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('returns JSON content from GPT-4o vision', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: '{"product_name":"Nike","search_keywords":["shoe"]}' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    })

    const result = await visionCompletion('analyze image', 'https://img.url/shoe.jpg')
    expect(result.content).toContain('Nike')
    expect(result.usage.total_tokens).toBe(150)
  })

  it('includes image_url in messages', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    })

    await visionCompletion('sys', 'https://example.com/img.jpg')

    expect(mockChatCreate).toHaveBeenCalled()
    const call = mockChatCreate.mock.calls[0][0]
    expect(call.model).toBe('gpt-4o')
    expect(call.response_format).toEqual({ type: 'json_object' })
    // Check image_url is in the user content
    const userMsg = call.messages.find((m: { role: string }) => m.role === 'user')
    const hasImage = userMsg.content.some((c: { type: string; image_url?: unknown }) => c.type === 'image_url')
    expect(hasImage).toBe(true)
  })

  it('throws on empty response', async () => {
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    })

    await expect(visionCompletion('sys', 'url')).rejects.toThrow(/Empty vision response/)
  })
})

describe('transcribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('downloads audio and sends to Whisper API', async () => {
    // Mock fetch returning audio bytes
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    })

    mockTranscribe.mockResolvedValue({ text: 'Сайн байна уу' })

    const result = await transcribeAudio('https://cdn.fb.com/audio.mp4')
    expect(result.text).toBe('Сайн байна уу')
    expect(global.fetch).toHaveBeenCalledWith('https://cdn.fb.com/audio.mp4')
    expect(mockTranscribe).toHaveBeenCalled()
  })

  it('uses whisper-1 model without language hint (mn not supported, auto-detects)', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    })
    mockTranscribe.mockResolvedValue({ text: 'test' })

    await transcribeAudio('https://cdn.fb.com/audio.mp4')

    const call = mockTranscribe.mock.calls[0][0]
    expect(call.model).toBe('whisper-1')
    // language should NOT be 'mn' — Whisper doesn't support it
    expect(call.language).toBeUndefined()
  })

  it('throws when audio download fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 })

    await expect(transcribeAudio('https://bad.url')).rejects.toThrow(/Failed to download audio: 404/)
  })
})
