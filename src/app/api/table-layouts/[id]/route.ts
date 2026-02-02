import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateTableLayoutSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/table-layouts/[id]
 *
 * Get a single table layout.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
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

  const { data, error } = await supabase
    .from('table_layouts')
    .select('*')
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Table layout not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/table-layouts/[id]
 *
 * Update a table layout.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
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

  const { data: body, error: validationError } = await validateBody(request, updateTableLayoutSchema)
  if (validationError) return validationError

  const { data: item, error } = await supabase
    .from('table_layouts')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, section, capacity, shape,
      position_x, position_y, status, is_active,
      created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!item) {
    return NextResponse.json({ error: 'Table layout not found' }, { status: 404 })
  }

  return NextResponse.json(item)
}

/**
 * DELETE /api/table-layouts/[id]
 *
 * Delete a table layout.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
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
    .from('table_layouts')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
