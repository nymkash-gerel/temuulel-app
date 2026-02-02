import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { Json } from '@/lib/database.types'
import { validateBody, createFlowSchema } from '@/lib/validations'

const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * GET /api/flows — List all flows for the user's store.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: flows, error } = await supabase
    .from('flows')
    .select('id, name, description, status, trigger_type, trigger_config, priority, times_triggered, times_completed, last_triggered_at, is_template, business_type, created_at, updated_at')
    .eq('store_id', store.id)
    .order('priority', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flows: flows ?? [] })
}

/**
 * POST /api/flows — Create a new flow.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(request, createFlowSchema)
  if (validationError) return validationError

  const { data: flow, error } = await supabase
    .from('flows')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description || null,
      trigger_type: body.trigger_type || 'keyword',
      trigger_config: (body.trigger_config || {}) as Json,
      nodes: (body.nodes || []) as Json,
      edges: (body.edges || []) as Json,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flow }, { status: 201 })
}
