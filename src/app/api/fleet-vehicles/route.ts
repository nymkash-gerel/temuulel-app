import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createFleetVehicleSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/fleet-vehicles
 *
 * List fleet vehicles for the authenticated user's store.
 * Supports filtering by status, vehicle_type, driver_id.
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
  const vehicleType = searchParams.get('vehicle_type')
  const driverId = searchParams.get('driver_id')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('fleet_vehicles')
    .select(`
      id, plate_number, vehicle_type, brand, model, year,
      status, insurance_expiry, registration_expiry, mileage,
      notes, created_at, updated_at,
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }
  if (vehicleType) {
    query = query.eq('vehicle_type', vehicleType)
  }
  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, total: count })
}

/**
 * POST /api/fleet-vehicles
 *
 * Create a new fleet vehicle.
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

  const { data: body, error: validationError } = await validateBody(request, createFleetVehicleSchema)
  if (validationError) return validationError

  const { data: item, error } = await supabase
    .from('fleet_vehicles')
    .insert({
      store_id: store.id,
      plate_number: body.plate_number,
      driver_id: body.driver_id || null,
      vehicle_type: body.vehicle_type || undefined,
      brand: body.brand || null,
      model: body.model || null,
      year: body.year || null,
      insurance_expiry: body.insurance_expiry || null,
      registration_expiry: body.registration_expiry || null,
      mileage: body.mileage || null,
      notes: body.notes || null,
      status: 'available',
    })
    .select(`
      id, plate_number, vehicle_type, brand, model, year,
      status, insurance_expiry, registration_expiry, mileage,
      notes, created_at,
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
