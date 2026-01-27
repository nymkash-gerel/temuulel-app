import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendDailyReportEmail, type DailyReportData } from '@/lib/email'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials not configured')
  return createClient(url, key)
}

/**
 * GET /api/cron/daily-report
 *
 * Vercel Cron handler — runs daily at 06:00 UTC+8 (Mongolian morning).
 * Iterates all stores, checks if the owner has email_daily_report enabled,
 * gathers yesterday's stats, and sends a summary email.
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()

  // Define "yesterday" window (UTC-based, covers 24h)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const sinceISO = yesterday.toISOString()
  const untilISO = todayStart.toISOString()

  const dateLabel = yesterday.toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Fetch all stores with their owners
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, owner_id')

  if (!stores || stores.length === 0) {
    return NextResponse.json({ message: 'No stores found', sent: 0 })
  }

  let sentCount = 0

  for (const store of stores) {
    // Check if owner has email_daily_report enabled
    const { data: owner } = await supabase
      .from('users')
      .select('email, notification_settings')
      .eq('id', store.owner_id)
      .single()

    if (!owner?.email) continue

    const settings = (owner.notification_settings || {}) as Record<string, boolean>
    if (!settings.email_daily_report) continue

    // Gather stats for yesterday
    const [ordersResult, customersResult, messagesResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total_amount')
        .eq('store_id', store.id)
        .gte('created_at', sinceISO)
        .lt('created_at', untilISO),
      supabase
        .from('customers')
        .select('id')
        .eq('store_id', store.id)
        .gte('created_at', sinceISO)
        .lt('created_at', untilISO),
      supabase
        .from('messages')
        .select('id, conversation_id')
        .eq('is_from_customer', true)
        .gte('created_at', sinceISO)
        .lt('created_at', untilISO),
    ])

    const orders = ordersResult.data || []
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    const newCustomers = (customersResult.data || []).length

    // Filter messages to this store's conversations
    const { data: storeConversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('store_id', store.id)

    const storeConvIds = new Set((storeConversations || []).map((c) => c.id))
    const storeMessages = (messagesResult.data || []).filter(
      (m) => storeConvIds.has(m.conversation_id)
    )

    // Top products by revenue (from yesterday's order items)
    const orderIds = orders.map((o) => o.id)
    let topProducts: DailyReportData['topProducts'] = []

    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price')
        .in('order_id', orderIds)

      if (items && items.length > 0) {
        // Aggregate by product_id
        const productMap = new Map<string, { quantity: number; revenue: number }>()
        for (const item of items) {
          if (!item.product_id) continue
          const existing = productMap.get(item.product_id) || { quantity: 0, revenue: 0 }
          existing.quantity += item.quantity || 1
          existing.revenue += (item.unit_price || 0) * (item.quantity || 1)
          productMap.set(item.product_id, existing)
        }

        // Fetch product names
        const productIds = [...productMap.keys()]
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds)

        const nameMap = new Map((products || []).map((p) => [p.id, p.name]))

        topProducts = [...productMap.entries()]
          .map(([id, stats]) => ({
            name: nameMap.get(id) || 'Бүтээгдэхүүн',
            quantity: stats.quantity,
            revenue: stats.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      }
    }

    // Send email
    const report: DailyReportData = {
      storeName: store.name || 'Дэлгүүр',
      date: dateLabel,
      totalOrders,
      totalRevenue,
      newCustomers,
      totalMessages: storeMessages.length,
      topProducts,
    }

    try {
      await sendDailyReportEmail(owner.email, report)
      sentCount++
    } catch (err) {
      console.error(`Daily report email failed for store ${store.id}:`, err)
    }
  }

  return NextResponse.json({ message: 'Daily reports sent', sent: sentCount })
}
