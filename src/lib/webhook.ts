/**
 * Outgoing webhook delivery
 *
 * Sends event notifications to external systems (n8n, Zapier, etc.)
 * with HMAC-SHA256 signatures for verification.
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export type WebhookEvent =
  | 'new_order'
  | 'order_status'
  | 'new_message'
  | 'new_customer'
  | 'low_stock'

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  store_id: string
  data: Record<string, unknown>
}

function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Dispatch a webhook event to the store's configured webhook URL.
 * Non-blocking — errors are logged, not thrown.
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

  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': payload.timestamp,
  }

  if (store.webhook_secret) {
    headers['X-Webhook-Signature'] = signPayload(body, store.webhook_secret)
  }

  try {
    const res = await fetch(store.webhook_url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`Webhook delivery failed for store ${storeId}: ${res.status}`)
      return false
    }

    return true
  } catch (err) {
    console.error(`Webhook delivery error for store ${storeId}:`, err)
    return false
  }
}
