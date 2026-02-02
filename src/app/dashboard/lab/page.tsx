'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LabOrder {
  id: string
  patient_id: string
  order_type: string
  test_name: string
  test_code: string | null
  urgency: string
  specimen_type: string | null
  status: string
  notes: string | null
  created_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  staff: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  ordered: 'bg-blue-500/20 text-blue-400',
  collected: 'bg-yellow-500/20 text-yellow-400',
  processing: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const URGENCY_COLORS: Record<string, string> = {
  routine: 'bg-slate-500/20 text-slate-400',
  urgent: 'bg-orange-500/20 text-orange-400',
  stat: 'bg-red-500/20 text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  ordered: 'Захиалсан',
  collected: 'Цуглуулсан',
  processing: 'Боловсруулж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцалсан',
}

export default function LabPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [urgencyFilter, setUrgencyFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (urgencyFilter) params.set('urgency', urgencyFilter)
      if (typeFilter) params.set('order_type', typeFilter)

      const res = await fetch(`/api/lab-orders?${params}`)
      if (!res.ok) throw new Error('Failed to fetch lab orders')
      const json = await res.json()
      setOrders(json.data || [])
    } catch {
      setError('Could not load lab orders')
    } finally {
      setLoading(false)
    }
  }, [supabase, statusFilter, urgencyFilter, typeFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const stats = useMemo(() => ({
    total: orders.length,
    ordered: orders.filter(o => o.status === 'ordered').length,
    processing: orders.filter(o => o.status === 'processing').length,
    completed: orders.filter(o => o.status === 'completed').length,
    stat_urgency: orders.filter(o => o.urgency === 'stat').length,
  }), [orders])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Lab & Imaging</h1>
          <p className="text-slate-400 mt-1">Manage lab orders and imaging requests</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Orders</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.ordered}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Processing</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.processing}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">STAT Urgent</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.stat_urgency}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">All Statuses</option>
            <option value="ordered">Ordered</option>
            <option value="collected">Collected</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">All Urgencies</option>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all">
            <option value="">All Types</option>
            <option value="lab">Lab</option>
            <option value="imaging">Imaging</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {orders.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Test Name</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Patient</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Urgency</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Ordered</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{order.test_name}</span>
                    {order.test_code && <span className="text-slate-400 text-xs ml-2">({order.test_code})</span>}
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {order.patients ? `${order.patients.first_name} ${order.patients.last_name}` : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm capitalize">{order.order_type}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${URGENCY_COLORS[order.urgency] || ''}`}>
                      {order.urgency.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[order.status] || ''}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-400 text-sm">
                      {new Date(order.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold text-white mb-2">No lab orders yet</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            Lab and imaging orders will appear here when created from patient encounters.
          </p>
        </div>
      )}
    </div>
  )
}
