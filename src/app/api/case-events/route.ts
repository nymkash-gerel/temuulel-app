import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createCaseEventSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/case-events
 *
 * List case events for the store. Supports filtering by case_id, event_type, date range.
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
  const caseId = searchParams.get('case_id')
  const eventType = searchParams.get('event_type')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const { limit, offset } = parsePagination(searchParams)

  const validEventTypes = ['hearing', 'filing_deadline', 'consultation', 'court_date', 'deposition', 'mediation'] as const

  let query = supabase
    .from('case_events')
    .select(`
      id, case_id, event_type, title, scheduled_at, location, outcome, notes, created_at, updated_at,
      legal_cases(id, case_number, title)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (eventType && validEventTypes.includes(eventType as typeof validEventTypes[number])) {
    query = query.eq('event_type', eventType as typeof validEventTypes[number])
  }

  if (dateFrom) {
    query = query.gte('scheduled_at', dateFrom)
  }

  if (dateTo) {
    query = query.lte('scheduled_at', dateTo)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/case-events
 *
 * Create a new case event.
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

  const { data: body, error: validationError } = await validateBody(request, createCaseEventSchema)
  if (validationError) return validationError

  const { data: caseEvent, error } = await supabase
    .from('case_events')
    .insert({
      store_id: store.id,
      case_id: body.case_id,
      event_type: body.event_type || undefined,
      title: body.title,
      scheduled_at: body.scheduled_at,
      location: body.location || null,
      outcome: body.outcome || null,
      notes: body.notes || null,
    })
    .select(`
      id, case_id, event_type, title, scheduled_at, location, outcome, notes, created_at, updated_at,
      legal_cases(id, case_number, title)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(caseEvent, { status: 201 })
}
