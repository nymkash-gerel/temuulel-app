import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const endpoint = body?.endpoint

  if (!endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  // @ts-expect-error - user_id column exists in schema
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ success: true })
}
