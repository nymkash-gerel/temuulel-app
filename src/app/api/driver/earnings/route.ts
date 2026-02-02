import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedDriver } from '@/lib/driver-auth'

/**
 * GET /api/driver/earnings
 *
 * Returns aggregated earnings for the authenticated driver:
 * today, this week, this month, and all-time totals.
 */
export async function GET() {
  const supabase = await createClient()
  const auth = await getAuthenticatedDriver(supabase)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const driverId = auth.driver.id

  // Get all completed deliveries for this driver
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('delivery_fee, actual_delivery_time, created_at')
    .eq('driver_id', driverId)
    .eq('status', 'delivered')

  if (!deliveries) {
    return NextResponse.json({
      today: 0,
      week: 0,
      month: 0,
      total: 0,
      today_count: 0,
      week_count: 0,
      month_count: 0,
      total_count: 0,
    })
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  let today = 0, week = 0, month = 0, total = 0
  let todayCount = 0, weekCount = 0, monthCount = 0, totalCount = 0

  for (const d of deliveries) {
    const fee = Number(d.delivery_fee) || 0
    const ts = new Date(d.actual_delivery_time || d.created_at)

    total += fee
    totalCount++

    if (ts >= startOfMonth) {
      month += fee
      monthCount++
    }
    if (ts >= startOfWeek) {
      week += fee
      weekCount++
    }
    if (ts >= startOfDay) {
      today += fee
      todayCount++
    }
  }

  return NextResponse.json({
    today,
    week,
    month,
    total,
    today_count: todayCount,
    week_count: weekCount,
    month_count: monthCount,
    total_count: totalCount,
  })
}
