import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createBlockSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/blocks
 *
 * List blocks for the store. Supports filtering by staff_id, resource_id, block_type.
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
  const staffId = searchParams.get('staff_id')
  const resourceId = searchParams.get('resource_id')
  const blockType = searchParams.get('block_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('blocks')
    .select(`
      id, staff_id, resource_id, start_at, end_at, reason, block_type, recurring, created_at, updated_at,
      staff(id, name),
      bookable_resources(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('start_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (staffId) {
    query = query.eq('staff_id', staffId)
  }
  if (resourceId) {
    query = query.eq('resource_id', resourceId)
  }
  const validBlockTypes = ['manual', 'break', 'holiday', 'maintenance'] as const
  if (blockType && validBlockTypes.includes(blockType as typeof validBlockTypes[number])) {
    query = query.eq('block_type', blockType as typeof validBlockTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/blocks
 *
 * Create a new block (staff or resource unavailability).
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

  const { data: body, error: validationError } = await validateBody(request, createBlockSchema)
  if (validationError) return validationError

  // Validate end_at > start_at
  if (new Date(body.end_at) <= new Date(body.start_at)) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 })
  }

  // Verify staff belongs to store if provided
  if (body.staff_id) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('id', body.staff_id)
      .eq('store_id', store.id)
      .single()

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }
  }

  // Verify resource belongs to store if provided
  if (body.resource_id) {
    const { data: resource } = await supabase
      .from('bookable_resources')
      .select('id')
      .eq('id', body.resource_id)
      .eq('store_id', store.id)
      .single()

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
    }
  }

  const { data: block, error } = await supabase
    .from('blocks')
    .insert({
      store_id: store.id,
      staff_id: body.staff_id || null,
      resource_id: body.resource_id || null,
      start_at: body.start_at,
      end_at: body.end_at,
      reason: body.reason || null,
      block_type: body.block_type,
      recurring: (body.recurring as Json) || undefined,
    })
    .select(`
      id, staff_id, resource_id, start_at, end_at, reason, block_type, recurring, created_at, updated_at,
      staff(id, name),
      bookable_resources(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(block, { status: 201 })
}
