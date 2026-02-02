'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface LeaseRow {
  id: string
  store_id: string
  unit_id: string | null
  tenant_name: string
  tenant_phone: string | null
  tenant_email: string | null
  lease_start: string
  lease_end: string | null
  monthly_rent: number
  deposit_amount: number | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface NewLease {
  tenant_name: string
  tenant_phone: string
  tenant_email: string
  lease_start: string
  lease_end: string
  monthly_rent: string
  deposit_amount: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-500/20 text-green-400' },
  expired: { label: 'Expired', color: 'bg-slate-500/20 text-slate-400' },
  terminated: { label: 'Terminated', color: 'bg-red-500/20 text-red-400' },
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

export default function LeasesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [leases, setLeases] = useState<LeaseRow[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewLease>({
    tenant_name: '',
    tenant_phone: '',
    tenant_email: '',
    lease_start: '',
    lease_end: '',
    monthly_rent: '',
    deposit_amount: '',
  })

  async function loadLeases(sid: string) {
    let query = supabase
      .from('leases')
      .select('*')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query

    if (data) {
      setLeases(data as unknown as LeaseRow[])
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
        await loadLeases(store.id)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storeId || loading) return
    loadLeases(storeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const stats = useMemo(() => {
    const total = leases.length
    const active = leases.filter(l => l.status === 'active').length
    const totalRent = leases.filter(l => l.status === 'active').reduce((sum, l) => sum + l.monthly_rent, 0)
    return { total, active, totalRent }
  }, [leases])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('leases')
        .insert({
          store_id: storeId,
          tenant_name: form.tenant_name,
          tenant_phone: form.tenant_phone || null,
          tenant_email: form.tenant_email || null,
          lease_start: form.lease_start,
          lease_end: form.lease_end || null,
          monthly_rent: parseFloat(form.monthly_rent),
          deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
        })

      if (insertError) throw insertError

      await loadLeases(storeId)
      setShowForm(false)
      setForm({ tenant_name: '', tenant_phone: '', tenant_email: '', lease_start: '', lease_end: '', monthly_rent: '', deposit_amount: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lease')
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold text-white">Leases</h1>
          <p className="text-slate-400 mt-1">{leases.length} lease records</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Lease
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Leases</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Leases</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Monthly Revenue</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.totalRent)}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Lease</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tenant Name *</label>
                <input
                  type="text"
                  value={form.tenant_name}
                  onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={form.tenant_phone}
                  onChange={(e) => setForm({ ...form, tenant_phone: e.target.value })}
                  placeholder="+976 9911 2233"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={form.tenant_email}
                  onChange={(e) => setForm({ ...form, tenant_email: e.target.value })}
                  placeholder="tenant@email.com"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lease Start *</label>
                <input
                  type="date"
                  value={form.lease_start}
                  onChange={(e) => setForm({ ...form, lease_start: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lease End</label>
                <input
                  type="date"
                  value={form.lease_end}
                  onChange={(e) => setForm({ ...form, lease_end: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Rent *</label>
                <input
                  type="number"
                  value={form.monthly_rent}
                  onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Lease'}
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
            <option value="terminated">Terminated</option>
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
      {leases.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Tenant</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Contact</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Start</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">End</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Monthly Rent</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Deposit</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((lease) => {
                const sc = STATUS_CONFIG[lease.status] || { label: lease.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={lease.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{lease.tenant_name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        {lease.tenant_phone && <p className="text-slate-300 text-sm">{lease.tenant_phone}</p>}
                        {lease.tenant_email && <p className="text-slate-400 text-xs">{lease.tenant_email}</p>}
                        {!lease.tenant_phone && !lease.tenant_email && <span className="text-slate-500">-</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(lease.lease_start)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{lease.lease_end ? formatDate(lease.lease_end) : 'Open-ended'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(lease.monthly_rent)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{lease.deposit_amount ? formatPrice(lease.deposit_amount) : '-'}</span>
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
            <span className="text-4xl">&#128196;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Leases</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter
              ? 'No leases match your current filter. Try adjusting the filter.'
              : 'Lease records will appear here once you start adding tenants.'}
          </p>
          {statusFilter ? (
            <button
              onClick={() => setStatusFilter('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
            >
              <span>+</span> Create First Lease
            </button>
          )}
        </div>
      )}
    </div>
  )
}
