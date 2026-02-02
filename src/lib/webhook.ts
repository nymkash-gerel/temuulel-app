/**
 * Outgoing webhook delivery via Upstash QStash
 *
 * Sends event notifications to external systems with HMAC-SHA256 signatures.
 * QStash provides automatic retries (3 attempts with exponential backoff),
 * delivery guarantees, and dead-letter handling.
 *
 * Flow:
 *   dispatchWebhook() → QStash queue → /api/webhook/deliver → store's webhook_url
 *
 * Falls back to direct delivery when QSTASH_TOKEN is not configured.
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { Client as QStashClient } from '@upstash/qstash'

export type WebhookEvent =
  | 'new_order'
  | 'order_status'
  | 'new_message'
  | 'new_customer'
  | 'low_stock'
  | 'appointment_created'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_assigned'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'return_completed'
  | 'compensation_suggested'
  | 'compensation_approved'
  | 'compensation_rejected'
  | 'voucher_redeemed'
  | 'returning_customer_voucher'
  | 'delivery_assigned'
  | 'delivery_picked_up'
  | 'delivery_completed'
  | 'delivery_failed'
  | 'delivery_delayed'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  store_id: string
  data: Record<string, unknown>
}

export function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

function getQStashClient(): QStashClient | null {
  const token = process.env.QSTASH_TOKEN
  if (!token) return null
  return new QStashClient({ token })
}

/**
 * Dispatch a webhook event to the store's configured webhook URL.
 *
 * When QStash is configured, the event is published to QStash which
 * delivers it to /api/webhook/deliver with automatic retries.
 * When QStash is not configured, falls back to direct fire-and-forget delivery.
 */
export async function dispatchWebhook(
  storeId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false

  const supabase = createClient(url, key)

  const { data: store } = await supabase
    .from('stores')
    .select('webhook_url, webhook_secret, webhook_events')
    .eq('id', storeId)
    .single()

  if (!store?.webhook_url) return false

  // Check if this event type is enabled
  const enabledEvents = (store.webhook_events || {}) as Record<string, boolean>
  if (!enabledEvents[event]) return false

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    store_id: storeId,
    data,
  }

  // Try QStash first for reliable delivery
  const qstash = getQStashClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (qstash && appUrl) {
    return publishViaQStash(qstash, appUrl, storeId, payload)
  }

  // Fallback: direct delivery (fire-and-forget, no retries)
  return deliverDirectly(store.webhook_url, store.webhook_secret, payload)
}

/**
 * Publish webhook via QStash for reliable delivery with retries.
 * QStash will POST to /api/webhook/deliver with the payload.
 */
async function publishViaQStash(
  qstash: QStashClient,
  appUrl: string,
  storeId: string,
  payload: WebhookPayload
): Promise<boolean> {
  try {
    await qstash.publishJSON({
      url: `${appUrl}/api/webhook/deliver`,
      body: {
        store_id: storeId,
        payload,
      },
      retries: 3,
    })
    return true
  } catch (err) {
    console.error(`QStash publish failed for store ${storeId}:`, err)
    // Fall back to direct delivery
    return false
  }
}

/**
 * Direct webhook delivery (fallback when QStash is not available).
 * Fire-and-forget — errors are logged, not thrown.
 */
export async function deliverDirectly(
  webhookUrl: string,
  webhookSecret: string | null,
  payload: WebhookPayload
): Promise<boolean> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
  }

  if (webhookSecret) {
    headers['X-Webhook-Signature'] = signPayload(body, webhookSecret)
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`Webhook delivery failed for store ${payload.store_id}: ${res.status}`)
      return false
    }

    return true
  } catch (err) {
    console.error(`Webhook delivery error for store ${payload.store_id}:`, err)
    return false
  }
}
