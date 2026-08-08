import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveStore } from '@/lib/resolve-store'
import { validateBody, updateProductSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/** Matches the 30/min used by the other dashboard mutation routes. */
const RATE_LIMIT = { limit: 30, windowSeconds: 60 }

/**
 * Partial product update. The menu detail screen (dashboard/menu/[id]) already
 * PATCHes here, but only DELETE was implemented, so every menu-item edit came
 * back 405 and silently failed.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = await rateLimit(getClientIp(req), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const store = await resolveStore(supabase, user.id)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: body, error: validationError } = await validateBody(req, updateProductSchema)
  if (validationError) return validationError

  // Scope the update to this store as well as the id, so a product id from
  // another store can't be written even if it is guessed.
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const updates = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined)
  )
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .eq('store_id', store.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limited to match PATCH — deleting was previously unthrottled.
  const rl = await rateLimit(getClientIp(req), RATE_LIMIT)
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const store = await resolveStore(supabase, user.id)
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Verify product belongs to this store
  const { data: product } = await supabase
    .from('products')
    .select('id, store_id')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Nullify order_items references (preserve order history)
  await supabase.from('order_items').update({ product_id: null }).eq('product_id', id)

  // Delete variants (FK constraint)
  await supabase.from('product_variants').delete().eq('product_id', id)

  // Delete product
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
