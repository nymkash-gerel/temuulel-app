/**
 * Tests for the central notification dispatcher
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Supabase
 
const mockFrom: any = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

// Mock email
vi.mock('./email', () => ({
  sendOrderEmail: vi.fn().mockResolvedValue(true),
  sendMessageEmail: vi.fn().mockResolvedValue(true),
  sendLowStockEmail: vi.fn().mockResolvedValue(true),
}))

// Mock push
vi.mock('./push', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}))

// Mock webhook
vi.mock('./webhook', () => ({
  dispatchWebhook: vi.fn().mockResolvedValue(true),
}))

import { sendOrderEmail, sendMessageEmail, sendLowStockEmail } from './email'
import { sendPushToUser } from './push'
import { dispatchWebhook } from './webhook'

describe('dispatchNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')

    // Reset mock implementations
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { owner_id: 'owner_1' } }),
            })),
          })),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  email: 'owner@test.com',
                  notification_settings: {
                    email_new_order: true,
                    email_new_message: true,
                    email_low_stock: true,
                  },
                },
              }),
            })),
          })),
        }
      }
      if (table === 'notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches new_order notification with email', async () => {
    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'new_order', {
      order_id: 'ord_1',
      order_number: 'ORD-001',
      total_amount: 50000,
      payment_method: 'qpay',
    })

    expect(sendOrderEmail).toHaveBeenCalledWith('owner@test.com', {
      order_number: 'ORD-001',
      total_amount: 50000,
      payment_method: 'qpay',
    })
  })

  it('dispatches new_message notification with email', async () => {
    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'new_message', {
      customer_name: 'Болд',
      message: 'Сайн байна уу',
      channel: 'web',
    })

    expect(sendMessageEmail).toHaveBeenCalledWith('owner@test.com', 'Болд', 'Сайн байна уу')
  })

  it('dispatches low_stock notification with email', async () => {
    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'low_stock', {
      product_name: 'Цамц',
      remaining: 3,
      variant_id: 'var_1',
      product_id: 'prod_1',
    })

    expect(sendLowStockEmail).toHaveBeenCalledWith('owner@test.com', 'Цамц', 3)
  })

  it('dispatches webhook for all events', async () => {
    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'new_order', {
      order_id: 'ord_1',
      order_number: 'ORD-001',
      total_amount: 50000,
    })

    expect(dispatchWebhook).toHaveBeenCalledWith(
      'store_1',
      'new_order',
      expect.objectContaining({ order_id: 'ord_1' })
    )
  })

  it('skips email when settings are disabled', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { owner_id: 'owner_1' } }),
            })),
          })),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  email: 'owner@test.com',
                  notification_settings: {
                    email_new_order: false,
                    email_new_message: false,
                    email_low_stock: false,
                  },
                },
              }),
            })),
          })),
        }
      }
      if (table === 'notifications') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    })

    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'new_order', {
      order_number: 'ORD-002',
      total_amount: 30000,
    })

    expect(sendOrderEmail).not.toHaveBeenCalled()
  })

  it('sends push notification when push_new_order is enabled', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { owner_id: 'owner_1' } }),
            })),
          })),
        }
      }
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  email: 'owner@test.com',
                  notification_settings: {
                    email_new_order: false,
                    push_new_order: true,
                  },
                },
              }),
            })),
          })),
        }
      }
      if (table === 'notifications') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return {}
    })

    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'new_order', {
      order_number: 'ORD-PUSH',
      total_amount: 25000,
    })

    expect(sendPushToUser).toHaveBeenCalledWith('owner_1', {
      title: expect.stringContaining('ORD-PUSH'),
      body: expect.any(String),
      url: '/dashboard/orders',
      tag: 'temuulel-new_order',
    })
  })

  it('skips push when push setting is disabled', async () => {
    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'new_order', {
      order_number: 'ORD-NOPUSH',
      total_amount: 10000,
    })

    // Default mock has no push_* settings → push is disabled
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('dispatches order_status notification', async () => {
    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('store_1', 'order_status', {
      order_id: 'ord_1',
      order_number: 'ORD-STATUS',
      previous_status: 'pending',
      new_status: 'confirmed',
    })

    // Should save in-app notification (webhook dispatch)
    expect(dispatchWebhook).toHaveBeenCalledWith(
      'store_1',
      'order_status',
      expect.objectContaining({ order_number: 'ORD-STATUS' })
    )
  })

  it('skips everything when store not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null }),
            })),
          })),
        }
      }
      return {}
    })

    const { dispatchNotification } = await import('./notifications')

    await dispatchNotification('nonexistent', 'new_order', {})

    expect(sendOrderEmail).not.toHaveBeenCalled()
    expect(dispatchWebhook).not.toHaveBeenCalled()
  })
})

describe('buildNotificationContent', () => {
  it('builds new_order content correctly', () => {
    const content = buildContent('new_order', {
      order_number: 'ORD-100',
      total_amount: 99000,
    })

    expect(content.title).toContain('ORD-100')
    expect(content.body).toContain('99,000')
  })

  it('builds new_message content with truncation', () => {
    const longMessage = 'A'.repeat(150)
    const content = buildContent('new_message', {
      customer_name: 'Тест',
      message: longMessage,
    })

    expect(content.title).toContain('Тест')
    expect(content.body.length).toBeLessThanOrEqual(104) // 100 chars + '...'
  })

  it('builds low_stock content correctly', () => {
    const content = buildContent('low_stock', {
      product_name: 'Цамц XL',
      remaining: 2,
    })

    expect(content.title).toContain('Цамц XL')
    expect(content.body).toContain('2')
  })

  it('builds new_customer content correctly', () => {
    const content = buildContent('new_customer', {
      name: 'Дорж',
      channel: 'messenger',
    })

    expect(content.title).toBe('Шинэ харилцагч')
    expect(content.body).toContain('Дорж')
    expect(content.body).toContain('messenger')
  })

  it('builds order_status content correctly', () => {
    const content = buildContent('order_status', {
      order_number: 'ORD-200',
      previous_status: 'pending',
      new_status: 'shipped',
    })

    expect(content.title).toContain('ORD-200')
    expect(content.body).toContain('Хүлээгдэж буй')
    expect(content.body).toContain('Илгээсэн')
  })

  it('handles missing data gracefully', () => {
    const content = buildContent('new_order', {})
    expect(content.title).toContain('Шинэ захиалга')
    expect(content.body).toBeDefined()
  })
})

/**
 * Helper to test buildNotificationContent logic directly
 * (mirrors the private function in notifications.ts)
 */
const STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж буй',
  shipped: 'Илгээсэн',
  delivered: 'Хүргэсэн',
  cancelled: 'Цуцлагдсан',
}

function buildContent(
  event: 'new_order' | 'new_message' | 'new_customer' | 'low_stock' | 'order_status',
  data: Record<string, unknown>
) {
  switch (event) {
    case 'new_order':
      return {
        title: `Шинэ захиалга #${data.order_number || ''}`,
        body: `Нийт: ${data.total_amount ? new Intl.NumberFormat('mn-MN').format(data.total_amount as number) + '₮' : ''}`,
      }
    case 'new_message':
      return {
        title: `Шинэ мессеж: ${data.customer_name || 'Харилцагч'}`,
        body: typeof data.message === 'string'
          ? (data.message.length > 100 ? data.message.slice(0, 100) + '...' : data.message)
          : '',
      }
    case 'new_customer':
      return {
        title: 'Шинэ харилцагч',
        body: `${data.name || 'Нэргүй'} — ${data.channel || 'web'}`,
      }
    case 'low_stock':
      return {
        title: `Нөөц дуусаж байна: ${data.product_name || ''}`,
        body: `Үлдэгдэл: ${data.remaining ?? 0} ширхэг`,
      }
    case 'order_status':
      return {
        title: `Захиалга #${data.order_number || ''} статус өөрчлөгдлөө`,
        body: `${STATUS_LABELS[data.previous_status as string] || data.previous_status} → ${STATUS_LABELS[data.new_status as string] || data.new_status}`,
      }
  }
}
