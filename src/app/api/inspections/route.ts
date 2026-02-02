import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createInspectionSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/inspections
 *
 * List inspections for the store. Supports filtering by result, inspection_type, project_id.
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
  const result = searchParams.get('result')
  const inspectionType = searchParams.get('inspection_type')
  const projectId = searchParams.get('project_id')
  const { limit, offset } = parsePagination(searchParams)

  const validResults = ['pass', 'fail', 'partial', 'pending'] as const

  let query = supabase
    .from('inspections')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('scheduled_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (result && validResults.includes(result as typeof validResults[number])) {
    query = query.eq('result', result as typeof validResults[number])
  }

  if (inspectionType) {
    query = query.eq('inspection_type', inspectionType)
  }

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/inspections
 *
 * Create a new inspection.
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

  const { data: body, error: validationError } = await validateBody(request, createInspectionSchema)
  if (validationError) return validationError

  const { data: inspection, error } = await supabase
    .from('inspections')
    .insert({
      store_id: store.id,
      project_id: body.project_id,
      inspection_type: body.inspection_type || undefined,
      inspector_name: body.inspector_name,
      scheduled_date: body.scheduled_date,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(inspection, { status: 201 })
}
