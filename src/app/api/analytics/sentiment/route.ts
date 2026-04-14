import { NextResponse } from 'next/server'
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

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  // Pull customer messages with sentiment in metadata
  const { data: messages } = await supabase
    .from('messages')
    .select('metadata, created_at')
    .eq('is_from_customer', true)
    .gte('created_at', since)
    .in('conversation_id',
      (await supabase.from('conversations').select('id').eq('store_id', member.store_id)).data?.map((c: { id: string }) => c.id) || []
    )

  // Daily sentiment buckets
  const dailyBuckets: Record<string, { positive: number; neutral: number; negative: number }> = {}
  for (const m of (messages || []) as { metadata: Record<string, unknown> | null; created_at: string }[]) {
    const date = m.created_at.slice(0, 10)
    if (!dailyBuckets[date]) dailyBuckets[date] = { positive: 0, neutral: 0, negative: 0 }
    const sentiment = (m.metadata as { sentiment?: string } | null)?.sentiment
    if (sentiment === 'positive' || sentiment === 'neutral' || sentiment === 'negative') {
      dailyBuckets[date][sentiment]++
    }
  }

  const trend = Object.entries(dailyBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.positive + counts.neutral + counts.negative,
      score: counts.positive - counts.negative,
    }))

  return NextResponse.json({ trend })
}
