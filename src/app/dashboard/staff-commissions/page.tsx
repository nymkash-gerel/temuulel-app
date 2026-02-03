'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface StaffCommission {
  id: string
  staff_id: string
  sale_type: 'service' | 'product' | 'package' | 'membership'
  sale_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'approved' | 'paid'
  reference_id: string | null
  notes: string | null
  created_at: string
  paid_at: string | null
  staff: { id: string; name: string; phone: string | null } | null
}

interface StaffMember {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400' },
  paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400' },
}

const SALE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  service: { label: 'Service', color: 'bg-pink-500/20 text-pink-400' },
  product: { label: 'Product', color: 'bg-purple-500/20 text-purple-400' },
  package: { label: 'Package', color: 'bg-cyan-500/20 text-cyan-400' },
  membership: { label: 'Membership', color: 'bg-amber-500/20 text-amber-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function StaffCommissionsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [commissions, setCommissions] = useState<StaffCommission[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [storeId, setStoreId] = useState<string>('')

  // Filters
  const [staffFilter, setStaffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Actions
  const [updating, setUpdating] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const loadCommissions = useCallback(async (sid: string) => {
    let query = supabase
      .from('staff_commissions')
      .select(`
        id, staff_id, sale_type, sale_amount, commission_rate,
        commission_amount, status, reference_id, notes,
        created_at, paid_at,
        staff(id, name, phone)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (staffFilter) {
      query = query.eq('staff_id', staffFilter)
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59')
    }

    const { data } = await query

    if (data) {
      setCommissions(data as unknown as StaffCommission[])
    }
  }, [supabase, staffFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)

        const [, staffRes] = await Promise.all([
          loadCommissions(store.id),
          supabase.from('staff').select('id, name').eq('store_id', store.id).eq('status', 'active').order('name'),
        ])

        if (staffRes.data) setStaffList(staffRes.data)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadCommissions])

  // Reload when filters change
  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadCommissions(storeId) }
    reload()
  }, [staffFilter, statusFilter, dateFrom, dateTo, storeId, loading, loadCommissions])

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = commissions.filter(c => {
      const d = new Date(c.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    const totalPending = commissions
      .filter(c => c.status === 'pending')
      .reduce((s, c) => s + c.commission_amount, 0)
    const totalApproved = commissions
      .filter(c => c.status === 'approved')
      .reduce((s, c) => s + c.commission_amount, 0)
    const totalPaidThisMonth = thisMonth
      .filter(c => c.status === 'paid')
      .reduce((s, c) => s + c.commission_amount, 0)

    return { totalPending, totalApproved, totalPaidThisMonth }
  }, [commissions])

  async function handleStatusChange(commissionId: string, newStatus: string) {
    setUpdating(commissionId)
    try {
      const updateData: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('staff_commissions')
        .update(updateData)
        .eq('id', commissionId)

      if (!error) {
        await loadCommissions(storeId)
      }
    } finally {
      setUpdating(null)
    }
  }

  async function handleGenerateCommissions() {
    setGenerating(true)
    try {
      const res = await fetch('/api/staff-commissions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId }),
      })

      if (res.ok) {
        const data = await res.json()
        alert(`Generated ${data.generated || 0} commissions`)
        await loadCommissions(storeId)
      } else {
        alert('Failed to generate commissions')
      }
    } catch {
      alert('Error generating commissions')
    } finally {
      setGenerating(false)
    }
  }

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
          <h1 className="text-2xl font-bold text-white">Staff Commissions</h1>
          <p className="text-slate-400 mt-1">{commissions.length} commission records</p>
        </div>
        <button
          onClick={handleGenerateCommissions}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
        >
          {generating ? 'Generating...' : 'Generate Commissions'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Total Pending</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalPending)}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Approved</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalApproved)}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Paid This Month</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalPaidThisMonth)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Staff</label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Staff</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            />
          </div>
        </div>
        {(staffFilter || statusFilter || dateFrom || dateTo) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStaffFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo('') }}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Commissions Table */}
      {commissions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Staff</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Sale Type</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Sale Amount</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Rate</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Commission</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Date</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => {
                const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending
                const st = SALE_TYPE_LABELS[c.sale_type] || { label: c.sale_type, color: 'bg-slate-500/20 text-slate-400' }

                return (
                  <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white font-medium">{c.staff?.name || '-'}</p>
                        {c.staff?.phone && (
                          <p className="text-slate-400 text-sm">{c.staff.phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-1 text-xs rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{formatPrice(c.sale_amount)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{c.commission_rate}%</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(c.commission_amount)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(c.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {c.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(c.id, 'approved')}
                            disabled={updating === c.id}
                            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 disabled:opacity-50 transition-all"
                          >
                            Approve
                          </button>
                        )}
                        {c.status === 'approved' && (
                          <button
                            onClick={() => handleStatusChange(c.id, 'paid')}
                            disabled={updating === c.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50 transition-all"
                          >
                            Mark Paid
                          </button>
                        )}
                        {c.status === 'paid' && (
                          <span className="text-xs text-slate-500">
                            {c.paid_at
                              ? new Date(c.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'Paid'}
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
            <span className="text-4xl">&#128176;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Commission Records</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {staffFilter || statusFilter || dateFrom || dateTo
              ? 'No commissions match your current filters. Try adjusting the filters.'
              : 'Commission records will appear here when staff complete sales. Use "Generate Commissions" to calculate commissions from recent sales.'}
          </p>
          {(staffFilter || statusFilter || dateFrom || dateTo) ? (
            <button
              onClick={() => { setStaffFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={handleGenerateCommissions}
              disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
            >
              {generating ? 'Generating...' : 'Generate Commissions'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
