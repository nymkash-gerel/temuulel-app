import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateProductAvailabilitySchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/products/:id/availability
 *
 * Update menu availability for a product (available_today, daily_limit, sold_out).
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

  const { data: body, error: validationError } = await validateBody(request, updateProductAvailabilitySchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.available_today !== undefined) updateData.available_today = body.available_today
  if (body.daily_limit !== undefined) updateData.daily_limit = body.daily_limit
  if (body.sold_out !== undefined) updateData.sold_out = body.sold_out

  const { data: product, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select('id, name, available_today, daily_limit, daily_sold, sold_out, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json(product)
}
