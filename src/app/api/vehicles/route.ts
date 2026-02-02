import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createVehicleSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/vehicles
 *
 * List vehicles for the store. Supports filtering by vehicle_type.
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
  const vehicleType = searchParams.get('vehicle_type')
  const { limit, offset } = parsePagination(searchParams)

  const validVehicleTypes = ['sedan', 'suv', 'truck', 'van', 'motorcycle', 'bus', 'other'] as const

  let query = supabase
    .from('vehicles')
    .select(`
      id, customer_id, plate_number, make, model, color, vehicle_type, notes, created_at, updated_at,
      customers(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (vehicleType && validVehicleTypes.includes(vehicleType as typeof validVehicleTypes[number])) {
    query = query.eq('vehicle_type', vehicleType as typeof validVehicleTypes[number])
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/vehicles
 *
 * Create a new vehicle.
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

  const { data: body, error: validationError } = await validateBody(request, createVehicleSchema)
  if (validationError) return validationError

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({
      store_id: store.id,
      customer_id: body.customer_id || null,
      plate_number: body.plate_number,
      make: body.make || null,
      model: body.model || null,
      color: body.color || null,
      vehicle_type: body.vehicle_type || undefined,
      notes: body.notes || null,
    })
    .select(`
      id, customer_id, plate_number, make, model, color, vehicle_type, notes, created_at, updated_at,
      customers(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(vehicle, { status: 201 })
}
