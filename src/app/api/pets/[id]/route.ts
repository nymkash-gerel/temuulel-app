import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updatePetSchema } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/pets/:id
 *
 * Get a single pet by id.
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

  const { data: pet, error } = await supabase
    .from('pets')
    .select(`
      id, name, species, breed, weight, date_of_birth, medical_notes, vaccinations, is_active, created_at, updated_at,
      customers(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !pet) {
    return NextResponse.json({ error: 'Pet not found' }, { status: 404 })
  }

  return NextResponse.json(pet)
}

/**
 * PATCH /api/pets/:id
 *
 * Update a pet.
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

  const { data: body, error: validationError } = await validateBody(request, updatePetSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.customer_id !== undefined) updateData.customer_id = body.customer_id
  if (body.name !== undefined) updateData.name = body.name
  if (body.species !== undefined) updateData.species = body.species
  if (body.breed !== undefined) updateData.breed = body.breed
  if (body.weight !== undefined) updateData.weight = body.weight
  if (body.date_of_birth !== undefined) updateData.date_of_birth = body.date_of_birth
  if (body.medical_notes !== undefined) updateData.medical_notes = body.medical_notes
  if (body.vaccinations !== undefined) updateData.vaccinations = body.vaccinations as unknown as Json
  if (body.is_active !== undefined) updateData.is_active = body.is_active

  const { data: pet, error } = await supabase
    .from('pets')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, name, species, breed, weight, date_of_birth, medical_notes, vaccinations, is_active, created_at, updated_at,
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!pet) {
    return NextResponse.json({ error: 'Pet not found' }, { status: 404 })
  }

  return NextResponse.json(pet)
}

/**
 * DELETE /api/pets/:id
 *
 * Delete a pet.
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
    .from('pets')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
