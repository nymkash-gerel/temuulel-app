import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { optimizeRoute } from '@/lib/ai/route-optimizer'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { DeliveryStop } from '@/lib/ai/route-optimizer'

/**
 * POST /api/driver/deliveries/optimize
 *
 * Optimizes the order of active deliveries for the authenticated driver.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const driverId = auth.driver.id

  // Get active deliveries
  const activeStatuses = ['assigned', 'picked_up', 'in_transit'] as const
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('id, delivery_number, delivery_address, customer_name')
    .eq('driver_id', driverId)
    .in('status', [...activeStatuses])
    .order('created_at', { ascending: true })

  if (!deliveries || deliveries.length < 2) {
    return NextResponse.json({ error: 'Маршрут оновчлоход 2+ хүргэлт шаардлагатай' }, { status: 400 })
  }

  // Get driver's current location
  const { data: driver } = await supabase
    .from('delivery_drivers')
    .select('current_location')
    .eq('id', driverId)
    .single()

  const driverLocation = driver?.current_location as { lat: number; lng: number } | null

  const stops: DeliveryStop[] = deliveries.map(d => ({
    delivery_id: d.id,
    delivery_number: d.delivery_number,
    address: d.delivery_address,
    customer_name: d.customer_name,
  }))

  const result = await optimizeRoute(stops, driverLocation)

  return NextResponse.json({ route: result })
}
