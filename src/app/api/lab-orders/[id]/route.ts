import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLabOrderSchema } from '@/lib/validations'
import { validateTransition, labOrderTransitions } from '@/lib/status-machine'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/lab-orders/:id
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

  const { data: labOrder, error } = await supabase
    .from('lab_orders')
    .select(`
      id, patient_id, encounter_id, ordered_by, order_type, test_name, test_code,
      urgency, specimen_type, collection_time, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !labOrder) {
    return NextResponse.json({ error: 'Lab order not found' }, { status: 404 })
  }

  return NextResponse.json(labOrder)
}

/**
 * PATCH /api/lab-orders/:id
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

  const { data: body, error: validationError } = await validateBody(request, updateLabOrderSchema)
  if (validationError) return validationError

  // Validate status transition if status is being changed
  if (body.status !== undefined) {
    const { data: current } = await supabase
      .from('lab_orders')
      .select('status')
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!current) {
      return NextResponse.json({ error: 'Lab order not found' }, { status: 404 })
    }

    const result = validateTransition(labOrderTransitions, current.status, body.status)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.specimen_type !== undefined) updateData.specimen_type = body.specimen_type
  if (body.collection_time !== undefined) updateData.collection_time = body.collection_time
  if (body.notes !== undefined) updateData.notes = body.notes

  const { data: labOrder, error } = await supabase
    .from('lab_orders')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, patient_id, encounter_id, ordered_by, order_type, test_name, test_code,
      urgency, specimen_type, collection_time, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!labOrder) {
    return NextResponse.json({ error: 'Lab order not found' }, { status: 404 })
  }

  return NextResponse.json(labOrder)
}

/**
 * DELETE /api/lab-orders/:id
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
    .from('lab_orders')
    .delete()
    .eq('id', id)
    .eq('store_id', store.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
