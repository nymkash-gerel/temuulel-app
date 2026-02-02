import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createConsultationSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/consultations
 *
 * List consultations for the store. Supports filtering by consultation_type, status, customer_id, consultant_id.
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
  const consultationType = searchParams.get('consultation_type')
  const status = searchParams.get('status')
  const customerId = searchParams.get('customer_id')
  const consultantId = searchParams.get('consultant_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'] as const

  let query = supabase
    .from('consultations')
    .select(`
      id, customer_id, consultant_id, consultation_type, scheduled_at, duration_minutes, status, fee, location, meeting_url, notes, follow_up_date, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (consultationType) {
    query = query.eq('consultation_type', consultationType)
  }

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (consultantId) {
    query = query.eq('consultant_id', consultantId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/consultations
 *
 * Create a new consultation.
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

  const { data: body, error: validationError } = await validateBody(request, createConsultationSchema)
  if (validationError) return validationError

  const { data: consultation, error } = await supabase
    .from('consultations')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      consultant_id: body.consultant_id || null,
      consultation_type: body.consultation_type || undefined,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes || undefined,
      fee: body.fee || null,
      location: body.location || null,
      meeting_url: body.meeting_url || null,
      notes: body.notes || null,
      follow_up_date: body.follow_up_date || null,
    })
    .select(`
      id, customer_id, consultant_id, consultation_type, scheduled_at, duration_minutes, status, fee, location, meeting_url, notes, follow_up_date, created_at, updated_at,
      customers(id, name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: consultation }, { status: 201 })
}
