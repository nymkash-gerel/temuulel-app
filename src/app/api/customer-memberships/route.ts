import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createCustomerMembershipSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/customer-memberships
 *
 * List customer memberships for the store.
 * Supports filtering by status, customer_id, membership_id.
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
  const customerId = searchParams.get('customer_id')
  const membershipId = searchParams.get('membership_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('customer_memberships')
    .select(`
      id, customer_id, membership_id, status, started_at, expires_at,
      services_used, created_at, updated_at,
      memberships(id, name, price),
      customers(id, name, phone)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['active', 'paused', 'cancelled', 'expired'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (membershipId) {
    query = query.eq('membership_id', membershipId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/customer-memberships
 *
 * Create a new customer membership.
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

  const { data: body, error: validationError } = await validateBody(request, createCustomerMembershipSchema)
  if (validationError) return validationError

  // Verify customer belongs to store
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', body.customer_id)
    .eq('store_id', store.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Verify membership belongs to store
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('id', body.membership_id)
    .eq('store_id', store.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  const { data: customerMembership, error } = await supabase
    .from('customer_memberships')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id,
      membership_id: body.membership_id,
      status: body.status || 'active',
      expires_at: body.expires_at || null,
    })
    .select(`
      id, customer_id, membership_id, status, started_at, expires_at,
      services_used, created_at, updated_at,
      memberships(id, name, price),
      customers(id, name, phone)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(customerMembership, { status: 201 })
}
