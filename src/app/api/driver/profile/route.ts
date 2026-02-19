import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { validateBody, driverUpdateProfileSchema } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/driver/profile
 *
 * Get the authenticated driver's profile and delivery stats.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  // Get delivery stats
  const [completedRes, failedRes, totalRes] = await Promise.all([
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driver.id)
      .eq('status', 'delivered'),
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driver.id)
      .eq('status', 'failed'),
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driver.id)
      .in('status', ['delivered', 'failed', 'cancelled']),
  ])

  const completed = completedRes.count || 0
  const failed = failedRes.count || 0
  const total = totalRes.count || 0
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  return NextResponse.json({
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      email: driver.email,
      vehicle_type: driver.vehicle_type,
      vehicle_number: driver.vehicle_number,
      status: driver.status,
      created_at: driver.created_at,
    },
    stats: {
      completed,
      failed,
      total,
      completion_rate: completionRate,
    },
  })
}

/**
 * PATCH /api/driver/profile
 *
 * Update the authenticated driver's profile (name, vehicle info).
 */
export async function PATCH(request: NextRequest) {
  const rl = await rateLimit(getClientIp(request), { limit: 10, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth

  const { data: body, error: validationError } = await validateBody(request, driverUpdateProfileSchema)
  if (validationError) return validationError

  const updateData: Record<string, unknown> = {}
  if (body.name) updateData.name = body.name
  if (body.vehicle_type !== undefined) updateData.vehicle_type = body.vehicle_type
  if (body.vehicle_number !== undefined) updateData.vehicle_number = body.vehicle_number

  const { data: updated, error: updateError } = await supabase
    .from('delivery_drivers')
    .update(updateData)
    .eq('id', driver.id)
    .select('id, name, phone, vehicle_type, vehicle_number, status')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ driver: updated })
}
