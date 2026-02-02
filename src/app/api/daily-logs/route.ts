import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createDailyLogSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/daily-logs
 *
 * List daily logs for the store. Supports filtering by project_id, log_date.
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
  const projectId = searchParams.get('project_id')
  const logDate = searchParams.get('log_date')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('daily_logs')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('log_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (logDate) {
    query = query.eq('log_date', logDate)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/daily-logs
 *
 * Create a new daily log.
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

  const { data: body, error: validationError } = await validateBody(request, createDailyLogSchema)
  if (validationError) return validationError

  const { data: dailyLog, error } = await supabase
    .from('daily_logs')
    .insert({
      store_id: store.id,
      project_id: body.project_id,
      log_date: body.log_date || undefined,
      weather: body.weather || null,
      work_completed: body.work_completed || null,
      issues: body.issues || null,
      author_id: body.author_id || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(dailyLog, { status: 201 })
}
