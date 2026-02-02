import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createMenuCategorySchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/menu-categories
 *
 * List menu categories for the authenticated user's store.
 * Supports pagination.
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
  const { limit, offset } = parsePagination(searchParams)

  const { data, count, error } = await supabase
    .from('menu_categories')
    .select(`
      id, name, description, image_url, sort_order, is_active,
      available_from, available_until, created_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('sort_order', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/menu-categories
 *
 * Create a new menu category.
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

  const { data: body, error: validationError } = await validateBody(request, createMenuCategorySchema)
  if (validationError) return validationError

  const { data: category, error } = await supabase
    .from('menu_categories')
    .insert({
      store_id: store.id,
      ...body,
    })
    .select(`
      id, name, description, image_url, sort_order, is_active,
      available_from, available_until, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(category, { status: 201 })
}
