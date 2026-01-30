/**
 * POST /api/webhook/deliver
 *
 * QStash callback target — receives queued webhook events and delivers
 * them to the store's configured webhook URL with HMAC-SHA256 signing.
 *
 * QStash handles retries automatically (3 attempts, exponential backoff).
 * If this endpoint returns non-2xx, QStash will retry the delivery.
 *
 * Security: Verified via QStash signature (Upstash-Signature header).
 */
import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { createClient } from '@supabase/supabase-js'
import { signPayload, type WebhookPayload } from '@/lib/webhook'

function getReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) return null
  return new Receiver({ currentSigningKey, nextSigningKey })
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  // 1. Verify QStash signature
  const receiver = getReceiver()
  const rawBody = await request.text()

  if (receiver) {
    const signature = request.headers.get('upstash-signature') || ''
    try {
      await receiver.verify({ signature, body: rawBody })
    } catch {
      return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 })
    }
  }

  // 2. Parse the queued payload
  let body: { store_id: string; payload: WebhookPayload }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { store_id, payload } = body
  if (!store_id || !payload) {
    return NextResponse.json({ error: 'Missing store_id or payload' }, { status: 400 })
  }

  // 3. Look up the store's webhook URL and secret
  const supabase = getSupabase()
  const { data: store } = await supabase
    .from('stores')
    .select('webhook_url, webhook_secret')
    .eq('id', store_id)
    .single()

  if (!store?.webhook_url) {
    // Store no longer has a webhook URL — don't retry
    return NextResponse.json({ message: 'No webhook URL configured' })
  }

  // 4. Sign and deliver the payload to the store's webhook URL
  const jsonBody = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
  }

  if (store.webhook_secret) {
    headers['X-Webhook-Signature'] = signPayload(jsonBody, store.webhook_secret)
  }

  const res = await fetch(store.webhook_url, {
    method: 'POST',
    headers,
    body: jsonBody,
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    // Return 500 so QStash will retry this delivery
    console.error(`Webhook delivery failed for store ${store_id}: ${res.status}`)
    return NextResponse.json(
      { error: `Delivery failed: ${res.status}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ message: 'Delivered', status: res.status })
}
