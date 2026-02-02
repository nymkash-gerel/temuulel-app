import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createEquipmentSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/equipment
 *
 * List equipment for the store. Supports filtering by equipment_type and status.
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
  const equipmentType = searchParams.get('equipment_type')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('equipment')
    .select(`
      id, name, equipment_type, serial_number, status, location, purchase_date, last_maintenance, next_maintenance, notes, created_at, updated_at
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (equipmentType) {
    query = query.eq('equipment_type', equipmentType)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/equipment
 *
 * Create a new equipment item.
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

  const { data: body, error: validationError } = await validateBody(request, createEquipmentSchema)
  if (validationError) return validationError

  const { data: equipment, error } = await supabase
    .from('equipment')
    .insert({
      store_id: store.id,
      name: body.name,
      equipment_type: body.equipment_type || undefined,
      serial_number: body.serial_number || null,
      status: body.status || undefined,
      location: body.location || null,
      purchase_date: body.purchase_date || null,
      last_maintenance: body.last_maintenance || null,
      next_maintenance: body.next_maintenance || null,
      notes: body.notes || null,
    })
    .select(`
      id, name, equipment_type, serial_number, status, location, purchase_date, last_maintenance, next_maintenance, notes, created_at, updated_at
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: equipment }, { status: 201 })
}
