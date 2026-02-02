'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

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

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
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

export default function LaundryOrdersPage() {
  const router = useRouter()
  const supabase = createClient()

  const [orders, setOrders] = useState<LaundryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Form fields
  const [orderNumber, setOrderNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [serviceType, setServiceType] = useState('wash_fold')
  const [totalAmount, setTotalAmount] = useState('')
  const [pickupDate, setPickupDate] = useState('')
  const [notes, setNotes] = useState('')

  const fetchOrders = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    let url = `/api/laundry-orders?limit=50`
    if (statusFilter !== 'all') url += `&status=${statusFilter}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setOrders(json.data || [])
    }
    setLoading(false)
  }, [storeId, statusFilter])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const kpis = useMemo(() => {
    const total = orders.length
    const active = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length
    const ready = orders.filter(o => o.status === 'ready').length
    const revenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    return [
      { label: 'Нийт захиалга', value: total },
      { label: 'Идэвхтэй', value: active },
      { label: 'Бэлэн', value: ready },
      { label: 'Нийт орлого', value: new Intl.NumberFormat('mn-MN').format(revenue) + '₮' },
    ]
  }, [orders])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/laundry-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_number: orderNumber,
          customer_name: customerName,
          service_type: serviceType,
          total_amount: parseFloat(totalAmount) || 0,
          pickup_date: pickupDate || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to create order')
      }

      await fetchOrders()
      setShowForm(false)
      setOrderNumber('')
      setCustomerName('')
      setServiceType('wash_fold')
      setTotalAmount('')
      setPickupDate('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setSaving(false)
    }
  }

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
      {/* Header */}
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

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Laundry Order</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Order Number *</label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. LND-001"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Customer Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer full name"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Service Type *</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                  required
                >
                  {Object.entries(SERVICE_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Total Amount *</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Pickup Date</label>
                <input
                  type="datetime-local"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions..."
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Order'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
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

      {/* Orders Table */}
      {orders.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
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
                  <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
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
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128085;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Laundry Orders</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter !== 'all'
              ? 'No orders match your current filter. Try adjusting the filter.'
              : 'Laundry orders will appear here once they are created.'}
          </p>
          {statusFilter !== 'all' ? (
            <button
              onClick={() => setStatusFilter('all')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
            >
              <span>+</span> Create First Order
            </button>
          )}
        </div>
      )}
    </div>
  )
}
