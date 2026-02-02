import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createPermitSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/permits
 *
 * List permits for the store. Supports filtering by status, permit_type, project_id.
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
  const permitType = searchParams.get('permit_type')
  const projectId = searchParams.get('project_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['applied', 'approved', 'expired', 'rejected'] as const

  let query = supabase
    .from('permits')
    .select('*', { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (permitType) {
    query = query.eq('permit_type', permitType)
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
 * POST /api/permits
 *
 * Create a new permit.
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

  const { data: body, error: validationError } = await validateBody(request, createPermitSchema)
  if (validationError) return validationError

  const { data: permit, error } = await supabase
    .from('permits')
    .insert({
      store_id: store.id,
      project_id: body.project_id,
      permit_type: body.permit_type || undefined,
      permit_number: body.permit_number || null,
      issued_date: body.issued_date || null,
      expiry_date: body.expiry_date || null,
      cost: body.cost ?? null,
      notes: body.notes || null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(permit, { status: 201 })
}
