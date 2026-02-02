import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createRatePlanSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/rate-plans
 *
 * List rate plans for the store. Supports filtering by pricing_model, is_active.
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
  const pricingModel = searchParams.get('pricing_model')
  const isActive = searchParams.get('is_active')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('rate_plans')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (pricingModel) {
    query = query.eq('pricing_model', pricingModel)
  }

  if (isActive !== null && isActive !== undefined && isActive !== '') {
    query = query.eq('is_active', isActive === 'true')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/rate-plans
 *
 * Create a new rate plan.
 */
export async function POST(request: NextRequest) {
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

  const { data: body, error: validationError } = await validateBody(request, createRatePlanSchema)
  if (validationError) return validationError

  const { data: ratePlan, error } = await supabase
    .from('rate_plans')
    .insert({
      store_id: store.id,
      unit_type: body.unit_type || null,
      name: body.name,
      pricing_model: body.pricing_model || undefined,
      base_price: body.base_price,
      weekend_price: body.weekend_price || null,
      seasonal_adjustments: body.seasonal_adjustments || undefined,
      min_stay: body.min_stay || undefined,
      max_stay: body.max_stay || null,
      is_active: body.is_active ?? true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(ratePlan, { status: 201 })
}
