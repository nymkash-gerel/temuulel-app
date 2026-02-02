import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTableLayoutSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/table-layouts
 *
 * List table layouts for the authenticated user's store.
 * Supports filtering by status, is_active, section.
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
  const isActive = searchParams.get('is_active')
  const section = searchParams.get('section')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('table_layouts')
    .select(`
      id, name, section, capacity, shape,
      position_x, position_y, status, is_active,
      created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }
  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }
  if (section) {
    query = query.eq('section', section)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/table-layouts
 *
 * Create a new table layout.
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

  const { data: body, error: validationError } = await validateBody(request, createTableLayoutSchema)
  if (validationError) return validationError

  const { data: item, error } = await supabase
    .from('table_layouts')
    .insert({
      store_id: store.id,
      name: body.name,
      section: body.section || null,
      capacity: body.capacity || undefined,
      shape: body.shape || undefined,
      position_x: body.position_x ?? undefined,
      position_y: body.position_y ?? undefined,
      is_active: body.is_active ?? true,
      status: 'available',
    })
    .select(`
      id, name, section, capacity, shape,
      position_x, position_y, status, is_active, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
