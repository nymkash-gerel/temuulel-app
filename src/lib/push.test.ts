import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock web-push
const mockSendNotification = vi.fn()
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}))

// Mock supabase client
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockDelete = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

describe('push module', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'test-public-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'test-private-key')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

    mockSendNotification.mockReset()
    mockFrom.mockReset()
    mockSelect.mockReset()
    mockEq.mockReset()
    mockDelete.mockReset()
  })

  it('sends push notification to all subscribed devices', async () => {
    const subscriptions = [
      { endpoint: 'https://push1.com', p256dh: 'key1', auth: 'auth1' },
      { endpoint: 'https://push2.com', p256dh: 'key2', auth: 'auth2' },
    ]

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: subscriptions }),
      }),
    })

    mockSendNotification.mockResolvedValue({})

    // Dynamic import to pick up env mocks
    const { sendPushToUser } = await import('./push')
    await sendPushToUser('user-123', {
      title: 'Test',
      body: 'Hello',
    })

    expect(mockSendNotification).toHaveBeenCalledTimes(2)
  })

  it('does nothing when no subscriptions exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    })

    const { sendPushToUser } = await import('./push')
    await sendPushToUser('user-456', { title: 'Test', body: 'Hello' })

    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('cleans up expired subscriptions on 410 error', async () => {
    const subscriptions = [
      { endpoint: 'https://expired.com', p256dh: 'key1', auth: 'auth1' },
    ]

    const deleteEq2 = vi.fn().mockResolvedValue({})
    const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 })
    const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq1 })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'push_subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: subscriptions }),
          }),
          delete: deleteFn,
        }
      }
      return {}
    })

    const error = { statusCode: 410, message: 'Gone' }
    mockSendNotification.mockRejectedValue(error)

    const { sendPushToUser } = await import('./push')
    await sendPushToUser('user-789', { title: 'Test', body: 'Expired' })

    expect(deleteFn).toHaveBeenCalled()
  })
})
