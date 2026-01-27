/**
 * Tests for Messenger platform helpers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { verifyWebhookSignature } from '@/lib/messenger'

describe('verifyWebhookSignature', () => {
  const appSecret = 'test_app_secret_123'
  const payload = JSON.stringify({ object: 'page', entry: [] })

  function generateSignature(body: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
  }

  it('returns true for valid signature', () => {
    const signature = generateSignature(payload, appSecret)
    expect(verifyWebhookSignature(payload, signature, appSecret)).toBe(true)
  })

  it('returns false for invalid signature', () => {
    const badSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000'
    expect(verifyWebhookSignature(payload, badSignature, appSecret)).toBe(false)
  })

  it('returns false for null signature', () => {
    expect(verifyWebhookSignature(payload, null, appSecret)).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const signature = generateSignature(payload, 'wrong_secret')
    expect(verifyWebhookSignature(payload, signature, appSecret)).toBe(false)
  })

  it('returns false for tampered payload', () => {
    const signature = generateSignature(payload, appSecret)
    const tamperedPayload = JSON.stringify({ object: 'page', entry: [{ id: 'hack' }] })
    expect(verifyWebhookSignature(tamperedPayload, signature, appSecret)).toBe(false)
  })
})

describe('sendTextMessage', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('calls Graph API with correct payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123', message_id: 'mid.456' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendTextMessage } = await import('@/lib/messenger')
    const result = await sendTextMessage('123', 'Hello!', 'page_token_abc')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain('/me/messages')
    expect(url).toContain('page_token_abc')

    const body = JSON.parse(options.body)
    expect(body.recipient.id).toBe('123')
    expect(body.message.text).toBe('Hello!')
    expect(result).toEqual({ recipient_id: '123', message_id: 'mid.456' })
  })

  it('splits long messages into chunks', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123', message_id: 'mid.789' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    vi.resetModules()
    const { sendTextMessage } = await import('@/lib/messenger')

    // Create a message longer than 2000 chars
    const longMessage = 'A'.repeat(2500)
    await sendTextMessage('123', longMessage, 'tok')

    // Should have been called multiple times (chunked)
    expect(mockFetch.mock.calls.length).toBeGreaterThan(1)
  })

  it('returns null on API error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    })
    vi.stubGlobal('fetch', mockFetch)

    vi.resetModules()
    const { sendTextMessage } = await import('@/lib/messenger')
    const result = await sendTextMessage('123', 'Hello', 'tok')

    expect(result).toBeNull()
  })
})

describe('sendQuickReplies', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('sends quick replies with correct structure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123', message_id: 'mid.001' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendQuickReplies } = await import('@/lib/messenger')
    await sendQuickReplies(
      '123',
      'Pick one:',
      [
        { title: 'Option A', payload: 'OPT_A' },
        { title: 'Option B', payload: 'OPT_B' },
      ],
      'tok'
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message.text).toBe('Pick one:')
    expect(body.message.quick_replies).toHaveLength(2)
    expect(body.message.quick_replies[0].title).toBe('Option A')
    expect(body.message.quick_replies[0].payload).toBe('OPT_A')
    expect(body.message.quick_replies[0].content_type).toBe('text')
  })

  it('limits quick replies to 13', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123', message_id: 'mid.002' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendQuickReplies } = await import('@/lib/messenger')
    const manyReplies = Array.from({ length: 20 }, (_, i) => ({
      title: `Opt ${i}`,
      payload: `OPT_${i}`,
    }))

    await sendQuickReplies('123', 'Pick:', manyReplies, 'tok')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message.quick_replies).toHaveLength(13)
  })
})

describe('sendProductCards', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('sends generic template with product elements', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123', message_id: 'mid.003' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendProductCards } = await import('@/lib/messenger')
    await sendProductCards(
      '123',
      [
        { title: 'Product 1', subtitle: '50,000₮', imageUrl: 'https://img.com/1.jpg' },
        { title: 'Product 2', subtitle: '30,000₮' },
      ],
      'tok'
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message.attachment.type).toBe('template')
    expect(body.message.attachment.payload.template_type).toBe('generic')
    expect(body.message.attachment.payload.elements).toHaveLength(2)
    expect(body.message.attachment.payload.elements[0].image_url).toBe('https://img.com/1.jpg')
  })

  it('limits elements to 10', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123', message_id: 'mid.004' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendProductCards } = await import('@/lib/messenger')
    const manyProducts = Array.from({ length: 15 }, (_, i) => ({
      title: `Product ${i}`,
      subtitle: `${i * 1000}₮`,
    }))

    await sendProductCards('123', manyProducts, 'tok')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.message.attachment.payload.elements).toHaveLength(10)
  })
})

describe('sendTypingIndicator', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('sends typing_on action', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendTypingIndicator } = await import('@/lib/messenger')
    await sendTypingIndicator('123', true, 'tok')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.sender_action).toBe('typing_on')
    expect(body.recipient.id).toBe('123')
  })

  it('sends typing_off action', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recipient_id: '123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendTypingIndicator } = await import('@/lib/messenger')
    await sendTypingIndicator('123', false, 'tok')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.sender_action).toBe('typing_off')
  })
})
