import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaigns, error } = await (supabase as any)
    .from('broadcast_campaigns')
    .select('*')
    .eq('store_id', member.store_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  const body = await req.json()
  const { name, message_text, target_audience, scheduled_at } = body as {
    name: string; message_text: string; target_audience?: string; scheduled_at?: string
  }

  if (!name?.trim() || !message_text?.trim()) {
    return NextResponse.json({ error: 'name and message_text required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign, error } = await (supabase as any)
    .from('broadcast_campaigns')
    .insert({
      store_id: member.store_id,
      name: name.trim(),
      message_text: message_text.trim(),
      target_audience: target_audience || 'all',
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign }, { status: 201 })
}
