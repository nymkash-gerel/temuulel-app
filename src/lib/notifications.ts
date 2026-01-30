/**
 * Central notification dispatcher
 *
 * Handles in-app notifications (stored in DB), email sending,
 * and webhook dispatch for all notification events.
 */
import { createClient } from '@supabase/supabase-js'
import { sendOrderEmail, sendMessageEmail, sendLowStockEmail } from './email'
import { dispatchWebhook, type WebhookEvent } from './webhook'
import { sendPushToUser } from './push'

export type NotificationEvent = 'new_order' | 'new_message' | 'new_customer' | 'low_stock' | 'order_status' | 'escalation'

interface NotificationData {
  [key: string]: unknown
}

const ESCALATION_LABELS: Record<string, string> = {
  low: 'Бага',
  medium: 'Дунд',
  high: 'Яаралтай',
  critical: 'Маш яаралтай',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  processing: 'Бэлтгэж буй',
  shipped: 'Илгээсэн',
  delivered: 'Хүргэсэн',
  cancelled: 'Цуцлагдсан',
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

/**
 * Build in-app notification title and body from the event type and data.
 */
function buildNotificationContent(event: NotificationEvent, data: NotificationData) {
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
        body: `${statusLabel(data.previous_status as string)} → ${statusLabel(data.new_status as string)}`,
      }
    case 'escalation':
      return {
        title: 'Яаралтай чат шилжсэн',
        body: `Түвшин: ${ESCALATION_LABELS[(data.level as string) || ''] || data.level}. Шалтгаан: ${data.signals || ''}`,
      }
  }
}

/**
 * Dispatch a notification for a store event.
 *
 * 1. Looks up the store owner's email and notification settings
 * 2. Sends email if the corresponding setting is enabled
 * 3. Saves an in-app notification to the notifications table
 * 4. Dispatches the outgoing webhook
 */
export async function dispatchNotification(
  storeId: string,
  event: NotificationEvent,
  data: NotificationData
): Promise<void> {
  const supabase = getSupabase()

  // 1. Look up store owner's email + notification_settings
  const { data: store } = await supabase
    .from('stores')
    .select('owner_id')
    .eq('id', storeId)
    .single()

  if (!store) return

  const { data: owner } = await supabase
    .from('users')
    .select('email, notification_settings')
    .eq('id', store.owner_id)
    .single()

  // Build notification content (reused by push and in-app)
  const { title, body } = buildNotificationContent(event, data)
  const settings = (owner?.notification_settings || {}) as Record<string, boolean>

  // 2. Send email if enabled
  if (owner?.email) {
    const emailKey = `email_${event}`

    if (settings[emailKey]) {
      try {
        switch (event) {
          case 'new_order':
            await sendOrderEmail(owner.email, {
              order_number: (data.order_number as string) || '',
              total_amount: (data.total_amount as number) || 0,
              payment_method: (data.payment_method as string) || null,
            })
            break
          case 'new_message':
            await sendMessageEmail(
              owner.email,
              (data.customer_name as string) || 'Харилцагч',
              (data.message as string) || ''
            )
            break
          case 'low_stock':
            await sendLowStockEmail(
              owner.email,
              (data.product_name as string) || '',
              (data.remaining as number) || 0
            )
            break
          // new_customer has no dedicated email template — skip
        }
      } catch (err) {
        console.error(`Email notification failed for ${event}:`, err)
      }
    }
  }

  // 2.5 Send push notification if enabled
  const pushKey = `push_${event}`
  if (settings[pushKey]) {
    const eventRoutes: Record<string, string> = {
      new_order: '/dashboard/orders',
      new_message: '/dashboard/chat',
      new_customer: '/dashboard/customers',
      low_stock: '/dashboard/products',
      order_status: '/dashboard/orders',
      escalation: '/dashboard/chat',
    }
    try {
      await sendPushToUser(store.owner_id, {
        title,
        body,
        url: eventRoutes[event] || '/dashboard',
        tag: `temuulel-${event}`,
      })
    } catch (err) {
      console.error(`Push notification failed for ${event}:`, err)
    }
  }

  // 3. Save in-app notification

  try {
    await supabase.from('notifications').insert({
      store_id: storeId,
      type: event,
      title,
      body,
      data,
      is_read: false,
    })
  } catch (err) {
    console.error('Failed to save in-app notification:', err)
  }

  // 4. Dispatch outgoing webhook (non-blocking)
  dispatchWebhook(storeId, event as WebhookEvent, data as Record<string, unknown>)
}
