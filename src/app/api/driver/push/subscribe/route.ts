import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { pushSubscribeSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = pushSubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
  }

  const { endpoint, keys } = parsed.data

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: auth.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'user_id,endpoint' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
