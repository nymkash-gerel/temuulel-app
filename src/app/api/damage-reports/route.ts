import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createDamageReportSchema, parsePagination } from '@/lib/validations'
import type { Json } from '@/lib/database.types'

/**
 * GET /api/damage-reports
 *
 * List damage reports for the store. Supports filtering by status, unit_id.
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
  const unitId = searchParams.get('unit_id')
  const { limit, offset } = parsePagination(searchParams)

  const validStatuses = ['reported', 'assessed', 'charged', 'resolved', 'waived'] as const

  let query = supabase
    .from('damage_reports')
    .select(`
      id, reservation_id, unit_id, guest_id, description, damage_type, estimated_cost, charged_amount, photos, status,
      created_at, updated_at,
      units(id, unit_number),
      guests(id, first_name, last_name),
      reservations(id, check_in, check_out)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && validStatuses.includes(status as typeof validStatuses[number])) {
    query = query.eq('status', status as typeof validStatuses[number])
  }

  if (unitId) {
    query = query.eq('unit_id', unitId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/damage-reports
 *
 * Create a new damage report.
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

  const { data: body, error: validationError } = await validateBody(request, createDamageReportSchema)
  if (validationError) return validationError

  const { data: damageReport, error } = await supabase
    .from('damage_reports')
    .insert({
      store_id: store.id,
      reservation_id: body.reservation_id || null,
      unit_id: body.unit_id,
      guest_id: body.guest_id || null,
      description: body.description,
      damage_type: body.damage_type || undefined,
      estimated_cost: body.estimated_cost || null,
      photos: (body.photos || []) as unknown as Json,
    })
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

  return NextResponse.json(damageReport, { status: 201 })
}
