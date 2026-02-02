import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/driver-store-assignments
 *
 * List all driver-store assignments for the authenticated store.
 * Includes driver details.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: assignments } = await supabase
    .from('driver_store_assignments')
    .select('id, driver_id, status, assigned_at')
    .eq('store_id', store.id)
    .eq('status', 'active')

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ assignments: [] })
  }

  // Fetch driver details
  const driverIds = assignments.map(a => a.driver_id)
  const { data: drivers } = await supabase
    .from('delivery_drivers')
    .select('id, name, phone, vehicle_type, status, store_id')
    .in('id', driverIds)

  const driverMap = new Map((drivers || []).map(d => [d.id, d]))

  const enriched = assignments.map(a => ({
    ...a,
    driver: driverMap.get(a.driver_id) || null,
    is_primary: driverMap.get(a.driver_id)?.store_id === store.id,
  }))

  return NextResponse.json({ assignments: enriched })
}

/**
 * POST /api/driver-store-assignments
 *
 * Assign a driver to the store by phone or driver_id.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 20, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body = await request.json()
  const { driver_id, driver_phone } = body as { driver_id?: string; driver_phone?: string }

  // Find driver by id or phone
  let driverId = driver_id
  if (!driverId && driver_phone) {
    const { data: driver } = await supabase
      .from('delivery_drivers')
      .select('id')
      .eq('phone', driver_phone)
      .single()

    if (!driver) {
      return NextResponse.json({ error: 'Жолооч олдсонгүй' }, { status: 404 })
    }
    driverId = driver.id
  }

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id эсвэл driver_phone шаардлагатай' }, { status: 400 })
  }

  // Check if already assigned
  const { data: existing } = await supabase
    .from('driver_store_assignments')
    .select('id')
    .eq('driver_id', driverId)
    .eq('store_id', store.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Жолооч аль хэдийн оноогдсон' }, { status: 409 })
  }

  const { data: assignment, error } = await supabase
    .from('driver_store_assignments')
    .insert({
      driver_id: driverId,
      store_id: store.id,
      status: 'active',
    })
    .select('id, driver_id, status, assigned_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ assignment }, { status: 201 })
}

/**
 * DELETE /api/driver-store-assignments
 *
 * Remove a driver-store assignment.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body = await request.json()
  const { assignment_id } = body as { assignment_id: string }

  if (!assignment_id) {
    return NextResponse.json({ error: 'assignment_id шаардлагатай' }, { status: 400 })
  }

  const { error } = await supabase
    .from('driver_store_assignments')
    .delete()
    .eq('id', assignment_id)
    .eq('store_id', store.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
