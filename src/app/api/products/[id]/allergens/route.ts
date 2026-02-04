import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateProductAllergensSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/products/:id/allergens
 *
 * Update allergen and dietary info for a product.
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

  const { data: body, error: validationError } = await validateBody(request, updateProductAllergensSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.allergens !== undefined) updateData.allergens = body.allergens
  if (body.spicy_level !== undefined) updateData.spicy_level = body.spicy_level
  if (body.is_vegan !== undefined) updateData.is_vegan = body.is_vegan
  if (body.is_halal !== undefined) updateData.is_halal = body.is_halal
  if (body.is_gluten_free !== undefined) updateData.is_gluten_free = body.is_gluten_free
  if (body.dietary_tags !== undefined) updateData.dietary_tags = body.dietary_tags

  const { data: product, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select('id, name, allergens, spicy_level, is_vegan, is_halal, is_gluten_free, dietary_tags, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json(product)
}
