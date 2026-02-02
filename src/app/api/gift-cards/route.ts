import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createGiftCardSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/gift-cards
 *
 * List gift cards for the store. Supports filtering by status.
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
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['active', 'redeemed', 'expired', 'disabled'] as const

  let query = supabase
    .from('gift_cards')
    .select(`
      id, store_id, code, initial_balance, current_balance, customer_id,
      status, expires_at, created_at, updated_at,
      customers(id, name, phone)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/gift-cards
 *
 * Create a new gift card.
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

  const { data: body, error: validationError } = await validateBody(request, createGiftCardSchema)
  if (validationError) return validationError

  const { data: giftCard, error } = await supabase
    .from('gift_cards')
    .insert({
      store_id: store.id,
      code: body.code,
      initial_balance: body.initial_balance,
      current_balance: body.current_balance,
      customer_id: body.customer_id || null,
      expires_at: body.expires_at || null,
    })
    .select(`
      id, store_id, code, initial_balance, current_balance, customer_id,
      status, expires_at, created_at, updated_at,
      customers(id, name, phone)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(giftCard, { status: 201 })
}
