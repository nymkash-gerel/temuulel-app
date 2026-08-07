import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createCommissionSchema, parsePagination } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Shared select shape — matches the real-estate commissions dashboard (agent_commissions,
// joined to the deal + listing + agent). Kept in sync with /api/commissions/[id] and generate.
const COMMISSION_SELECT = `
  id, deal_id, agent_id, commission_amount, agent_share, company_share,
  status, paid_at, notes, created_at, updated_at,
  deals(id, deal_number, final_price, deal_type, status, products(id, name)),
  staff(id, name, phone)
`

/**
 * GET /api/commissions
 *
 * List real-estate agent commissions for the store.
 * Supports filtering by agent_id and status.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const agentId = searchParams.get('agent_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('agent_commissions')
    .select(COMMISSION_SELECT, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['pending', 'approved', 'paid', 'cancelled'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/commissions
 *
 * Manually create an agent commission for a deal.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 403 })
  }

  const { data: body, error: validationError } = await validateBody(request, createCommissionSchema)
  if (validationError) return validationError

  // Verify the deal belongs to this store
  const { data: deal } = await supabase
    .from('deals')
    .select('id')
    .eq('id', body.deal_id)
    .eq('store_id', store.id)
    .single()

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Verify the agent (staff) belongs to this store
  const { data: agent } = await supabase
    .from('staff')
    .select('id')
    .eq('id', body.agent_id)
    .eq('store_id', store.id)
    .single()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const { data: commission, error } = await supabase
    .from('agent_commissions')
    .insert({
      store_id: store.id,
      deal_id: body.deal_id,
      agent_id: body.agent_id,
      commission_amount: body.commission_amount,
      agent_share: body.agent_share,
      company_share: body.company_share,
      notes: body.notes ?? null,
      status: 'pending',
    })
    .select(COMMISSION_SELECT)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(commission, { status: 201 })
}
