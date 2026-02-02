'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface UnitRow {
  id: string
  store_id: string
  unit_number: string
  unit_type: string
  floor: string | null
  max_occupancy: number
  base_rate: number
  status: string
  created_at: string
  updated_at: string
}

interface NewUnit {
  unit_number: string
  unit_type: string
  floor: string
  max_occupancy: string
  base_rate: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-green-500/20 text-green-400' },
  occupied: { label: 'Occupied', color: 'bg-blue-500/20 text-blue-400' },
  maintenance: { label: 'Maintenance', color: 'bg-yellow-500/20 text-yellow-400' },
  blocked: { label: 'Blocked', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function UnitsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<UnitRow[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewUnit>({
    unit_number: '',
    unit_type: 'standard',
    floor: '',
    max_occupancy: '2',
    base_rate: '',
  })

  async function loadUnits(sid: string) {
    const { data } = await supabase
      .from('units')
      .select('*')
      .eq('store_id', sid)
      .order('unit_number', { ascending: true })

    if (data) {
      setUnits(data as unknown as UnitRow[])
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
        await loadUnits(store.id)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    const total = units.length
    const available = units.filter(u => u.status === 'available').length
    const occupied = units.filter(u => u.status === 'occupied').length
    const inMaintenance = units.filter(u => u.status === 'maintenance').length
    return { total, available, occupied, inMaintenance }
  }, [units])

  const unitTypes = useMemo(() => {
    const types = new Set(units.map(u => u.unit_type))
    return Array.from(types).sort()
  }, [units])

  const filtered = useMemo(() => {
    let result = units
    if (statusFilter) {
      result = result.filter(u => u.status === statusFilter)
    }
    if (typeFilter) {
      result = result.filter(u => u.unit_type === typeFilter)
    }
    return result
  }, [units, statusFilter, typeFilter])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('units')
        .insert({
          store_id: storeId,
          unit_number: form.unit_number,
          unit_type: form.unit_type,
          floor: form.floor || null,
          max_occupancy: parseInt(form.max_occupancy) || 2,
          base_rate: parseFloat(form.base_rate) || 0,
        })

      if (insertError) throw insertError

      await loadUnits(storeId)
      setShowForm(false)
      setForm({ unit_number: '', unit_type: 'standard', floor: '', max_occupancy: '2', base_rate: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit')
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
          <h1 className="text-2xl font-bold text-white">Units / Rooms</h1>
          <p className="text-slate-400 mt-1">
            {units.length} units total
            {filtered.length !== units.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <Link
          href="/dashboard/units/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> Add Unit
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Units</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Available</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.available}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Occupied</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.occupied}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">In Maintenance</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inMaintenance}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Add New Unit</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Unit Number *</label>
                <input
                  type="text"
                  value={form.unit_number}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                  placeholder="e.g. 101"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Unit Type</label>
                <select
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  <option value="standard">Standard</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                  <option value="family">Family</option>
                  <option value="studio">Studio</option>
                  <option value="penthouse">Penthouse</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Floor</label>
                <input
                  type="text"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder="e.g. 1"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Max Occupancy</label>
                <input
                  type="number"
                  min="1"
                  value={form.max_occupancy}
                  onChange={(e) => setForm({ ...form, max_occupancy: e.target.value })}
                  placeholder="2"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Base Rate (per night) *</label>
                <input
                  type="number"
                  min="0"
                  value={form.base_rate}
                  onChange={(e) => setForm({ ...form, base_rate: e.target.value })}
                  placeholder="0"
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
                {saving ? 'Creating...' : 'Create Unit'}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Unit Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Types</option>
              {unitTypes.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
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
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit Number</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Floor</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Max Occupancy</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Base Rate</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((unit) => {
                const sc = STATUS_CONFIG[unit.status] || { label: unit.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={unit.id} onClick={() => router.push(`/dashboard/units/${unit.id}`)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{unit.unit_number}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 capitalize">{unit.unit_type}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{unit.floor || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{unit.max_occupancy}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(unit.base_rate)}</span>
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
      ) : units.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No units match your current filters</p>
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#127968;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Units Yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Add your rooms, apartments, or rental units to start managing your property.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Add First Unit
          </button>
        </div>
      )}
    </div>
  )
}
