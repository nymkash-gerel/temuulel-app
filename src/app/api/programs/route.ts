import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { validateBody, createProgramSchema, parsePagination } from '@/lib/validations'

const PROGRAM_TYPES = ['course', 'workshop', 'seminar', 'certification', 'tutoring'] as const

/**
 * GET /api/programs
 *
 * List programs for the authenticated user's store.
 * Supports filtering by is_active and program_type.
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
  const isActive = searchParams.get('is_active')
  const programType = searchParams.get('program_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('programs')
    .select(`
      id, name, description, program_type, duration_weeks, price, max_students, is_active, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }

  if (programType && PROGRAM_TYPES.includes(programType as typeof PROGRAM_TYPES[number])) {
    query = query.eq('program_type', programType as typeof PROGRAM_TYPES[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/programs
 *
 * Create a new program for the store.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

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

  const { data: body, error: validationError } = await validateBody(request, createProgramSchema)
  if (validationError) return validationError

  const { data: program, error } = await supabase
    .from('programs')
    .insert({
      store_id: store.id,
      name: body.name,
      description: body.description || null,
      program_type: body.program_type || undefined,
      duration_weeks: body.duration_weeks || null,
      price: body.price || null,
      max_students: body.max_students || null,
      is_active: body.is_active ?? true,
    })
    .select('id, name, description, program_type, duration_weeks, price, max_students, is_active, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(program, { status: 201 })
}
