import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateMembershipSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/memberships/:id
 *
 * Get a single membership by id.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
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

  const { data: membership, error } = await supabase
    .from('memberships')
    .select(`
      id, name, description, price, billing_period, benefits,
      is_active, created_at, updated_at
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  return NextResponse.json(membership)
}

/**
 * PATCH /api/memberships/:id
 *
 * Update a membership plan.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

  const { data: body, error: validationError } = await validateBody(request, updateMembershipSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description || null
  if (body.price !== undefined) updateData.price = body.price
  if (body.billing_period !== undefined) updateData.billing_period = body.billing_period
  if (body.benefits !== undefined) updateData.benefits = body.benefits as Json
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data: membership, error } = await supabase
    .from('memberships')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, description, price, billing_period, benefits,
      is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  return NextResponse.json(membership)
}

/**
 * DELETE /api/memberships/:id
 *
 * Delete a membership plan.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
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
    .from('memberships')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
