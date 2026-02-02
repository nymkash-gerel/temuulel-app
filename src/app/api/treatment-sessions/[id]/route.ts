import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateTreatmentSessionSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/treatment-sessions/:id
 *
 * Get a single treatment session by id.
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

  const { data: session, error } = await supabase
    .from('treatment_sessions')
    .select(`
      id, treatment_plan_id, appointment_id, session_number, status, notes, results, performed_at, created_at,
      treatment_plans(id, name),
      appointments(id)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Treatment session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}

/**
 * PATCH /api/treatment-sessions/:id
 *
 * Update a treatment session.
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

  const { data: body, error: validationError } = await validateBody(request, updateTreatmentSessionSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) updateData.status = body.status
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.results !== undefined) updateData.results = body.results
  if (body.performed_at !== undefined) updateData.performed_at = body.performed_at

  const { data: session, error } = await supabase
    .from('treatment_sessions')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, treatment_plan_id, appointment_id, session_number, status, notes, results, performed_at, created_at,
      treatment_plans(id, name),
      appointments(id)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Treatment session not found' }, { status: 404 })
  }

  return NextResponse.json(session)
}
