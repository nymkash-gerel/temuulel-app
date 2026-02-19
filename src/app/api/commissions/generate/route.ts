import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, generateCommissionsSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import { withSpan } from '@/lib/sentry-helpers'

/**
 * POST /api/commissions/generate
 *
 * Auto-generate commission records for closed deals that don't have one yet.
 * Optionally filter by specific deal_ids.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 5, windowSeconds: 60 })
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

  const log = createRequestLogger(crypto.randomUUID(), '/api/commissions/generate', {
    userId: user.id,
    storeId: store.id,
  })

  return withSpan('commissions.generate', 'batch.operation', async () => {

  const { data: body, error: validationError } = await validateBody(request, generateCommissionsSchema)
  if (validationError) return validationError

  // Find closed deals without commission records
  let query = supabase
    .from('deals')
    .select('id, agent_id, final_price, commission_amount, agent_share_amount, company_share_amount')
    .eq('store_id', store.id)
    .eq('status', 'closed')
    .not('agent_id', 'is', null)
    .not('commission_amount', 'is', null)

  if (body.deal_ids && body.deal_ids.length > 0) {
    query = query.in('id', body.deal_ids)
  }

  const { data: closedDeals, error: dealsError } = await query

  if (dealsError) {
    return NextResponse.json({ error: dealsError.message }, { status: 500 })
  }

  if (!closedDeals || closedDeals.length === 0) {
    return NextResponse.json({ generated: 0, message: 'No eligible deals found' })
  }

  // Check which deals already have commissions
  const dealIds = closedDeals.map(d => d.id)
  const { data: existingCommissions } = await supabase
    .from('agent_commissions')
    .select('deal_id')
    .in('deal_id', dealIds)

  const existingDealIds = new Set((existingCommissions || []).map(c => c.deal_id))

  // Generate commissions for deals without existing records
  const newCommissions = closedDeals
    .filter(d => !existingDealIds.has(d.id))
    .map(d => ({
      deal_id: d.id,
      agent_id: d.agent_id!,
      store_id: store.id,
      commission_amount: Number(d.commission_amount) || 0,
      agent_share: Number(d.agent_share_amount) || 0,
      company_share: Number(d.company_share_amount) || 0,
    }))

  if (newCommissions.length === 0) {
    return NextResponse.json({ generated: 0, message: 'All eligible deals already have commissions' })
  }

  const { data: inserted, error: insertError } = await supabase
    .from('agent_commissions')
    .insert(newCommissions)
    .select('id, deal_id, agent_id, commission_amount, agent_share, company_share, status')

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  log.info('Commission generation complete', { generated: inserted?.length || 0 })

  return NextResponse.json({
    generated: inserted?.length || 0,
    commissions: inserted,
  })

  }) // end withSpan
}
