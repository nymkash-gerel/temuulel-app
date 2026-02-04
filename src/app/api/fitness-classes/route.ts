import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createFitnessClassSchema, parsePagination } from '@/lib/validations'
import { toJson } from '@/lib/supabase/json'

/**
 * GET /api/fitness-classes
 *
 * List fitness classes for the store. Supports filtering by class_type, is_active, instructor_id.
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
  const classType = searchParams.get('class_type')
  const isActive = searchParams.get('is_active')
  const instructorId = searchParams.get('instructor_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('fitness_classes')
    .select(`
      id, name, description, class_type, capacity, duration_minutes, schedule, instructor_id, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (classType !== null && classType !== undefined) {
    query = query.eq('class_type', classType)
  }

  if (isActive !== null && isActive !== undefined) {
    query = query.eq('is_active', isActive === 'true')
  }

  if (instructorId !== null && instructorId !== undefined) {
    query = query.eq('instructor_id', instructorId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/fitness-classes
 *
 * Create a new fitness class.
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

  const { data: body, error: validationError } = await validateBody(request, createFitnessClassSchema)
  if (validationError) return validationError

  const { data: fitnessClass, error } = await supabase
    .from('fitness_classes')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description || null,
      class_type: body.class_type || undefined,
      capacity: body.capacity || undefined,
      duration_minutes: body.duration_minutes || undefined,
      schedule: toJson(body.schedule || {}),
      instructor_id: body.instructor_id || null,
      is_active: body.is_active ?? true,
    })
    .select(`
      id, name, description, class_type, capacity, duration_minutes, schedule, instructor_id, is_active, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: fitnessClass }, { status: 201 })
}
