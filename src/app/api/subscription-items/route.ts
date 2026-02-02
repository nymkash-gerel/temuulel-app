import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createSubscriptionItemSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/subscription-items
 *
 * List subscription items for the store. Supports filtering by subscription_id.
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
  const subscriptionId = searchParams.get('subscription_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('subscription_items')
    .select(`
      id, subscription_id, product_id, service_id, description, quantity, unit_price, created_at,
      subscriptions(id, plan_name),
      products(id, name),
      services(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (subscriptionId) {
    query = query.eq('subscription_id', subscriptionId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/subscription-items
 *
 * Create a new subscription item.
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

  const { data: body, error: validationError } = await validateBody(request, createSubscriptionItemSchema)
  if (validationError) return validationError

  // Verify subscription belongs to store
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('id', body.subscription_id)
    .eq('store_id', store.id)
    .single()

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found in this store' }, { status: 404 })
  }

  const { data: item, error } = await supabase
    .from('subscription_items')
    .insert({
      store_id: store.id,
      subscription_id: body.subscription_id,
      description: body.description,
      unit_price: body.unit_price,
      product_id: body.product_id || null,
      service_id: body.service_id || null,
      quantity: body.quantity || undefined,
    })
    .select(`
      id, subscription_id, product_id, service_id, description, quantity, unit_price, created_at,
      subscriptions(id, plan_name),
      products(id, name),
      services(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(item, { status: 201 })
}
