import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPetSchema, parsePagination } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

/**
 * GET /api/pets
 *
 * List pets for the authenticated user's store.
 * Supports filtering by species and is_active.
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
  const species = searchParams.get('species')
  const isActive = searchParams.get('is_active')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('pets')
    .select(`
      id, name, species, breed, weight, date_of_birth, medical_notes, vaccinations, is_active, created_at, updated_at,
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (species) {
    query = query.eq('species', species)
  }
  if (isActive !== null && isActive !== undefined) {
    query = query.eq('is_active', isActive === 'true')
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/pets
 *
 * Create a new pet for the store.
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

  const { data: body, error: validationError } = await validateBody(request, createPetSchema)
  if (validationError) return validationError

  const { data: pet, error } = await supabase
    .from('pets')
    .insert({
      store_id: store.id,
      name: body.name,
      customer_id: body.customer_id || null,
      species: body.species || undefined,
      breed: body.breed || null,
      weight: body.weight || null,
      date_of_birth: body.date_of_birth || null,
      medical_notes: body.medical_notes || null,
      vaccinations: toJson(body.vaccinations || []),
      is_active: body.is_active ?? true,
    })
    .select(`
      id, name, species, breed, weight, date_of_birth, medical_notes, vaccinations, is_active, created_at, updated_at,
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(pet, { status: 201 })
}
