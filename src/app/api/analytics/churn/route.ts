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

  const customerIds = (customers || []).map((c: { id: string }) => c.id)

  // Last activity per customer (most recent order or message)
  const { data: lastOrders } = await supabase
    .from('orders')
    .select('customer_id, created_at, total_amount')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })

  const lastActivity: Record<string, { date: string; spent: number; orderCount: number }> = {}
  for (const o of (lastOrders || []) as { customer_id: string; created_at: string; total_amount: number }[]) {
    if (!lastActivity[o.customer_id]) {
      lastActivity[o.customer_id] = { date: o.created_at, spent: o.total_amount, orderCount: 1 }
    } else {
      lastActivity[o.customer_id].spent += o.total_amount
      lastActivity[o.customer_id].orderCount++
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
