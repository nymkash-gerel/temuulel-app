import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateInventoryLocationSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/inventory/locations/:id
 *
 * Get a single inventory location by id.
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

  const { data: location, error } = await supabase
    .from('inventory_locations')
    .select(`
      id, name, location_type, parent_id, barcode, is_active, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !location) {
    return NextResponse.json({ error: 'Inventory location not found' }, { status: 404 })
  }

  return NextResponse.json(location)
}

/**
 * PATCH /api/inventory/locations/:id
 *
 * Update an inventory location.
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

  const { data: body, error: validationError } = await validateBody(request, updateInventoryLocationSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.location_type !== undefined) updateData.location_type = body.location_type
  if (body.parent_id !== undefined) updateData.parent_id = body.parent_id
  if (body.barcode !== undefined) updateData.barcode = body.barcode
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data: location, error } = await supabase
    .from('inventory_locations')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, location_type, parent_id, barcode, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!location) {
    return NextResponse.json({ error: 'Inventory location not found' }, { status: 404 })
  }

  return NextResponse.json(location)
}

/**
 * DELETE /api/inventory/locations/:id
 *
 * Delete an inventory location.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
    .from('inventory_locations')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
