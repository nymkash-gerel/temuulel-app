import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createLoyaltyTransactionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/loyalty-transactions
 *
 * List loyalty transactions for the store. Supports filtering by transaction_type, customer_id.
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
  const transactionType = searchParams.get('transaction_type')
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validTypes = ['earn', 'redeem', 'adjust', 'expire'] as const

  let query = supabase
    .from('loyalty_transactions')
    .select(`
      id, store_id, customer_id, points, transaction_type, reference_type,
      reference_id, description, created_at,
      customers(id, name, phone)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (transactionType && validTypes.includes(transactionType as typeof validTypes[number])) {
    query = query.eq('transaction_type', transactionType as typeof validTypes[number])
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
 * POST /api/loyalty-transactions
 *
 * Create a new loyalty transaction.
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

  const { data: body, error: validationError } = await validateBody(request, createLoyaltyTransactionSchema)
  if (validationError) return validationError

  const { data: transaction, error } = await supabase
    .from('loyalty_transactions')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      points: body.points,
      transaction_type: body.transaction_type,
      reference_type: body.reference_type || null,
      reference_id: body.reference_id || null,
      description: body.description || null,
    })
    .select(`
      id, store_id, customer_id, points, transaction_type, reference_type,
      reference_id, description, created_at,
      customers(id, name, phone)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(transaction, { status: 201 })
}
