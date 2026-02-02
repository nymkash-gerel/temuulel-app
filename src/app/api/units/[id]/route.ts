import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateUnitSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/units/:id
 *
 * Get a single unit by id.
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

  const { data: unit, error } = await supabase
    .from('units')
    .select(`
      id, unit_number, unit_type, floor, max_occupancy, base_rate, amenities, images, status, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  return NextResponse.json(unit)
}

/**
 * PATCH /api/units/:id
 *
 * Update a unit.
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

  const { data: body, error: validationError } = await validateBody(request, updateUnitSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.unit_number !== undefined) updateData.unit_number = body.unit_number
  if (body.unit_type !== undefined) updateData.unit_type = body.unit_type
  if (body.resource_id !== undefined) updateData.resource_id = body.resource_id
  if (body.floor !== undefined) updateData.floor = body.floor
  if (body.max_occupancy !== undefined) updateData.max_occupancy = body.max_occupancy
  if (body.base_rate !== undefined) updateData.base_rate = body.base_rate
  if (body.amenities !== undefined) updateData.amenities = body.amenities as unknown as Json
  if (body.images !== undefined) updateData.images = body.images as unknown as Json
  if (body.status !== undefined) updateData.status = body.status

  const { data: unit, error } = await supabase
    .from('units')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, unit_number, unit_type, floor, max_occupancy, base_rate, amenities, images, status, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
  }

  return NextResponse.json(unit)
}

/**
 * DELETE /api/units/:id
 *
 * Delete a unit.
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
    .from('units')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
