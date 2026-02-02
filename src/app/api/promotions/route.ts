import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPromotionSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/promotions
 *
 * List promotions for the authenticated user's store.
 * Supports pagination and filtering by is_active and promo_type.
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
  const isActive = searchParams.get('is_active')
  const promoType = searchParams.get('promo_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('promotions')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }

  if (promoType && [
    'item_discount', 'order_discount', 'bogo', 'combo', 'free_item', 'loyalty',
  ].includes(promoType)) {
    query = query.eq('promo_type', promoType as
      'item_discount' | 'order_discount' | 'bogo' | 'combo' | 'free_item' | 'loyalty'
    )
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/promotions
 *
 * Create a new promotion.
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

  const { data: body, error: validationError } = await validateBody(request, createPromotionSchema)
  if (validationError) return validationError

  const { conditions, ...rest } = body

  const { data: promotion, error } = await supabase
    .from('promotions')
    .insert({
      store_id: store.id,
      ...rest,
      conditions: conditions as Json,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(promotion, { status: 201 })
}
