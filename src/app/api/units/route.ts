import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createUnitSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/units
 *
 * List units for the store. Supports filtering by status, unit_type.
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
  const unitType = searchParams.get('unit_type')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['available', 'occupied', 'maintenance', 'blocked'] as const
  const validUnitTypes = ['standard', 'deluxe', 'suite', 'penthouse', 'dormitory', 'cabin', 'apartment'] as const

  let query = supabase
    .from('units')
    .select(`
      id, unit_number, unit_type, floor, max_occupancy, base_rate, amenities, images, status, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (unitType && validUnitTypes.includes(unitType as typeof validUnitTypes[number])) {
    query = query.eq('unit_type', unitType as typeof validUnitTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/units
 *
 * Create a new unit.
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

  const { data: body, error: validationError } = await validateBody(request, createUnitSchema)
  if (validationError) return validationError

  const { data: unit, error } = await supabase
    .from('units')
    .insert({
      store_id: store.id,
      unit_number: body.unit_number,
      unit_type: body.unit_type || undefined,
      resource_id: body.resource_id || null,
      floor: body.floor || null,
      max_occupancy: body.max_occupancy || undefined,
      base_rate: body.base_rate,
      amenities: (body.amenities || []) as unknown as Json,
      images: (body.images || []) as unknown as Json,
      status: body.status || undefined,
    })
    .select(`
      id, unit_number, unit_type, floor, max_occupancy, base_rate, amenities, images, status, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(unit, { status: 201 })
}
