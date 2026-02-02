import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createLabResultSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/lab-results
 *
 * List lab results. Filter by order_id or patient_id.
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
  const order_id = searchParams.get('order_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('lab_results')
    .select(`
      id, order_id, result_data, interpretation, report_url,
      resulted_by, resulted_at, reviewed_by, reviewed_at, created_at, updated_at,
      lab_orders(id, test_name, test_code, patient_id, urgency, order_type)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (order_id) {
    query = query.eq('order_id', order_id)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/lab-results
 *
 * Record results for a lab order.
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

  const { data: body, error: validationError } = await validateBody(request, createLabResultSchema)
  if (validationError) return validationError

  // Verify lab order belongs to store
  const { data: order } = await supabase
    .from('lab_orders')
    .select('id')
    .eq('id', body.order_id)
    .eq('store_id', store.id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Lab order not found' }, { status: 404 })
  }

  const { data: result, error } = await supabase
    .from('lab_results')
    .insert({
      store_id: store.id,
      order_id: body.order_id,
      result_data: (body.result_data || []) as unknown as Json,
      interpretation: body.interpretation || null,
      report_url: body.report_url || null,
      resulted_by: body.resulted_by || null,
      resulted_at: body.resulted_at || new Date().toISOString(),
    })
    .select(`
      id, order_id, result_data, interpretation, report_url,
      resulted_by, resulted_at, reviewed_by, reviewed_at, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-update lab order status to completed
  await supabase
    .from('lab_orders')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', body.order_id)
    .eq('store_id', store.id)

  return NextResponse.json(result, { status: 201 })
}
