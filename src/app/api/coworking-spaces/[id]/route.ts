import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateCoworkingSpaceSchema } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/coworking-spaces/:id
 *
 * Get a single coworking space by id.
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

  const { data: space, error } = await supabase
    .from('coworking_spaces')
    .select(`
      id, name, space_type, capacity, hourly_rate, daily_rate, monthly_rate, amenities, is_active, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !space) {
    return NextResponse.json({ error: 'Coworking space not found' }, { status: 404 })
  }

  return NextResponse.json(space)
}

/**
 * PATCH /api/coworking-spaces/:id
 *
 * Update a coworking space.
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

  const { data: body, error: validationError } = await validateBody(request, updateCoworkingSpaceSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.space_type !== undefined) updateData.space_type = body.space_type
  if (body.capacity !== undefined) updateData.capacity = body.capacity
  if (body.hourly_rate !== undefined) updateData.hourly_rate = body.hourly_rate
  if (body.daily_rate !== undefined) updateData.daily_rate = body.daily_rate
  if (body.monthly_rate !== undefined) updateData.monthly_rate = body.monthly_rate
  if (body.amenities !== undefined) updateData.amenities = toJson(body.amenities)
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data: space, error } = await supabase
    .from('coworking_spaces')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, space_type, capacity, hourly_rate, daily_rate, monthly_rate, amenities, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!space) {
    return NextResponse.json({ error: 'Coworking space not found' }, { status: 404 })
  }

  return NextResponse.json(space)
}

/**
 * DELETE /api/coworking-spaces/:id
 *
 * Delete a coworking space.
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
    .from('coworking_spaces')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
