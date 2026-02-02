import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateBlockSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/blocks/:id
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
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

  const { data: block, error } = await supabase
    .from('blocks')
    .select(`
      id, staff_id, resource_id, start_at, end_at, reason, block_type, recurring, created_at, updated_at,
      staff(id, name),
      bookable_resources(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !block) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  }

  return NextResponse.json(block)
}

/**
 * PATCH /api/blocks/:id
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
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

  const { data: body, error: validationError } = await validateBody(request, updateBlockSchema)
  if (validationError) return validationError

  // Validate time range if both provided
  if (body.start_at && body.end_at && new Date(body.end_at) <= new Date(body.start_at)) {
    return NextResponse.json({ error: 'end_at must be after start_at' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (body.staff_id !== undefined) updateData.staff_id = body.staff_id || null
  if (body.resource_id !== undefined) updateData.resource_id = body.resource_id || null
  if (body.start_at !== undefined) updateData.start_at = body.start_at
  if (body.end_at !== undefined) updateData.end_at = body.end_at
  if (body.reason !== undefined) updateData.reason = body.reason || null
  if (body.block_type !== undefined) updateData.block_type = body.block_type
  if (body.recurring !== undefined) updateData.recurring = body.recurring || null

  const { data: block, error } = await supabase
    .from('blocks')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, staff_id, resource_id, start_at, end_at, reason, block_type, recurring, created_at, updated_at,
      staff(id, name),
      bookable_resources(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!block) {
    return NextResponse.json({ error: 'Block not found' }, { status: 404 })
  }

  return NextResponse.json(block)
}

/**
 * DELETE /api/blocks/:id
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
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
    .from('blocks')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
