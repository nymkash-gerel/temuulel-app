import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, createTripLogSchema, parsePagination } from '@/lib/validations'

/**
 * GET /api/trip-logs
 *
 * List trip logs for the authenticated user's store.
 * Supports filtering by vehicle_id, driver_id, status.
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
  const vehicleId = searchParams.get('vehicle_id')
  const driverId = searchParams.get('driver_id')
  const status = searchParams.get('status')
  const { limit, offset } = parsePagination(searchParams)

  let query = supabase
    .from('trip_logs')
    .select(`
      id, start_location, end_location, start_time, end_time,
      distance_km, fuel_cost, status, notes, created_at, updated_at,
      fleet_vehicles(id, plate_number, vehicle_type),
      staff(id, name)
    `, { count: 'exact' })
    .eq('store_id', store.id)
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId)
  }
  if (driverId) {
    query = query.eq('driver_id', driverId)
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
 * POST /api/trip-logs
 *
 * Create a new trip log.
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

  const { data: body, error: validationError } = await validateBody(request, createTripLogSchema)
  if (validationError) return validationError

  // Verify vehicle belongs to store
  const { data: vehicle } = await supabase
    .from('fleet_vehicles')
    .select('id')
    .eq('id', body.vehicle_id)
    .eq('store_id', store.id)
    .single()

  if (!vehicle) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  }

  const { data: item, error } = await supabase
    .from('trip_logs')
    .insert({
      store_id: store.id,
      vehicle_id: body.vehicle_id,
      driver_id: body.driver_id || null,
      start_location: body.start_location || null,
      end_location: body.end_location || null,
      start_time: body.start_time,
      end_time: body.end_time || null,
      distance_km: body.distance_km || null,
      fuel_cost: body.fuel_cost || null,
      notes: body.notes || null,
      status: 'in_progress',
    })
    .select(`
      id, start_location, end_location, start_time, end_time,
      distance_km, fuel_cost, status, notes, created_at,
      fleet_vehicles(id, plate_number, vehicle_type),
      staff(id, name)
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
