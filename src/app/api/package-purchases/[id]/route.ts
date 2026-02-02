import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePackagePurchaseSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/package-purchases/:id
 *
 * Get a single package purchase by id.
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

  const { data: purchase, error } = await supabase
    .from('package_purchases')
    .select(`
      id, store_id, customer_id, package_id, purchase_date, sessions_total,
      sessions_used, expires_at, status, amount_paid, created_at, updated_at,
      customers(id, name, phone),
      service_packages(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !purchase) {
    return NextResponse.json({ error: 'Package purchase not found' }, { status: 404 })
  }

  return NextResponse.json(purchase)
}

/**
 * PATCH /api/package-purchases/:id
 *
 * Update a package purchase.
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

  const { data: body, error: validationError } = await validateBody(request, updatePackagePurchaseSchema)
  if (validationError) return validationError

  const { data: purchase, error } = await supabase
    .from('package_purchases')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, store_id, customer_id, package_id, purchase_date, sessions_total,
      sessions_used, expires_at, status, amount_paid, created_at, updated_at,
      customers(id, name, phone),
      service_packages(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!purchase) {
    return NextResponse.json({ error: 'Package purchase not found' }, { status: 404 })
  }

  return NextResponse.json(purchase)
}
