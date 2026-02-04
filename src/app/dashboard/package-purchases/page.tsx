'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PackagePurchaseRow {
  id: string
  store_id: string
  customer_id: string | null
  package_id: string | null
  purchase_date: string
  sessions_total: number
  sessions_used: number
  expires_at: string | null
  status: string
  amount_paid: number | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null; phone: string | null } | null
  service_packages: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  expired: { label: 'Expired', color: 'bg-slate-500/20 text-slate-400' },
  completed: { label: 'Completed', color: 'bg-blue-500/20 text-blue-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
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

export default function PackagePurchasesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [purchases, setPurchases] = useState<PackagePurchaseRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [error] = useState('')

  const loadPurchases = useCallback(async (sid: string) => {
    let query = supabase
      .from('package_purchases')
      .select(`
        id, store_id, customer_id, package_id, purchase_date, sessions_total,
        sessions_used, expires_at, status, amount_paid, created_at, updated_at,
        customers(id, name, phone),
        service_packages(id, name)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query

    if (data) {
      setPurchases(data as unknown as PackagePurchaseRow[])
    }
  }, [supabase, statusFilter])

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
        await loadPurchases(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadPurchases])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadPurchases(storeId) }
    reload()
  }, [storeId, loading, loadPurchases])

  const stats = useMemo(() => {
    const total = purchases.length
    const active = purchases.filter(p => p.status === 'active').length
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_paid || 0), 0)
    const totalSessions = purchases.reduce((sum, p) => sum + p.sessions_total, 0)
    const usedSessions = purchases.reduce((sum, p) => sum + p.sessions_used, 0)
    return { total, active, totalRevenue, totalSessions, usedSessions }
  }, [purchases])

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
          <h1 className="text-2xl font-bold text-white">Package Purchases</h1>
          <p className="text-slate-400 mt-1">{purchases.length} purchases</p>
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
          <p className="text-slate-400 text-sm">Total Purchases</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Revenue</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalRevenue)}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Sessions Used</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.usedSessions}/{stats.totalSessions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {statusFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {purchases.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Customer</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Package</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Purchased</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Sessions</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Expires</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Amount</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const sc = STATUS_CONFIG[p.status] || { label: p.status, color: 'bg-slate-500/20 text-slate-400' }
                const customerName = p.customers?.name || p.customers?.phone || '-'
                const packageName = p.service_packages?.name || '-'
                return (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{customerName}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{packageName}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(p.purchase_date)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-white font-medium">{p.sessions_used}/{p.sessions_total}</span>
                      <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min((p.sessions_used / p.sessions_total) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{p.expires_at ? formatDate(p.expires_at) : 'No expiry'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{p.amount_paid ? formatPrice(p.amount_paid) : '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
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
            <span className="text-4xl">&#127873;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Package Purchases</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter
              ? 'No purchases match your current filter. Try adjusting the filter.'
              : 'Package purchases will appear here as customers buy service packages.'}
          </p>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  )
}
