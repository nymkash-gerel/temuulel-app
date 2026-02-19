import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * POST /api/flows/:id/duplicate — Duplicate a flow.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimit(getClientIp(_request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Fetch original flow
  const { data: original } = await supabase
    .from('flows')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!original) return NextResponse.json({ error: 'Flow not found' }, { status: 404 })

  // Insert copy as draft
  const { data: copy, error } = await supabase
    .from('flows')
    .insert({
      store_id: store.id,
      name: `${original.name} (хуулбар)`,
      description: original.description,
      trigger_type: original.trigger_type,
      trigger_config: original.trigger_config,
      nodes: original.nodes,
      edges: original.edges,
      viewport: original.viewport,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flow: copy }, { status: 201 })
}
