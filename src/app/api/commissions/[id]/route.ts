import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateCommissionSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

// Matches /api/commissions (agent_commissions joined to deal + listing + agent).
const COMMISSION_SELECT = `
  id, deal_id, agent_id, commission_amount, agent_share, company_share,
  status, paid_at, notes, created_at, updated_at,
  deals(id, deal_number, final_price, deal_type, status, products(id, name)),
  staff(id, name, phone)
`

/**
 * GET /api/commissions/:id
 *
 * Get a single agent commission by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
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

  const { data: commission, error } = await supabase
    .from('agent_commissions')
    .select(COMMISSION_SELECT)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !commission) {
    return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
  }

  return NextResponse.json(commission)
}

/**
 * PATCH /api/commissions/:id
 *
 * Update an agent commission (status, notes).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
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

  const { data: body, error: validationError } = await validateBody(request, updateCommissionSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.notes !== undefined) updateData.notes = body.notes

  // Auto-set paid_at when status transitions to paid
  if (body.status === 'paid') {
    updateData.paid_at = new Date().toISOString()
  }

  const { data: commission, error } = await supabase
    .from('agent_commissions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(COMMISSION_SELECT)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!commission) {
    return NextResponse.json({ error: 'Commission not found' }, { status: 404 })
  }

  return NextResponse.json(commission)
}
