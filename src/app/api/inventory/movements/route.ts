import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createInventoryMovementSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/inventory/movements
 *
 * List inventory movements for the store. Supports filtering by product_id, movement_type, location_id.
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
  const productId = searchParams.get('product_id')
  const movementType = searchParams.get('movement_type')
  const locationId = searchParams.get('location_id')
  const { limit, offset } = parsePagination(searchParams)

  const validMovementTypes = ['received', 'sold', 'returned', 'adjusted', 'transferred', 'damaged', 'expired'] as const

  let query = supabase
    .from('inventory_movements')
    .select(`
      id, product_id, variant_id, location_id, movement_type, quantity, reference_type, reference_id, unit_cost, notes, created_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  if (movementType && validMovementTypes.includes(movementType as typeof validMovementTypes[number])) {
    query = query.eq('movement_type', movementType as typeof validMovementTypes[number])
  }

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/inventory/movements
 *
 * Create a new inventory movement.
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

  const { data: body, error: validationError } = await validateBody(request, createInventoryMovementSchema)
  if (validationError) return validationError

  // Verify product belongs to store
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', body.product_id)
    .eq('store_id', store.id)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Product not found in this store' }, { status: 404 })
  }

  const { data: movement, error } = await supabase
    .from('inventory_movements')
    .insert({
      store_id: store.id,
      product_id: body.product_id,
      variant_id: body.variant_id || null,
      location_id: body.location_id || null,
      movement_type: body.movement_type,
      quantity: body.quantity,
      reference_type: body.reference_type || null,
      reference_id: body.reference_id || null,
      unit_cost: body.unit_cost || null,
      notes: body.notes || null,
    })
    .select(`
      id, product_id, variant_id, location_id, movement_type, quantity, reference_type, reference_id, unit_cost, notes, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(movement, { status: 201 })
}
