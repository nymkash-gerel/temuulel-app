'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import KpiCards from '@/components/ui/KpiCards'
import { formatPrice } from '@/lib/format'

interface LaundryOrder {
  id: string
  order_number: string
  customer_name: string
  service_type: string
  status: string
  total_amount: number
  pickup_date: string | null
  notes: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  received: { label: 'Received', color: 'bg-blue-500/20 text-blue-400' },
  processing: { label: 'Processing', color: 'bg-yellow-500/20 text-yellow-400' },
  ready: { label: 'Ready', color: 'bg-green-500/20 text-green-400' },
  delivered: { label: 'Delivered', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

const SERVICE_TYPES: Record<string, string> = {
  wash_fold: 'Wash & Fold',
  dry_clean: 'Dry Clean',
  iron_only: 'Iron Only',
  wash_iron: 'Wash & Iron',
  stain_removal: 'Stain Removal',
  express: 'Express',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LaundryClient() {
  const [orders, setOrders] = useState<LaundryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      let url = `/api/laundry-orders?limit=50`
      if (statusFilter !== 'all') url += `&status=${statusFilter}`
      const res = await fetch(url)
      if (cancelled) return
      if (res.ok) {
        const json = await res.json()
        setOrders(json.data || [])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [statusFilter])

  async function fetchOrders() {
    setLoading(true)
    let url = `/api/laundry-orders?limit=50`
    if (statusFilter !== 'all') url += `&status=${statusFilter}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setOrders(json.data || [])
    }
    setLoading(false)
  }

  const kpis = useMemo(() => {
    const total = orders.length
    const active = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length
    const ready = orders.filter(o => o.status === 'ready').length
    const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    return [
      { label: 'Нийт захиалга', value: total },
      { label: 'Идэвхтэй', value: active },
      { label: 'Бэлэн', value: ready },
      { label: 'Нийт орлого', value: new Intl.NumberFormat('mn-MN').format(revenue) + '\u20AE' },
    ]
  }, [orders])

  async function handleUpdateStatus(orderId: string, newStatus: string) {
    setUpdating(orderId)
    setError('')

    try {
      const res = await fetch('/api/laundry-orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to update status')
      }

      await fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Laundry Orders</h1>
          <p className="text-slate-400 mt-1">{orders.length} orders total</p>
        </div>
        <Link
          href="/dashboard/laundry/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Шинэ захиалга
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <KpiCards cards={kpis} />

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="all">All Statuses</option>
              <option value="received">Received</option>
              <option value="processing">Processing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {statusFilter !== 'all' && (
            <div className="flex items-end">
              <button
                onClick={() => setStatusFilter('all')}
                className="text-sm text-pink-400 hover:text-pink-300 transition-all pb-3"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Order #</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Service</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Pickup Date</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const sc = STATUS_CONFIG[order.status] || { label: order.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={order.id} className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">#{order.order_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{order.customer_name}</span>
                      {order.notes && (
                        <p className="text-slate-400 text-sm mt-0.5 truncate max-w-[200px]">{order.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{SERVICE_TYPES[order.service_type] || order.service_type}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(Number(order.total_amount))}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {order.pickup_date ? formatDateTime(order.pickup_date) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">{formatDate(order.created_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {order.status === 'received' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'processing')}
                            disabled={updating === order.id}
                            className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded hover:bg-yellow-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? '...' : 'Processing'}
                          </button>
                        )}
                        {order.status === 'processing' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'ready')}
                            disabled={updating === order.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? '...' : 'Ready'}
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => handleUpdateStatus(order.id, 'delivered')}
                            disabled={updating === order.id}
                            className="px-2 py-1 text-xs bg-slate-600/20 text-slate-300 rounded hover:bg-slate-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === order.id ? '...' : 'Delivered'}
                          </button>
                        )}
                        {(order.status === 'delivered' || order.status === 'cancelled') && (
                          <span className="text-xs text-slate-500">
                            {sc.label}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128085;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Laundry Orders</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter !== 'all'
              ? 'No orders match your current filter. Try adjusting the filter.'
              : 'Laundry orders will appear here once they are created.'}
          </p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
