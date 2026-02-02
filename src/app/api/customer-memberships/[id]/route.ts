import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateCustomerMembershipSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/customer-memberships/:id
 *
 * Get a single customer membership by id with joins.
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

  const { data: customerMembership, error } = await supabase
    .from('customer_memberships')
    .select(`
      id, customer_id, membership_id, status, started_at, expires_at,
      services_used, created_at, updated_at,
      memberships(id, name, price),
      customers(id, name, phone)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !customerMembership) {
    return NextResponse.json({ error: 'Customer membership not found' }, { status: 404 })
  }

  return NextResponse.json(customerMembership)
}

/**
 * PATCH /api/customer-memberships/:id
 *
 * Update a customer membership.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const { data: body, error: validationError } = await validateBody(request, updateCustomerMembershipSchema)
  if (validationError) return validationError

  const { data: customerMembership, error } = await supabase
    .from('customer_memberships')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
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

  if (!customerMembership) {
    return NextResponse.json({ error: 'Customer membership not found' }, { status: 404 })
  }

  return NextResponse.json(customerMembership)
}
