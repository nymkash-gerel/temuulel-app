import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET - List all comment auto-reply rules for the user's store
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  // Get rules ordered by priority
  const { data: rules, error } = await supabase
    .from('comment_auto_rules')
    .select('*')
    .eq('store_id', store.id)
    .order('priority', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rules })
}

// POST - Create a new comment auto-reply rule
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const body = await request.json()
  const {
    name,
    enabled = true,
    trigger_type = 'keyword',
    keywords = [],
    match_mode = 'any',
    reply_comment = true,
    reply_dm = false,
    comment_template = '',
    dm_template = '',
    delay_seconds = 0,
    platforms = ['facebook', 'instagram'],
    use_ai = false,
    ai_context = '',
  } = body

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Get the highest priority to add at the end
  const { data: existingRules } = await supabase
    .from('comment_auto_rules')
    .select('priority')
    .eq('store_id', store.id)
    .order('priority', { ascending: false })
    .limit(1)

  const newPriority = existingRules && existingRules.length > 0
    ? existingRules[0].priority + 1
    : 0

  const { data: rule, error } = await supabase
    .from('comment_auto_rules')
    .insert({
      store_id: store.id,
      name,
      enabled,
      priority: newPriority,
      trigger_type,
      keywords: keywords.length > 0 ? keywords : null,
      match_mode,
      reply_comment,
      reply_dm,
      comment_template: comment_template || null,
      dm_template: dm_template || null,
      delay_seconds,
      platforms,
      use_ai,
      ai_context: ai_context || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule }, { status: 201 })
}
