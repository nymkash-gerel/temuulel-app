import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createDealSchema, parsePagination } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

function generateDealNumber(): string {
  return `DEAL-${Date.now()}`
}

/**
 * GET /api/deals
 *
 * List deals for the authenticated user's store.
 * Supports filtering by status and pagination.
 */
export async function GET(request: NextRequest) {
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
    .from('deals')
    .select(`
      id, deal_number, status, deal_type,
      asking_price, offer_price, final_price,
      commission_rate, commission_amount, agent_share_rate, agent_share_amount, company_share_amount,
      viewing_date, offer_date, contract_date, closed_date, withdrawn_date,
      notes, created_at, updated_at,
      products(id, name, images, base_price),
      customers(id, name, phone),
      staff(id, name, phone)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && ['lead', 'viewing', 'offer', 'contract', 'closed', 'withdrawn', 'lost'].includes(status)) {
    query = query.eq('status', status)
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
 * POST /api/deals
 *
 * Create a new deal (starts as 'lead').
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 20, windowSeconds: 60 })
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

  const { data: body, error: validationError } = await validateBody(request, createDealSchema)
  if (validationError) return validationError

  // Verify property belongs to store if provided
  if (body.property_id) {
    const { data: property } = await supabase
      .from('products')
      .select('id')
      .eq('id', body.property_id)
      .eq('store_id', store.id)
      .single()

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }
  }

  // Verify agent belongs to store if provided
  if (body.agent_id) {
    const { data: agent } = await supabase
      .from('staff')
      .select('id')
      .eq('id', body.agent_id)
      .eq('store_id', store.id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
  }

  const { data: deal, error } = await supabase
    .from('deals')
    .insert({
      store_id: store.id,
      deal_number: generateDealNumber(),
      property_id: body.property_id || null,
      customer_id: body.customer_id || null,
      agent_id: body.agent_id || null,
      deal_type: body.deal_type,
      asking_price: body.asking_price || null,
      commission_rate: body.commission_rate,
      agent_share_rate: body.agent_share_rate,
      notes: body.notes || null,
      status: 'lead',
    })
    .select(`
      id, deal_number, status, deal_type, asking_price,
      commission_rate, agent_share_rate, notes, created_at,
      products(id, name),
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(deal, { status: 201 })
}
