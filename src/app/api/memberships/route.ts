import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMembershipSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/memberships
 *
 * List memberships for the store. Supports filtering by is_active, billing_period.
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
  const isActive = searchParams.get('is_active')
  const billingPeriod = searchParams.get('billing_period')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('memberships')
    .select(`
      id, name, description, price, billing_period, benefits,
      is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (isActive === 'true') {
    query = query.eq('is_active', true)
  } else if (isActive === 'false') {
    query = query.eq('is_active', false)
  }

  const validBillingPeriods = ['weekly', 'monthly', 'quarterly', 'yearly'] as const
  if (billingPeriod && validBillingPeriods.includes(billingPeriod as typeof validBillingPeriods[number])) {
    query = query.eq('billing_period', billingPeriod as typeof validBillingPeriods[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/memberships
 *
 * Create a new membership plan.
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

  const { data: body, error: validationError } = await validateBody(request, createMembershipSchema)
  if (validationError) return validationError

  const { data: membership, error } = await supabase
    .from('memberships')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description || null,
      price: body.price,
      billing_period: body.billing_period || 'monthly',
      benefits: (body.benefits as Json) || {},
      is_active: body.is_active ?? true,
    })
    .select(`
      id, name, description, price, billing_period, benefits,
      is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(membership, { status: 201 })
}
