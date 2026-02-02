import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLoyaltyTransactionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/loyalty-transactions/:id
 *
 * Get a single loyalty transaction by id.
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

  const { data: transaction, error } = await supabase
    .from('loyalty_transactions')
    .select(`
      id, store_id, customer_id, points, transaction_type, reference_type,
      reference_id, description, created_at,
      customers(id, name, phone)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !transaction) {
    return NextResponse.json({ error: 'Loyalty transaction not found' }, { status: 404 })
  }

  return NextResponse.json(transaction)
}

/**
 * PATCH /api/loyalty-transactions/:id
 *
 * Update a loyalty transaction.
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

  const { data: body, error: validationError } = await validateBody(request, updateLoyaltyTransactionSchema)
  if (validationError) return validationError

  const { data: transaction, error } = await supabase
    .from('loyalty_transactions')
    .update(body)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, store_id, customer_id, points, transaction_type, reference_type,
      reference_id, description, created_at,
      customers(id, name, phone)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!transaction) {
    return NextResponse.json({ error: 'Loyalty transaction not found' }, { status: 404 })
  }

  return NextResponse.json(transaction)
}
