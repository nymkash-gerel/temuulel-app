import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'

/**
 * GET /api/driver/earnings/history?page=1&limit=20
 *
 * Paginated completed deliveries with fees for the authenticated driver.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20))
  const offset = (page - 1) * limit

  const { data: deliveries, count } = await supabase
    .from('deliveries')
    .select('id, delivery_number, delivery_address, delivery_fee, actual_delivery_time, created_at', { count: 'exact' })
    .eq('driver_id', auth.driver.id)
    .eq('status', 'delivered')
    .order('actual_delivery_time', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  return NextResponse.json({
    deliveries: deliveries || [],
    total: count || 0,
    page,
    limit,
    pages: Math.ceil((count || 0) / limit),
  })
}
