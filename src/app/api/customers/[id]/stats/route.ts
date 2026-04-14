import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Customer basic
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, email, messenger_id, created_at, store_id')
    .eq('id', id)
    .single()
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // All orders by this customer
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_amount, status, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  const orderList = (orders || []) as { total_amount: number; status: string; created_at: string }[]
  const totalSpent = orderList.reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalOrders = orderList.length
  const completedOrders = orderList.filter(o => o.status === 'delivered' || o.status === 'completed').length
  const avgOrderValue = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0

  // Most ordered products (join with products for name)
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_id, quantity, products(name)')
    .in('order_id', orderList.map(o => (o as unknown as { id: string }).id))

  const productCount: Record<string, { name: string; count: number }> = {}
  for (const item of (orderItems || []) as unknown as { product_id: string; quantity: number; products: { name: string } | null }[]) {
    if (!item.product_id) continue
    const name = item.products?.name || 'Unknown'
    if (!productCount[item.product_id]) productCount[item.product_id] = { name, count: 0 }
    productCount[item.product_id].count += item.quantity
  }
  const favoriteProducts = Object.entries(productCount)
    .map(([id, { name, count }]) => ({ id, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Conversations
  const { count: conversationCount } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id)

  return NextResponse.json({
    customer,
    stats: {
      totalOrders,
      completedOrders,
      totalSpent,
      avgOrderValue,
      conversationCount: conversationCount || 0,
    },
    favoriteProducts,
    recentOrders: orderList.slice(0, 10),
  })
}
