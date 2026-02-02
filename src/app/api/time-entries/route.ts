import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTimeEntrySchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/time-entries
 *
 * List time entries for the store. Supports filtering by case_id, staff_id, is_billable, date range.
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
  const staffId = searchParams.get('staff_id')
  const isBillable = searchParams.get('is_billable')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('time_entries')
    .select(`
      id, case_id, staff_id, description, hours, billable_rate, is_billable, entry_date, created_at, updated_at,
      legal_cases(id, case_number, title),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('entry_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (staffId) {
    query = query.eq('staff_id', staffId)
  }

  if (isBillable === 'true' || isBillable === 'false') {
    query = query.eq('is_billable', isBillable === 'true')
  }

  if (dateFrom) {
    query = query.gte('entry_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('entry_date', dateTo)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/time-entries
 *
 * Create a new time entry.
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

  const { data: body, error: validationError } = await validateBody(request, createTimeEntrySchema)
  if (validationError) return validationError

  const { data: timeEntry, error } = await supabase
    .from('time_entries')
    .insert({
      store_id: store.id,
      case_id: body.case_id,
      staff_id: body.staff_id || null,
      description: body.description,
      hours: body.hours,
      billable_rate: body.billable_rate || undefined,
      is_billable: body.is_billable ?? true,
      entry_date: body.entry_date || undefined,
    })
    .select(`
      id, case_id, staff_id, description, hours, billable_rate, is_billable, entry_date, created_at, updated_at,
      legal_cases(id, case_number, title),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(timeEntry, { status: 201 })
}
