import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

type Period = '7d' | '30d' | '90d' | '1y'

function getDaysFromPeriod(period: Period): number {
  switch (period) {
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    case '1y': return 365
  }
}

/**
 * GET /api/analytics/stats — Aggregate analytics stats for the dashboard.
 *
 * Query params:
 *   period: '7d' | '30d' | '90d' | '1y' (default '30d')
 */
export async function GET(request: NextRequest) {
  // Rate limit: 30 requests per minute (expensive aggregation query)
  const rl = rateLimit(getClientIp(request), { limit: 30, windowSeconds: 60 })
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const period = (request.nextUrl.searchParams.get('period') || '30d') as Period
  if (!['7d', '30d', '90d', '1y'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const days = getDaysFromPeriod(period)
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString()

  const prevStart = new Date()
  prevStart.setDate(prevStart.getDate() - days * 2)
  const prevStartISO = prevStart.toISOString()

  // Run queries in parallel
  const [
    ordersRes,
    prevOrdersRes,
    messagesRes,
    totalCustomersRes,
    newCustomersRes,
    conversationsRes,
    appointmentsRes,
  ] = await Promise.all([
    // Current period orders
    supabase
      .from('orders')
      .select('id, total_amount, status, created_at')
      .eq('store_id', store.id)
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true }),

    // Previous period orders (for comparison)
    supabase
      .from('orders')
      .select('id, total_amount, status, created_at')
      .eq('store_id', store.id)
      .gte('created_at', prevStartISO)
      .lt('created_at', sinceISO),

    // Messages in period
    supabase
      .from('messages')
      .select('id, is_ai_response, is_from_customer, created_at')
      .gte('created_at', sinceISO),

    // Total customers
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id),

    // New customers in period
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)
      .gte('created_at', sinceISO),

    // Active conversations in period
    supabase
      .from('conversations')
      .select('id, status, channel', { count: 'exact' })
      .eq('store_id', store.id)
      .gte('updated_at', sinceISO),

    // Appointments in period
    supabase
      .from('appointments')
      .select('id, status, total_amount', { count: 'exact' })
      .eq('store_id', store.id)
      .gte('scheduled_at', sinceISO),
  ])

  const orders = ordersRes.data ?? []
  const prevOrders = prevOrdersRes.data ?? []
  const messages = messagesRes.data ?? []

  // Revenue
  const validOrders = orders.filter(o => o.status !== 'cancelled')
  const revenue = validOrders.reduce((s, o) => s + Number(o.total_amount), 0)
  const orderCount = validOrders.length
  const avgOrderValue = orderCount > 0 ? Math.round(revenue / orderCount) : 0
  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length

  // Previous period revenue for comparison
  const prevRevenue = prevOrders
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + Number(o.total_amount), 0)
  const revenueChange = prevRevenue > 0
    ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
    : revenue > 0 ? 100 : 0

  // Messages / AI stats
  const totalMessages = messages.length
  const aiResponses = messages.filter(m => m.is_ai_response).length
  const customerMessages = messages.filter(m => m.is_from_customer).length
  const aiResponseRate = customerMessages > 0
    ? Math.round((aiResponses / customerMessages) * 100)
    : 0

  // Customers
  const totalCustomers = totalCustomersRes.count ?? 0
  const newCustomers = newCustomersRes.count ?? 0

  // Conversations
  const totalConversations = conversationsRes.count ?? 0
  const conversations = conversationsRes.data ?? []
  const channelBreakdown: Record<string, number> = {}
  for (const c of conversations) {
    channelBreakdown[c.channel] = (channelBreakdown[c.channel] || 0) + 1
  }

  // Appointments
  const totalAppointments = appointmentsRes.count ?? 0
  const appointments = appointmentsRes.data ?? []
  const appointmentRevenue = appointments
    .filter(a => a.status === 'completed')
    .reduce((s, a) => s + Number(a.total_amount), 0)

  return NextResponse.json({
    period,
    revenue,
    revenueChange,
    orderCount,
    avgOrderValue,
    pendingOrders,
    cancelledOrders,
    totalMessages,
    aiResponses,
    customerMessages,
    aiResponseRate,
    totalCustomers,
    newCustomers,
    totalConversations,
    channelBreakdown,
    totalAppointments,
    appointmentRevenue,
  })
}
