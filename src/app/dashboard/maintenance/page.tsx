'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface MaintenanceRequest {
  id: string
  store_id: string
  unit_id: string | null
  reported_by: string | null
  assigned_to: string | null
  category: string
  description: string
  priority: string
  status: string
  estimated_cost: number | null
  actual_cost: number | null
  created_at: string
  updated_at: string
  units: { id: string; unit_number: string } | null
  staff: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reported: { label: 'Reported', color: 'bg-yellow-500/20 text-yellow-400' },
  assigned: { label: 'Assigned', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-indigo-500/20 text-indigo-400' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
  normal: { label: 'Normal', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function MaintenancePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [error] = useState('')

  const loadRequests = useCallback(async (sid: string) => {
    let query = supabase
      .from('maintenance_requests')
      .select(`
        id, store_id, unit_id, reported_by, assigned_to,
        category, description, priority, status,
        estimated_cost, actual_cost, created_at, updated_at,
        units(id, unit_number),
        staff!maintenance_requests_assigned_to_fkey(id, name)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (priorityFilter) {
      query = query.eq('priority', priorityFilter)
    }

    const { data } = await query

    if (data) {
      setRequests(data as unknown as MaintenanceRequest[])
    }
  }, [supabase, statusFilter, priorityFilter])

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
        await loadRequests(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadRequests])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadRequests(storeId) }
    reload()
  }, [storeId, loading, loadRequests])

  const stats = useMemo(() => {
    const total = requests.length
    const open = requests.filter(r =>
      r.status === 'reported' || r.status === 'assigned' || r.status === 'in_progress'
    ).length
    const completed = requests.filter(r => r.status === 'completed').length
    const estimatedCostTotal = requests.reduce((sum, r) => sum + (r.estimated_cost || 0), 0)
    return { total, open, completed, estimatedCostTotal }
  }, [requests])

  if (loading) {
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
          <h1 className="text-2xl font-bold text-white">Maintenance</h1>
          <p className="text-slate-400 mt-1">{requests.length} maintenance requests</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Requests</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-400 text-sm">Open</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.open}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Estimated Cost Total</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.estimatedCostTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        {(statusFilter || priorityFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter('') }}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {requests.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Category</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Description</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Priority</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Assigned To</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Est. Cost</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const sc = STATUS_CONFIG[req.status] || { label: req.status, color: 'bg-slate-500/20 text-slate-400' }
                const pc = PRIORITY_CONFIG[req.priority] || { label: req.priority, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={req.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{req.units?.unit_number || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 capitalize">{req.category.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-slate-300 text-sm truncate max-w-[200px]" title={req.description}>
                        {req.description}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{req.staff?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white">
                        {req.estimated_cost != null ? formatPrice(req.estimated_cost) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(req.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
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
            <span className="text-4xl">&#128295;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Maintenance Requests</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || priorityFilter
              ? 'No requests match your current filters. Try adjusting the filters.'
              : 'Maintenance requests will appear here when issues are reported for your property.'}
          </p>
          {(statusFilter || priorityFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
