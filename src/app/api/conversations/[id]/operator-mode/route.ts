import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Toggle operator mode for a conversation.
 * POST { enabled: true }  → AI paused, human takes over
 * POST { enabled: false } → AI resumes
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { enabled } = body as { enabled: boolean }

  const updates: Record<string, unknown> = {
    operator_mode: enabled,
    operator_mode_at: enabled ? new Date().toISOString() : null,
    operator_id: enabled ? user.id : null,
  }

  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    operator_mode: enabled,
    message: enabled
      ? 'AI түр зогслоо. 30 минутын дараа автомат буцна.'
      : 'AI дахин идэвхжлээ.',
  })
}
