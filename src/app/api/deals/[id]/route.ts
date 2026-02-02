import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateDealSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// Valid deal status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  lead: ['viewing', 'lost'],
  viewing: ['offer', 'lost'],
  offer: ['contract', 'lost'],
  contract: ['closed', 'withdrawn'],
}

/**
 * GET /api/deals/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data, error } = await supabase
    .from('deals')
    .select(`
      *,
      products(id, name, images, base_price, category, description),
      customers(id, name, phone, email, address),
      staff(id, name, phone, email),
      agent_commissions(id, commission_amount, agent_share, company_share, status, paid_at, created_at)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/deals/[id]
 *
 * Update a deal. Enforces status transitions.
 * When closing a deal with final_price, auto-calculates commissions.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

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

  const { data: body, error: validationError } = await validateBody(request, updateDealSchema)
  if (validationError) return validationError

  // Fetch current deal
  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Validate status transitions if status is changing
  if (body.status && body.status !== deal.status) {
    const allowed = VALID_TRANSITIONS[deal.status]
    if (!allowed || !allowed.includes(body.status)) {
      return NextResponse.json({
        error: `Cannot transition from ${deal.status} to ${body.status}`,
      }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const updateData: Record<string, unknown> = { updated_at: now }

  // Copy allowed fields
  const fields = [
    'property_id', 'customer_id', 'agent_id', 'status', 'deal_type',
    'asking_price', 'offer_price', 'final_price',
    'commission_rate', 'agent_share_rate',
    'viewing_date', 'offer_date', 'contract_date',
    'notes', 'metadata',
  ] as const

  for (const field of fields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  // Set date stamps based on status changes
  if (body.status === 'viewing' && !deal.viewing_date) {
    updateData.viewing_date = now
  }
  if (body.status === 'offer' && !deal.offer_date) {
    updateData.offer_date = now
  }
  if (body.status === 'contract' && !deal.contract_date) {
    updateData.contract_date = now
  }
  if (body.status === 'closed') {
    updateData.closed_date = now
  }
  if (body.status === 'withdrawn') {
    updateData.withdrawn_date = now
  }

  // Auto-calculate commissions when closing with final_price
  if (body.status === 'closed') {
    const finalPrice = (body.final_price ?? deal.final_price ?? deal.offer_price ?? deal.asking_price) as number | null
    const commissionRate = (body.commission_rate ?? deal.commission_rate ?? 5) as number
    const agentShareRate = (body.agent_share_rate ?? deal.agent_share_rate ?? 50) as number

    if (finalPrice && finalPrice > 0) {
      const commissionAmount = finalPrice * (commissionRate / 100)
      const agentShareAmount = commissionAmount * (agentShareRate / 100)
      const companyShareAmount = commissionAmount - agentShareAmount

      updateData.final_price = finalPrice
      updateData.commission_amount = commissionAmount
      updateData.agent_share_amount = agentShareAmount
      updateData.company_share_amount = companyShareAmount
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('deals')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      products(id, name),
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

/**
 * DELETE /api/deals/[id]
 *
 * Delete a deal. Only allowed for lead or lost deals.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { data: deal } = await supabase
    .from('deals')
    .select('id, status')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  if (!['lead', 'lost'].includes(deal.status)) {
    return NextResponse.json({ error: 'Only lead or lost deals can be deleted' }, { status: 400 })
  }

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
