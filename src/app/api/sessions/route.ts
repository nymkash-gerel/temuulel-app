import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessions } = await (supabase as any)
    .from('user_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('last_active_at', { ascending: false })

  return NextResponse.json({ sessions: sessions || [] })
}

/**
 * Track session — call from middleware or layout
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ua = req.headers.get('user-agent') || ''
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('user_sessions').insert({
    user_id: user.id,
    ip_address: ip,
    user_agent: ua.substring(0, 200),
  })

  return NextResponse.json({ tracked: true })
}

/**
 * Sign out from a specific session (by id) or all
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('id')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from('user_sessions').delete().eq('user_id', user.id)
  if (sessionId) q = q.eq('id', sessionId)
  await q
  return NextResponse.json({ revoked: true })
}
