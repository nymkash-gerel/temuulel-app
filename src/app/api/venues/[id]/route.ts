import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateVenueSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/venues/:id
 *
 * Get a single venue by id.
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

  const { data: venue, error } = await supabase
    .from('venues')
    .select(`
      id, name, description, capacity, hourly_rate, daily_rate, amenities, images, is_active, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
  }

  return NextResponse.json(venue)
}

/**
 * PATCH /api/venues/:id
 *
 * Update a venue.
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

  const { data: body, error: validationError } = await validateBody(request, updateVenueSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.capacity !== undefined) updateData.capacity = body.capacity
  if (body.hourly_rate !== undefined) updateData.hourly_rate = body.hourly_rate
  if (body.daily_rate !== undefined) updateData.daily_rate = body.daily_rate
  if (body.amenities !== undefined) updateData.amenities = body.amenities as unknown as Json
  if (body.images !== undefined) updateData.images = body.images as unknown as Json
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data: venue, error } = await supabase
    .from('venues')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, description, capacity, hourly_rate, daily_rate, amenities, images, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!venue) {
    return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
  }

  return NextResponse.json(venue)
}

/**
 * DELETE /api/venues/:id
 *
 * Delete a venue.
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
    .from('venues')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
