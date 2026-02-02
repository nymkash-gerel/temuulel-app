import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateCaseEventSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/case-events/:id
 *
 * Get a single case event by id.
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

  const { data: caseEvent, error } = await supabase
    .from('case_events')
    .select(`
      id, case_id, event_type, title, scheduled_at, location, outcome, notes, created_at, updated_at,
      legal_cases(id, case_number, title)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !caseEvent) {
    return NextResponse.json({ error: 'Case event not found' }, { status: 404 })
  }

  return NextResponse.json(caseEvent)
}

/**
 * PATCH /api/case-events/:id
 *
 * Update a case event.
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

  const { data: body, error: validationError } = await validateBody(request, updateCaseEventSchema)
  if (validationError) return validationError

  const { data: caseEvent, error } = await supabase
    .from('case_events')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, case_id, event_type, title, scheduled_at, location, outcome, notes, created_at, updated_at,
      legal_cases(id, case_number, title)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!caseEvent) {
    return NextResponse.json({ error: 'Case event not found' }, { status: 404 })
  }

  return NextResponse.json(caseEvent)
}

/**
 * DELETE /api/case-events/:id
 *
 * Delete a case event.
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
    .from('case_events')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
