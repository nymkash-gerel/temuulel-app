import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/analytics/delivery
 *
 * Delivery analytics data for the authenticated user's store.
 * Query: ?period=7d|30d|90d (default: 30d)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const period = request.nextUrl.searchParams.get('period') || '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()

  // Fetch all deliveries in period
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('id, status, delivery_fee, driver_id, created_at, actual_delivery_time, delivery_drivers(id, name, avg_rating, rating_count)')
    .eq('store_id', store.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: true })

  const all = deliveries || []

  // Summary
  const total = all.length
  const delivered = all.filter(d => d.status === 'delivered').length
  const failed = all.filter(d => d.status === 'failed').length
  const cancelled = all.filter(d => d.status === 'cancelled').length
  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0

  // Average delivery time (for delivered orders with actual_delivery_time)
  const deliveryTimes = all
    .filter(d => d.status === 'delivered' && d.actual_delivery_time)
    .map(d => {
      const created = new Date(d.created_at).getTime()
      const actual = new Date(d.actual_delivery_time!).getTime()
      return (actual - created) / (1000 * 60) // minutes
    })
    .filter(t => t > 0 && t < 1440) // filter out obviously wrong values (> 24h)

  const avgDeliveryMinutes = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : 0

  // Active drivers
  const uniqueDrivers = new Set(all.filter(d => d.driver_id).map(d => d.driver_id))

  // Status distribution
  const statusCounts: Record<string, number> = {}
  for (const d of all) {
    statusCounts[d.status] = (statusCounts[d.status] || 0) + 1
  }
  const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({ status, count }))

  // Daily delivery counts
  const dailyCounts: Record<string, number> = {}
  for (const d of all) {
    const day = d.created_at.split('T')[0]
    dailyCounts[day] = (dailyCounts[day] || 0) + 1
  }
  const dailyDeliveries = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Hourly distribution
  const hourlyCounts: Record<number, number> = {}
  for (const d of all) {
    const hour = new Date(d.created_at).getHours()
    hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h.toString().padStart(2, '0')}:00`,
    count: hourlyCounts[h] || 0,
  }))

  // Driver rankings
  const driverMap = new Map<string, { name: string; deliveries: number; avgRating: number; ratingCount: number }>()
  for (const d of all) {
    if (!d.driver_id || d.status !== 'delivered') continue
    const driver = d.delivery_drivers as { id: string; name: string; avg_rating: number; rating_count: number } | null
    if (!driver) continue

    const existing = driverMap.get(d.driver_id)
    if (existing) {
      existing.deliveries++
    } else {
      driverMap.set(d.driver_id, {
        name: driver.name,
        deliveries: 1,
        avgRating: Number(driver.avg_rating) || 0,
        ratingCount: driver.rating_count || 0,
      })
    }
  }
  const driverRankings = Array.from(driverMap.values())
    .sort((a, b) => b.deliveries - a.deliveries)
    .slice(0, 10)

  return NextResponse.json({
    summary: {
      total,
      delivered,
      failed,
      cancelled,
      successRate,
      avgDeliveryMinutes,
      activeDrivers: uniqueDrivers.size,
    },
    statusDistribution,
    dailyDeliveries,
    hourlyDistribution,
    driverRankings,
  })
}
