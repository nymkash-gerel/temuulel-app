import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function KitchenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!store) redirect('/login')

  // Get active orders (pending + confirmed)
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, created_at, notes,
      order_items(id, quantity, variant_label, products(id, name))
    `)
    .eq('store_id', store.id)
    .in('status', ['pending', 'confirmed', 'processing'])
    .order('created_at', { ascending: true })
    .limit(50)

  // Get KDS stations
  const { data: stations } = await supabase
    .from('kds_stations')
    .select('id, name, station_type, is_active')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Гал тогоо</h1>
        {stations && stations.length > 0 && (
          <div className="flex gap-2">
            {stations.map(s => (
              <span key={s.id} className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-xs">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Order Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders?.map(order => (
          <div key={order.id} className={`border rounded-xl overflow-hidden ${statusColors[order.status] || 'bg-slate-800 border-slate-700'}`}>
            <div className="p-4 border-b border-inherit">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-lg">{order.order_number}</span>
                <span className="text-xs uppercase font-medium">{order.status}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(order.created_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="p-4 space-y-2">
              {(order.order_items as Array<{ id: string; quantity: number; variant_label: string | null; products: { id: string; name: string } | null }>)?.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-sm text-white">
                    {item.quantity}x {item.products?.name || 'Бүтээгдэхүүн'}
                  </span>
                  {item.variant_label && (
                    <span className="text-xs text-slate-400">{item.variant_label}</span>
                  )}
                </div>
              ))}
              {order.notes && (
                <p className="text-xs text-yellow-400 mt-2 pt-2 border-t border-inherit">
                  📝 {order.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {(!orders || orders.length === 0) && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-4xl mb-4">👨‍🍳</p>
          <p className="text-lg">Идэвхтэй захиалга байхгүй</p>
        </div>
      )}
    </div>
  )
}
