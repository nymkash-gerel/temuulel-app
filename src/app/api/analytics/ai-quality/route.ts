import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'No store' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // AI quality stats
  const { data: qualityLogs } = await sb
    .from('ai_quality_logs')
    .select('quality_score, created_at')
    .eq('store_id', member.store_id)
    .order('created_at', { ascending: false })
    .limit(500)

  const logs = (qualityLogs || []) as { quality_score: number; created_at: string }[]
  const avgScore = logs.length > 0 ? Math.round(logs.reduce((s: number, l: { quality_score: number }) => s + l.quality_score, 0) / logs.length) : 0
  const lowQuality = logs.filter((l: { quality_score: number }) => l.quality_score < 50).length

  // Unanswered count
  const { count: unansweredCount } = await sb
    .from('unanswered_questions')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', member.store_id)
    .eq('status', 'pending')

  // Orders stats (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount, status, created_at')
    .eq('store_id', member.store_id)
    .gte('created_at', thirtyDaysAgo)

  const orderList = (orders || []) as { total_amount: number; status: string; created_at: string }[]
  const totalRevenue = orderList.reduce((s, o) => s + (o.total_amount || 0), 0)
  const completedOrders = orderList.filter(o => o.status === 'delivered' || o.status === 'completed').length

  // Conversations stats
  const { count: totalConversations } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', member.store_id)
    .gte('created_at', thirtyDaysAgo)

  // Daily quality trend (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const dailyTrend: { date: string; avg: number; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    const dayLogs = logs.filter((l: { created_at: string }) => l.created_at.startsWith(dateStr))
    dailyTrend.push({
      date: dateStr,
      avg: dayLogs.length > 0 ? Math.round(dayLogs.reduce((s: number, l: { quality_score: number }) => s + l.quality_score, 0) / dayLogs.length) : 0,
      count: dayLogs.length,
    })
  }

  return NextResponse.json({
    ai: { avgScore, totalLogs: logs.length, lowQuality, unansweredCount: unansweredCount || 0, dailyTrend },
    sales: { totalRevenue, totalOrders: orderList.length, completedOrders },
    engagement: { totalConversations: totalConversations || 0 },
  })
}
