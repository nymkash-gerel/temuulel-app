import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Churn prediction — customers who haven't engaged in N days.
 * Returns at-risk customers + suggests re-engagement.
 */
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

  // Customers with at least 1 order ever
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, email, messenger_id, created_at')
    .eq('store_id', member.store_id)

  // Per-customer last-activity + lifetime spend, aggregated in the DB (migration 075)
  // instead of fetching every order row and summing in JS.
  const { data: aggregates } = await supabase.rpc('churn_order_aggregates', {
    p_store_id: member.store_id,
  })

  const lastActivity: Record<string, { date: string; spent: number; orderCount: number }> = {}
  for (const a of (aggregates || []) as { customer_id: string; last_order_at: string; total_spent: number; order_count: number }[]) {
    lastActivity[a.customer_id] = {
      date: a.last_order_at,
      spent: Number(a.total_spent),
      orderCount: a.order_count,
    }
  }

  const now = Date.now()
  const buckets = { active: 0, at_risk: 0, churned: 0 }
  const atRiskList: { id: string; name: string; daysSince: number; lifetimeValue: number; messenger_id: string | null }[] = []

  for (const c of (customers || []) as { id: string; name: string; messenger_id: string | null }[]) {
    const activity = lastActivity[c.id]
    if (!activity) continue // never ordered
    const days = Math.floor((now - new Date(activity.date).getTime()) / (1000 * 60 * 60 * 24))
    if (days < 30) buckets.active++
    else if (days < 90) {
      buckets.at_risk++
      atRiskList.push({
        id: c.id,
        name: c.name || 'Unknown',
        daysSince: days,
        lifetimeValue: activity.spent,
        messenger_id: c.messenger_id,
      })
    } else buckets.churned++
  }

  // Sort by lifetime value (high-value at-risk first)
  atRiskList.sort((a, b) => b.lifetimeValue - a.lifetimeValue)

  return NextResponse.json({
    buckets,
    atRiskCustomers: atRiskList.slice(0, 50),
    suggestion: atRiskList.length > 0
      ? `${atRiskList.length} харилцагч сүүлийн 30-90 хоног идэвхгүй. Broadcast эсвэл хямдрал санал болгож өнгөрүүлэхгүй буцааж сэргээ.`
      : 'Бүх харилцагч идэвхтэй байна 🎉',
  })
}
