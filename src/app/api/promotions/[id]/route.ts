import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePromotionSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/promotions/[id]
 *
 * Get a single promotion.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
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

  const { data: promotion, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !promotion) {
    return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
  }

  return NextResponse.json(promotion)
}

/**
 * PATCH /api/promotions/[id]
 *
 * Update a promotion.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
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

  const { data: body, error: validationError } = await validateBody(request, updatePromotionSchema)
  if (validationError) return validationError

  // Cast conditions JSONB field if present
  const updateData: Record<string, unknown> = {
    ...body,
    updated_at: new Date().toISOString(),
  }

  if (body.conditions !== undefined) {
    updateData.conditions = body.conditions as Json
  }

  const { data: promotion, error } = await supabase
    .from('promotions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!promotion) {
    return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
  }

  return NextResponse.json(promotion)
}

/**
 * DELETE /api/promotions/[id]
 *
 * Delete a promotion.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
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

  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
