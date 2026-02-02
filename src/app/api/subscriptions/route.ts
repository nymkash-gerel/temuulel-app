import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createSubscriptionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/subscriptions
 *
 * List subscriptions for the store. Supports filtering by status, billing_period, customer_id.
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
  const billingPeriod = searchParams.get('billing_period')
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['active', 'paused', 'cancelled', 'expired', 'past_due'] as const

  let query = supabase
    .from('subscriptions')
    .select(`
      id, customer_id, plan_name, amount, billing_period, status, auto_renew, next_billing_at, notes, created_at, updated_at,
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (billingPeriod) {
    query = query.eq('billing_period', billingPeriod)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/subscriptions
 *
 * Create a new subscription.
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

  const { data: body, error: validationError } = await validateBody(request, createSubscriptionSchema)
  if (validationError) return validationError

  // Verify customer belongs to store
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', body.customer_id)
    .eq('store_id', store.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found in this store' }, { status: 404 })
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id,
      plan_name: body.plan_name,
      amount: body.amount,
      billing_period: body.billing_period || undefined,
      status: 'active',
      auto_renew: body.auto_renew ?? true,
      next_billing_at: body.next_billing_at || null,
      notes: body.notes || null,
    })
    .select(`
      id, customer_id, plan_name, amount, billing_period, status, auto_renew, next_billing_at, notes, created_at, updated_at,
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(subscription, { status: 201 })
}
