import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTestStats } from '@/lib/ab-test'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase.from('store_members').select('store_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tests } = await (supabase as any).from('ab_tests')
    .select('*').eq('store_id', member.store_id).order('created_at', { ascending: false })

  const enriched = await Promise.all((tests || []).map(async (t: { id: string }) => ({
    ...t,
    stats: await getTestStats(supabase, t.id),
  })))

  return NextResponse.json({ tests: enriched })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: member } = await supabase.from('store_members').select('store_id').eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  const body = await req.json() as { name: string; variant_a: Record<string, unknown>; variant_b: Record<string, unknown> }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from('ab_tests').insert({
    store_id: member.store_id,
    name: body.name,
    variant_a: body.variant_a,
    variant_b: body.variant_b,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ test: data }, { status: 201 })
}
