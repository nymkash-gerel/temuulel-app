import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createModifierGroupSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/modifier-groups
 *
 * List modifier groups for the authenticated user's store.
 * Includes nested modifiers. Supports pagination.
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
    .from('modifier_groups')
    .select(`
      id, name, selection_type, min_selections, max_selections,
      is_required, sort_order, created_at,
      modifiers(id, name, price_adjustment, is_default, is_available, sort_order)
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
 * POST /api/modifier-groups
 *
 * Create a new modifier group with optional inline modifiers.
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

  const { data: body, error: validationError } = await validateBody(request, createModifierGroupSchema)
  if (validationError) return validationError

  const { modifiers: inlineModifiers, ...groupFields } = body

  const { data: group, error } = await supabase
    .from('modifier_groups')
    .insert({
      store_id: store.id,
      ...groupFields,
    })
    .select(`
      id, name, selection_type, min_selections, max_selections,
      is_required, sort_order, created_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Insert inline modifiers if provided
  if (inlineModifiers && inlineModifiers.length > 0) {
    const modifierInserts = inlineModifiers.map((m: { name: string; price_adjustment: number; is_default: boolean; is_available: boolean; sort_order: number }) => ({
      group_id: group.id,
      name: m.name,
      price_adjustment: m.price_adjustment,
      is_default: m.is_default,
      is_available: m.is_available,
      sort_order: m.sort_order,
    }))

    const { error: modError } = await supabase
      .from('modifiers')
      .insert(modifierInserts)

    if (modError) {
      return NextResponse.json({ error: modError.message }, { status: 500 })
    }
  }

  // Re-fetch with nested modifiers
  const { data: result, error: fetchError } = await supabase
    .from('modifier_groups')
    .select(`
      id, name, selection_type, min_selections, max_selections,
      is_required, sort_order, created_at,
      modifiers(id, name, price_adjustment, is_default, is_available, sort_order)
    `)
    .eq('id', group.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(result, { status: 201 })
}
