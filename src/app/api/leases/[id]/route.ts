import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLeaseSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/leases/:id
 *
 * Get a single lease by id.
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

  const { data: lease, error } = await supabase
    .from('leases')
    .select('id, unit_id, tenant_name, tenant_phone, tenant_email, lease_start, lease_end, monthly_rent, deposit_amount, notes, status, store_id, created_at, updated_at')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
  }

  return NextResponse.json(lease)
}

/**
 * PATCH /api/leases/:id
 *
 * Update a lease.
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

  const { data: body, error: validationError } = await validateBody(request, updateLeaseSchema)
  if (validationError) return validationError

  const { data: lease, error } = await supabase
    .from('leases')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select('id, unit_id, tenant_name, tenant_phone, tenant_email, lease_start, lease_end, monthly_rent, deposit_amount, notes, status, store_id, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
  }

  return NextResponse.json(lease)
}
