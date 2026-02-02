'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ProductionBatch {
  id: string
  product_name: string
  production_date: string
  target_qty: number
  produced_qty: number
  status: string
  assigned_to: string | null
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  on_hold: 'bg-orange-500/20 text-orange-400',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
]

function getProgressColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 75) return 'bg-blue-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-orange-500'
}

export default function ProductionPlanningPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchBatches = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (dateFilter) params.set('date', dateFilter)

      const res = await fetch(`/api/production-batches?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to fetch production batches')
      }
      const data = await res.json()
      setBatches(Array.isArray(data) ? data : data.batches || [])
    } catch {
      setError('Could not load production batches')
    } finally {
      setLoading(false)
    }
  }, [supabase, statusFilter, dateFilter])

  useEffect(() => {
    fetchBatches()
  }, [fetchBatches])

  const filtered = useMemo(() => {
    if (!search.trim()) return batches

    const q = search.trim().toLowerCase()
    return batches.filter((b) =>
      b.product_name?.toLowerCase().includes(q) ||
      b.assigned_to?.toLowerCase().includes(q)
    )
  }, [batches, search])

  const stats = useMemo(() => ({
    planned: batches.filter((b) => b.status === 'planned').length,
    inProgress: batches.filter((b) => b.status === 'in_progress').length,
    completed: batches.filter((b) => b.status === 'completed').length,
  }), [batches])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Production Planning</h1>
          <p className="text-slate-400 mt-1">
            {batches.length} batches total
            {filtered.length !== batches.length && ` (${filtered.length} results)`}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Planned</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.planned}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product or assignee..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Product</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Date</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Target</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Produced</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Progress</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((batch) => {
                const pct = batch.target_qty > 0
                  ? Math.min(Math.round((batch.produced_qty / batch.target_qty) * 100), 100)
                  : 0

                return (
                  <tr key={batch.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{batch.product_name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {new Date(batch.production_date).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm">{batch.target_qty}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white text-sm">{batch.produced_qty}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full ${getProgressColor(pct)} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-slate-300 text-xs font-medium min-w-[2.5rem] text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[batch.status] || 'bg-slate-500/20 text-slate-400'}`}>
                        {batch.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{batch.assigned_to || '-'}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : batches.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No batches match your filters</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setDateFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No production batches yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Production batches will appear here when they are planned.
          </p>
        </div>
      )}
    </div>
  )
}
