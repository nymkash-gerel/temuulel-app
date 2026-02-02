import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateLabResultSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/lab-results/:id
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

  const { data: result, error } = await supabase
    .from('lab_results')
    .select(`
      id, order_id, result_data, interpretation, report_url,
      resulted_by, resulted_at, reviewed_by, reviewed_at, created_at, updated_at,
      lab_orders(id, test_name, test_code, patient_id, urgency, order_type,
        patients(id, first_name, last_name))
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !result) {
    return NextResponse.json({ error: 'Lab result not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

/**
 * PATCH /api/lab-results/:id
 *
 * Update lab result (review, add interpretation).
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

  const { data: body, error: validationError } = await validateBody(request, updateLabResultSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.interpretation !== undefined) updateData.interpretation = body.interpretation
  if (body.report_url !== undefined) updateData.report_url = body.report_url
  if (body.reviewed_by !== undefined) updateData.reviewed_by = body.reviewed_by
  if (body.reviewed_at !== undefined) updateData.reviewed_at = body.reviewed_at

  const { data: result, error } = await supabase
    .from('lab_results')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, order_id, result_data, interpretation, report_url,
      resulted_by, resulted_at, reviewed_by, reviewed_at, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!result) {
    return NextResponse.json({ error: 'Lab result not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}
