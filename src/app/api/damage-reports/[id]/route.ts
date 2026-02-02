import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, updateDamageReportSchema } from '@/lib/validations'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/damage-reports/:id
 *
 * Get a single damage report by id with unit, guest, and reservation joins.
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

  const { data: damageReport, error } = await supabase
    .from('damage_reports')
    .select(`
      id, reservation_id, unit_id, guest_id, description, damage_type, estimated_cost, charged_amount, photos, status,
      created_at, updated_at,
      units(id, unit_number),
      guests(id, first_name, last_name),
      reservations(id, check_in, check_out)
    `)
    .eq('id', id)
    .eq('store_id', store.id)
    .single()

  if (error || !damageReport) {
    return NextResponse.json({ error: 'Damage report not found' }, { status: 404 })
  }

  return NextResponse.json(damageReport)
}

/**
 * PATCH /api/damage-reports/:id
 *
 * Update a damage report.
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

  const { data: body, error: validationError } = await validateBody(request, updateDamageReportSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updateData.status = body.status
  if (body.charged_amount !== undefined) updateData.charged_amount = body.charged_amount
  if (body.estimated_cost !== undefined) updateData.estimated_cost = body.estimated_cost

  const { data: damageReport, error } = await supabase
    .from('damage_reports')
    .update(updateData)
    .eq('id', id)
    .eq('store_id', store.id)
    .select(`
      id, reservation_id, unit_id, guest_id, description, damage_type, estimated_cost, charged_amount, photos, status,
      created_at, updated_at,
      units(id, unit_number),
      guests(id, first_name, last_name),
      reservations(id, check_in, check_out)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!damageReport) {
    return NextResponse.json({ error: 'Damage report not found' }, { status: 404 })
  }

  return NextResponse.json(damageReport)
}
