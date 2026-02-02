import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createClientPreferencesSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/client-preferences
 *
 * List client preferences for the store.
 * Supports filtering by customer_id, skin_type, hair_type.
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
  const customerId = searchParams.get('customer_id')
  const skinType = searchParams.get('skin_type')
  const hairType = searchParams.get('hair_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('client_preferences')
    .select(`
      id, customer_id, skin_type, hair_type, allergies, preferred_staff_id,
      color_history, notes, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const validSkinTypes = ['oily', 'dry', 'combination', 'normal', 'sensitive'] as const
  if (skinType && validSkinTypes.includes(skinType as typeof validSkinTypes[number])) {
    query = query.eq('skin_type', skinType as typeof validSkinTypes[number])
  }

  const validHairTypes = ['straight', 'wavy', 'curly', 'coily', 'fine', 'thick'] as const
  if (hairType && validHairTypes.includes(hairType as typeof validHairTypes[number])) {
    query = query.eq('hair_type', hairType as typeof validHairTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/client-preferences
 *
 * Create or upsert client preferences. Uses upsert with onConflict: 'store_id,customer_id'.
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

  const { data: body, error: validationError } = await validateBody(request, createClientPreferencesSchema)
  if (validationError) return validationError

  // Verify customer belongs to store
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', body.customer_id)
    .eq('store_id', store.id)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Verify preferred staff belongs to store if provided
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

  const { data: preferences, error } = await supabase
    .from('client_preferences')
    .upsert({
      store_id: store.id,
      customer_id: body.customer_id,
      skin_type: body.skin_type || null,
      hair_type: body.hair_type || null,
      allergies: body.allergies || [],
      preferred_staff_id: body.preferred_staff_id || null,
      color_history: (body.color_history || []) as unknown as Json,
      notes: body.notes || null,
    }, { onConflict: 'store_id,customer_id' })
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

  return NextResponse.json(preferences, { status: 201 })
}
