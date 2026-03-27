/**
 * POST /api/gift-cards/transfer
 * Public endpoint — marks a gift card as transferred to a recipient contact.
 * Auth: gift card code acts as its own token.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { transferGiftCard } from '@/lib/gift-card-engine'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { getSupabase } from '@/lib/supabase/service'

const RATE_LIMIT = { limit: 10, windowSeconds: 60 }

const schema = z.object({
  code:               z.string().min(1).toUpperCase(),
  store_id:           z.string().uuid(),
  recipient_contact:  z.string().min(1),
})

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: z.infer<typeof schema>
  try {
    const raw = await request.json()
    body = schema.parse(raw)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body', detail: String(e) }, { status: 400 })
  }

  const supabase = getSupabase()
  const result = await transferGiftCard(supabase, {
    code: body.code,
    storeId: body.store_id,
    recipientContact: body.recipient_contact,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
