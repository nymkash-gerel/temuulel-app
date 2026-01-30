import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateInsights } from '@/lib/ai/analytics-insight'
import type { AnalyticsStats } from '@/lib/ai/types'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as Partial<AnalyticsStats>

  if (
    typeof body.revenue !== 'number' ||
    typeof body.orderCount !== 'number' ||
    typeof body.period !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: revenue, orderCount, period' },
      { status: 400 }
    )
  }

  const stats: AnalyticsStats = {
    period: body.period,
    revenue: body.revenue,
    revenueChange: body.revenueChange ?? 0,
    orderCount: body.orderCount,
    avgOrderValue: body.avgOrderValue ?? 0,
    newCustomers: body.newCustomers ?? 0,
    totalCustomers: body.totalCustomers ?? 0,
    topProducts: body.topProducts ?? [],
    aiResponseRate: body.aiResponseRate ?? 0,
    totalMessages: body.totalMessages ?? 0,
    pendingOrders: body.pendingOrders ?? 0,
    cancelledOrders: body.cancelledOrders ?? 0,
  }

  const result = await generateInsights(stats)

  if (!result) {
    return NextResponse.json({ insights: null })
  }

  return NextResponse.json({
    insights: result.insights,
    tone: result.tone,
    generated_at: new Date().toISOString(),
  })
}
