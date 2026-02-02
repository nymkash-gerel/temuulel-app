import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPackagePurchaseSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/package-purchases
 *
 * List package purchases for the store. Supports filtering by status, customer_id.
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
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['active', 'expired', 'completed', 'cancelled'] as const

  let query = supabase
    .from('package_purchases')
    .select(`
      id, store_id, customer_id, package_id, purchase_date, sessions_total,
      sessions_used, expires_at, status, amount_paid, created_at, updated_at,
      customers(id, name, phone),
      service_packages(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
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
 * POST /api/package-purchases
 *
 * Create a new package purchase.
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

  const { data: body, error: validationError } = await validateBody(request, createPackagePurchaseSchema)
  if (validationError) return validationError

  const { data: purchase, error } = await supabase
    .from('package_purchases')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      package_id: body.package_id || null,
      purchase_date: body.purchase_date || undefined,
      sessions_total: body.sessions_total,
      expires_at: body.expires_at || null,
      amount_paid: body.amount_paid || null,
    })
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

  return NextResponse.json(purchase, { status: 201 })
}
