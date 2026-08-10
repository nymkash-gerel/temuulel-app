import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

/**
 * Facebook Data Deletion Callback
 *
 * Facebook calls this endpoint with a signed_request when a user removes
 * the Temuulel app from their Facebook Settings → Apps and Websites.
 *
 * Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * Expected flow:
 * 1. Parse signed_request (POST body form-encoded)
 * 2. Verify signature against FACEBOOK_APP_SECRET (HMAC-SHA256)
 * 3. Extract user_id from payload
 * 4. Delete all user data (customers, conversations, messages)
 * 5. Return { url, confirmation_code }
 */

function base64urlDecode(input: string): Buffer {
  const padded = input + '==='.slice((input.length + 3) % 4)
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): { user_id?: string } | null {
  const [encodedSig, payload] = signedRequest.split('.')
  if (!encodedSig || !payload) return null

  const sig = base64urlDecode(encodedSig)
  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest()

  // Constant-time compare
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(sig, expected)) return null

  try {
    return JSON.parse(base64urlDecode(payload).toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Base URL for the links Facebook surfaces to the user after a deletion
 * request. Reads the env var like robots.ts / sitemap.ts / email.ts do — this
 * file used to hardcode temuulel.com, so on any other domain the "check status"
 * link Facebook showed the user 404'd.
 */
function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://temuulel.com').replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const formData = await req.formData()
  const signedRequest = formData.get('signed_request')
  if (typeof signedRequest !== 'string') {
    return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
  }

  const data = parseSignedRequest(signedRequest, appSecret)
  if (!data || !data.user_id) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const confirmationCode = crypto.randomBytes(16).toString('hex')
  const fbUserId = data.user_id

  // Fire-and-forget deletion (Facebook expects quick response)
  void (async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) return

      const supabase = createClient(url, key)

      // Find customers by messenger_id (FB user_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customers } = await (supabase as any)
        .from('customers')
        .select('id')
        .eq('messenger_id', fbUserId)

      const customerIds = (customers || []).map((c: { id: string }) => c.id)
      if (customerIds.length === 0) return

      // Delete related data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any

      // Conversations → cascade deletes messages via FK
      await db.from('conversations').delete().in('customer_id', customerIds)
      // Customer records
      await db.from('customers').delete().in('id', customerIds)

      // Log the deletion
      await db.from('data_deletion_log').insert({
        fb_user_id: fbUserId,
        confirmation_code: confirmationCode,
        deleted_customer_ids: customerIds,
        status: 'completed',
      }).then(() => {}).catch(() => {})
    } catch (e) {
      console.error('Data deletion error:', e)
    }
  })()

  return NextResponse.json({
    url: `${appUrl()}/data-deletion/status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  })
}

// GET for manual verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    info: 'Facebook Data Deletion Callback. POST signed_request to delete user data.',
    docs: `${appUrl()}/data-deletion`,
  })
}
