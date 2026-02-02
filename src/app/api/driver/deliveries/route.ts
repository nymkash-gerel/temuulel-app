import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'
import { parsePagination } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * GET /api/driver/deliveries
 *
 * List deliveries assigned to the authenticated driver.
 * Query params:
 *   ?status=active   — assigned, picked_up, in_transit, delayed
 *   ?status=completed — delivered, failed, cancelled
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(getClientIp(request), { limit: 60, windowSeconds: 60 })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { driver } = auth
  const searchParams = request.nextUrl.searchParams
  const { limit, offset } = parsePagination(searchParams)
  const statusFilter = searchParams.get('status') || 'active'

  const activeStatuses = ['assigned', 'picked_up', 'in_transit', 'delayed'] as const
  const completedStatuses = ['delivered', 'failed', 'cancelled'] as const
  const statuses = statusFilter === 'completed' ? [...completedStatuses] : [...activeStatuses]

  const query = supabase
    .from('deliveries')
    .select('id, delivery_number, status, delivery_address, customer_name, customer_phone, estimated_delivery_time, actual_delivery_time, delivery_fee, notes, failure_reason, proof_photo_url, created_at, updated_at', { count: 'exact' })
    .eq('driver_id', driver.id)
    .in('status', statuses)
    .order('created_at', { ascending: statusFilter === 'active' })
    .range(offset, offset + limit - 1)

  const { data: deliveries, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deliveries: deliveries || [], total: count || 0 })
}
