/**
 * Tests for the SMS notification library.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('sendSMS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('logs to console in dev mode (no SMS_API_URL)', async () => {
    vi.stubEnv('SMS_API_URL', '')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { sendSMS } = await import('./sms')
    const result = await sendSMS('99112233', 'Тест мессеж')

    expect(result.success).toBe(true)
    expect(result.messageId).toMatch(/^dev-/)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('99112233'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Тест мессеж'))
  })

  it('calls external API when SMS_API_URL is set', async () => {
    vi.stubEnv('SMS_API_URL', 'https://sms.example.com/send')
    vi.stubEnv('SMS_API_KEY', 'test-key-123')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message_id: 'msg_001' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendSMS } = await import('./sms')
    const result = await sendSMS('99112233', 'Hello')

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('msg_001')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://sms.example.com/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key-123',
        }),
      })
    )
  })

  it('returns error when API call fails', async () => {
    vi.stubEnv('SMS_API_URL', 'https://sms.example.com/send')
    vi.stubEnv('SMS_API_KEY', 'test-key')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendSMS } = await import('./sms')
    const result = await sendSMS('99112233', 'Hello')

    expect(result.success).toBe(false)
    expect(result.error).toContain('500')
  })

  it('handles network errors', async () => {
    vi.stubEnv('SMS_API_URL', 'https://sms.example.com/send')

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { sendSMS } = await import('./sms')
    const result = await sendSMS('99112233', 'Hello')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('sendDeliveryTrackingSMS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('formats tracking SMS with customer name', async () => {
    vi.stubEnv('SMS_API_URL', '')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { sendDeliveryTrackingSMS } = await import('./sms')
    const result = await sendDeliveryTrackingSMS('99112233', 'DEL-12345', 'Болд')

    expect(result.success).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Болд'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DEL-12345'))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/track/DEL-12345'))
  })

  it('formats tracking SMS without customer name', async () => {
    vi.stubEnv('SMS_API_URL', '')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { sendDeliveryTrackingSMS } = await import('./sms')
    const result = await sendDeliveryTrackingSMS('99112233', 'DEL-99999', null)

    expect(result.success).toBe(true)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DEL-99999'))
  })
})
