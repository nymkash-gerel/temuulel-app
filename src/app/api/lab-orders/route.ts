import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createLabOrderSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/lab-orders
 *
 * List lab/imaging orders for the store.
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
  const urgency = searchParams.get('urgency')
  const patient_id = searchParams.get('patient_id')
  const order_type = searchParams.get('order_type')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('lab_orders')
    .select(`
      id, patient_id, encounter_id, ordered_by, order_type, test_name, test_code,
      urgency, specimen_type, collection_time, status, notes, created_at, updated_at,
      patients(id, first_name, last_name),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const validStatuses = ['ordered', 'collected', 'processing', 'completed', 'cancelled'] as const
  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status)
  }

  const validUrgencies = ['routine', 'urgent', 'stat'] as const
  if (urgency && validUrgencies.includes(urgency as typeof validUrgencies[number])) {
    query = query.eq('urgency', urgency)
  }

  if (patient_id) {
    query = query.eq('patient_id', patient_id)
  }

  const validTypes = ['lab', 'imaging', 'other'] as const
  if (order_type && validTypes.includes(order_type as typeof validTypes[number])) {
    query = query.eq('order_type', order_type)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/lab-orders
 *
 * Create a new lab/imaging order.
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

  const { data: body, error: validationError } = await validateBody(request, createLabOrderSchema)
  if (validationError) return validationError

  // Verify patient belongs to store
  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', body.patient_id)
    .eq('store_id', store.id)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const { data: labOrder, error } = await supabase
    .from('lab_orders')
    .insert({
      store_id: store.id,
      patient_id: body.patient_id,
      encounter_id: body.encounter_id || null,
      ordered_by: body.ordered_by || null,
      order_type: body.order_type || 'lab',
      test_name: body.test_name,
      test_code: body.test_code || null,
      urgency: body.urgency || 'routine',
      specimen_type: body.specimen_type || null,
      collection_time: body.collection_time || null,
      notes: body.notes || null,
    })
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

  return NextResponse.json(labOrder, { status: 201 })
}
