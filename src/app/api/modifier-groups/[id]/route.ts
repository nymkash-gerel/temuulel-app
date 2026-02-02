import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateModifierGroupSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/modifier-groups/[id]
 *
 * Get a single modifier group with its modifiers.
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

  const { data: group, error } = await supabase
    .from('modifier_groups')
    .select(`
      id, name, selection_type, min_selections, max_selections,
      is_required, sort_order, created_at,
      modifiers(id, name, price_adjustment, is_default, is_available, sort_order)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !group) {
    return NextResponse.json({ error: 'Modifier group not found' }, { status: 404 })
  }

  return NextResponse.json(group)
}

/**
 * PATCH /api/modifier-groups/[id]
 *
 * Update a modifier group.
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

  const { data: body, error: validationError } = await validateBody(request, updateModifierGroupSchema)
  if (validationError) return validationError

  const { data: group, error } = await supabase
    .from('modifier_groups')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, selection_type, min_selections, max_selections,
      is_required, sort_order, created_at,
      modifiers(id, name, price_adjustment, is_default, is_available, sort_order)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!group) {
    return NextResponse.json({ error: 'Modifier group not found' }, { status: 404 })
  }

  return NextResponse.json(group)
}

/**
 * DELETE /api/modifier-groups/[id]
 *
 * Delete a modifier group (cascades to modifiers).
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
    .from('modifier_groups')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
