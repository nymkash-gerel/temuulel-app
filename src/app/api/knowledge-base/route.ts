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

  // store_knowledge_base not in generated types yet — use `as any` (JSONB narrowing)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entries, error } = await (supabase as any)
    .from('store_knowledge_base')
    .select('*')
    .eq('store_id', member.store_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries })
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
  const { question, answer, category, keywords } = body as {
    question: string; answer: string; category?: string; keywords?: string[]
  }

  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: 'question and answer required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error } = await (supabase as any)
    .from('store_knowledge_base')
    .insert({
      store_id: member.store_id,
      question: question.trim(),
      answer: answer.trim(),
      category: category || 'general',
      keywords: keywords || [],
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry }, { status: 201 })
}
