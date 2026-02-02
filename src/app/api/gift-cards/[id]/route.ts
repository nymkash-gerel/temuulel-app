import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateGiftCardSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/gift-cards/:id
 *
 * Get a single gift card by id.
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

  const { data: giftCard, error } = await supabase
    .from('gift_cards')
    .select(`
      id, store_id, code, initial_balance, current_balance, customer_id,
      status, expires_at, created_at, updated_at,
      customers(id, name, phone)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !giftCard) {
    return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
  }

  return NextResponse.json(giftCard)
}

/**
 * PATCH /api/gift-cards/:id
 *
 * Update a gift card.
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

  const { data: body, error: validationError } = await validateBody(request, updateGiftCardSchema)
  if (validationError) return validationError

  const { data: giftCard, error } = await supabase
    .from('gift_cards')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, store_id, code, initial_balance, current_balance, customer_id,
      status, expires_at, created_at, updated_at,
      customers(id, name, phone)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!giftCard) {
    return NextResponse.json({ error: 'Gift card not found' }, { status: 404 })
  }

  return NextResponse.json(giftCard)
}
