'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DamageReport {
  id: string
  store_id: string
  reservation_id: string | null
  unit_id: string
  guest_id: string | null
  description: string
  damage_type: string
  estimated_cost: number | null
  charged_amount: number
  status: string
  created_at: string
  updated_at: string
  units: { id: string; unit_number: string } | null
  guests: { id: string; first_name: string; last_name: string } | null
  reservations: { id: string; check_in: string; check_out: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reported: { label: 'Reported', color: 'bg-yellow-500/20 text-yellow-400' },
  assessed: { label: 'Assessed', color: 'bg-blue-500/20 text-blue-400' },
  charged: { label: 'Charged', color: 'bg-orange-500/20 text-orange-400' },
  resolved: { label: 'Resolved', color: 'bg-green-500/20 text-green-400' },
  waived: { label: 'Waived', color: 'bg-slate-500/20 text-slate-400' },
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

export default function DamageReportsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<DamageReport[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState('')

  async function loadReports(sid: string) {
    let query = supabase
      .from('damage_reports')
      .select(`
        id, store_id, reservation_id, unit_id, guest_id,
        description, damage_type, estimated_cost, charged_amount,
        status, created_at, updated_at,
        units(id, unit_number),
        guests(id, first_name, last_name),
        reservations(id, check_in, check_out)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (typeFilter) {
      query = query.eq('damage_type', typeFilter)
    }

    const { data } = await query

    if (data) {
      setReports(data as unknown as DamageReport[])
    }
  }

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
        await loadReports(store.id)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storeId || loading) return
    loadReports(storeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter])

  const stats = useMemo(() => {
    const total = reports.length
    const unresolved = reports.filter(r =>
      r.status === 'reported' || r.status === 'assessed' || r.status === 'charged'
    ).length
    const totalEstimatedCost = reports.reduce((sum, r) => sum + (r.estimated_cost || 0), 0)
    const totalCharged = reports.reduce((sum, r) => sum + (r.charged_amount || 0), 0)
    return { total, unresolved, totalEstimatedCost, totalCharged }
  }, [reports])

  const damageTypes = useMemo(() => {
    const types = new Set(reports.map(r => r.damage_type))
    return Array.from(types).sort()
  }, [reports])

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
          <h1 className="text-2xl font-bold text-white">Damage Reports</h1>
          <p className="text-slate-400 mt-1">{reports.length} damage reports</p>
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
          <p className="text-slate-400 text-sm">Total Reports</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Unresolved</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.unresolved}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-red-400 text-sm">Total Estimated Cost</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalEstimatedCost)}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-400 text-sm">Total Charged</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalCharged)}</p>
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
              <option value="assessed">Assessed</option>
              <option value="charged">Charged</option>
              <option value="resolved">Resolved</option>
              <option value="waived">Waived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Damage Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Types</option>
              {damageTypes.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
        {(statusFilter || typeFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter('') }}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {reports.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Guest</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Damage Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Description</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Est. Cost</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Charged</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const sc = STATUS_CONFIG[report.status] || { label: report.status, color: 'bg-slate-500/20 text-slate-400' }
                const guestName = report.guests
                  ? `${report.guests.first_name} ${report.guests.last_name}`
                  : '-'
                return (
                  <tr key={report.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{report.units?.unit_number || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white">{guestName}</p>
                        {report.reservations && (
                          <p className="text-slate-400 text-xs">
                            {formatDate(report.reservations.check_in)} - {formatDate(report.reservations.check_out)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 capitalize">{report.damage_type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-slate-300 text-sm truncate max-w-[200px]" title={report.description}>
                        {report.description}
                      </p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white">
                        {report.estimated_cost != null ? formatPrice(report.estimated_cost) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">
                        {report.charged_amount > 0 ? formatPrice(report.charged_amount) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">{formatDate(report.created_at)}</span>
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
            <span className="text-4xl">&#128680;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Damage Reports</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || typeFilter
              ? 'No reports match your current filters. Try adjusting the filters.'
              : 'Damage reports will appear here when incidents are logged for your property.'}
          </p>
          {(statusFilter || typeFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter('') }}
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
