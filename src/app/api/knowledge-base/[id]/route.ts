import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { question, answer, category, keywords, is_active } = body as {
    question?: string; answer?: string; category?: string; keywords?: string[]; is_active?: boolean
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (question !== undefined) updates.question = question
  if (answer !== undefined) updates.answer = answer
  if (category !== undefined) updates.category = category
  if (keywords !== undefined) updates.keywords = keywords
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await supabase
    .from('store_knowledge_base')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Soft delete
  const { error } = await supabase
    .from('store_knowledge_base')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
