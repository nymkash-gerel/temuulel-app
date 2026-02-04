import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateClientPreferencesSchema } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/client-preferences/:id
 *
 * Get a single client preferences record by id with joins.
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

  const { data: preferences, error } = await supabase
    .from('client_preferences')
    .select(`
      id, customer_id, skin_type, hair_type, allergies, preferred_staff_id,
      color_history, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !preferences) {
    return NextResponse.json({ error: 'Client preferences not found' }, { status: 404 })
  }

  return NextResponse.json(preferences)
}

/**
 * PATCH /api/client-preferences/:id
 *
 * Update client preferences.
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

  const { data: body, error: validationError } = await validateBody(request, updateClientPreferencesSchema)
  if (validationError) return validationError

  // Verify preferred staff belongs to store if being updated
  if (body.preferred_staff_id) {
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id')
      .eq('id', body.preferred_staff_id)
      .eq('store_id', store.id)
      .single()

    if (!staffMember) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.skin_type !== undefined) updateData.skin_type = body.skin_type
  if (body.hair_type !== undefined) updateData.hair_type = body.hair_type
  if (body.allergies !== undefined) updateData.allergies = body.allergies
  if (body.preferred_staff_id !== undefined) updateData.preferred_staff_id = body.preferred_staff_id
  if (body.color_history !== undefined) updateData.color_history = toJson(body.color_history)
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data: preferences, error } = await supabase
    .from('client_preferences')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, customer_id, skin_type, hair_type, allergies, preferred_staff_id,
      color_history, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!preferences) {
    return NextResponse.json({ error: 'Client preferences not found' }, { status: 404 })
  }

  return NextResponse.json(preferences)
}
