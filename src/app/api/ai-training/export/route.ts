import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/ai-training/export — Export answered Q&A as JSONL for OpenAI fine-tuning.
 * Format: {"messages": [{"role":"system","content":...}, {"role":"user","content":...}, {"role":"assistant","content":...}]}
 */
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

  const { data: store } = await supabase
    .from('stores')
    .select('name, business_type')
    .eq('id', member.store_id)
    .single()

  // Pull unanswered_questions that are now answered + linked knowledge entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pairs } = await (supabase as any)
    .from('unanswered_questions')
    .select('customer_message, ai_response, knowledge_entry_id, store_knowledge_base(answer)')
    .eq('store_id', member.store_id)
    .eq('status', 'answered')
    .not('knowledge_entry_id', 'is', null)

  const systemPrompt = `Та ${store?.name || 'Манай дэлгүүр'} -ийн AI туслах. Монгол хэлээр хариулна.`
  const lines: string[] = []
  for (const p of (pairs || []) as { customer_message: string; ai_response: string | null; store_knowledge_base?: { answer: string } | null }[]) {
    const answer = p.store_knowledge_base?.answer || p.ai_response
    if (!p.customer_message || !answer) continue
    lines.push(JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: p.customer_message },
        { role: 'assistant', content: answer },
      ],
    }))
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No training data — answer some questions first', count: 0 }, { status: 404 })
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'application/jsonl',
      'Content-Disposition': `attachment; filename="ai-training-${store?.business_type || 'store'}-${new Date().toISOString().slice(0, 10)}.jsonl"`,
    },
  })
}
