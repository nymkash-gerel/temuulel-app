import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createVenueSchema, parsePagination } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

/**
 * GET /api/venues
 *
 * List venues for the store. Supports filtering by is_active.
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
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('venues')
    .select(`
      id, name, description, capacity, hourly_rate, daily_rate, amenities, images, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (isActive !== null && isActive !== undefined) {
    query = query.eq('is_active', isActive === 'true')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/venues
 *
 * Create a new venue.
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

  const { data: body, error: validationError } = await validateBody(request, createVenueSchema)
  if (validationError) return validationError

  const { data: venue, error } = await supabase
    .from('venues')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description || null,
      capacity: body.capacity || undefined,
      hourly_rate: body.hourly_rate || null,
      daily_rate: body.daily_rate || null,
      amenities: toJson(body.amenities || []),
      is_active: body.is_active ?? true,
    })
    .select(`
      id, name, description, capacity, hourly_rate, daily_rate, amenities, images, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(venue, { status: 201 })
}
