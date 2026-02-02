import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createServiceAreaSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/service-areas
 *
 * List service areas for the authenticated user's store.
 * Supports filtering by is_active.
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
    .from('service_areas')
    .select(`
      id, name, description, zip_codes, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/service-areas
 *
 * Create a new service area.
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

  const { data: body, error: validationError } = await validateBody(request, createServiceAreaSchema)
  if (validationError) return validationError

  const { data: item, error } = await supabase
    .from('service_areas')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description || null,
      zip_codes: body.zip_codes || null,
      is_active: body.is_active ?? true,
    })
    .select(`
      id, name, description, zip_codes, is_active, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
