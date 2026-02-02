import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPhotoSessionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/photo-sessions
 *
 * List photo sessions for the store. Supports filtering by status, session_type, customer_id.
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
  const status = searchParams.get('status')
  const sessionType = searchParams.get('session_type')
  const customerId = searchParams.get('customer_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'] as const

  let query = supabase
    .from('photo_sessions')
    .select(`
      id, customer_id, photographer_id, session_type, location, scheduled_at, duration_minutes, total_amount, deposit_amount, notes, status, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (sessionType) {
    query = query.eq('session_type', sessionType)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/photo-sessions
 *
 * Create a new photo session.
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

  const { data: body, error: validationError } = await validateBody(request, createPhotoSessionSchema)
  if (validationError) return validationError

  const { data: session, error } = await supabase
    .from('photo_sessions')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      photographer_id: body.photographer_id || null,
      session_type: body.session_type || undefined,
      location: body.location || null,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes || undefined,
      total_amount: body.total_amount || null,
      deposit_amount: body.deposit_amount || null,
      notes: body.notes || null,
    })
    .select(`
      id, customer_id, photographer_id, session_type, location, scheduled_at, duration_minutes, total_amount, deposit_amount, notes, status, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(session, { status: 201 })
}
