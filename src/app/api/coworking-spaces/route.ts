import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createCoworkingSpaceSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/coworking-spaces
 *
 * List coworking spaces for the store. Supports filtering by space_type, is_active.
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
  const spaceType = searchParams.get('space_type')
  const isActive = searchParams.get('is_active')
  const { limit, offset } = parsePagination(searchParams)

  const validSpaceTypes = ['hot_desk', 'dedicated_desk', 'private_office', 'meeting_room', 'event_space', 'phone_booth'] as const

  let query = supabase
    .from('coworking_spaces')
    .select(`
      id, name, space_type, capacity, hourly_rate, daily_rate, monthly_rate, amenities, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (spaceType && validSpaceTypes.includes(spaceType as typeof validSpaceTypes[number])) {
    query = query.eq('space_type', spaceType as typeof validSpaceTypes[number])
  }

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
 * POST /api/coworking-spaces
 *
 * Create a new coworking space.
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

  const { data: body, error: validationError } = await validateBody(request, createCoworkingSpaceSchema)
  if (validationError) return validationError

  const { data: space, error } = await supabase
    .from('coworking_spaces')
    .insert({
      store_id: store.id,
      name: body.name,
      space_type: body.space_type || undefined,
      capacity: body.capacity || undefined,
      hourly_rate: body.hourly_rate || null,
      daily_rate: body.daily_rate || null,
      monthly_rate: body.monthly_rate || null,
      amenities: (body.amenities || []) as unknown as Json,
      is_active: body.is_active ?? true,
    })
    .select(`
      id, name, space_type, capacity, hourly_rate, daily_rate, monthly_rate, amenities, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(space, { status: 201 })
}
