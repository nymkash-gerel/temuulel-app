import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createInventoryLocationSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/inventory/locations
 *
 * List inventory locations for the store. Supports filtering by is_active, location_type.
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
  const locationType = searchParams.get('location_type')
  const { limit, offset } = parsePagination(searchParams)

  const validLocationTypes = ['warehouse', 'shelf', 'bin', 'display', 'backroom'] as const

  let query = supabase
    .from('inventory_locations')
    .select(`
      id, name, location_type, parent_id, barcode, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }

  if (locationType && validLocationTypes.includes(locationType as typeof validLocationTypes[number])) {
    query = query.eq('location_type', locationType as typeof validLocationTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/inventory/locations
 *
 * Create a new inventory location.
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

  const { data: body, error: validationError } = await validateBody(request, createInventoryLocationSchema)
  if (validationError) return validationError

  const { data: location, error } = await supabase
    .from('inventory_locations')
    .insert({
      store_id: store.id,
      name: body.name,
      location_type: body.location_type || undefined,
      parent_id: body.parent_id || null,
      barcode: body.barcode || null,
    })
    .select(`
      id, name, location_type, parent_id, barcode, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(location, { status: 201 })
}
