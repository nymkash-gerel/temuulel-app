'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface LocationRow {
  id: string
  store_id: string
  name: string
  location_type: string
  parent_id: string | null
  barcode: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface MovementRow {
  id: string
  store_id: string
  product_id: string
  variant_id: string | null
  location_id: string | null
  movement_type: string
  quantity: number
  reference_type: string | null
  reference_id: string | null
  unit_cost: number | null
  notes: string | null
  created_at: string
  product?: { id: string; name: string } | null
}

interface NewLocation {
  name: string
  location_type: string
}

const MOVEMENT_COLORS: Record<string, string> = {
  purchase: 'bg-green-500/20 text-green-400',
  sale: 'bg-blue-500/20 text-blue-400',
  adjustment: 'bg-yellow-500/20 text-yellow-400',
  transfer: 'bg-indigo-500/20 text-indigo-400',
  return: 'bg-orange-500/20 text-orange-400',
  damage: 'bg-red-500/20 text-red-400',
  initial: 'bg-slate-500/20 text-slate-400',
}

function formatCurrency(amount: number) {
  return amount.toLocaleString() + '₮'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

export default function InventoryPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [activeTab, setActiveTab] = useState<'locations' | 'movements'>('locations')
  const [movementTypeFilter, setMovementTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewLocation>({
    name: '',
    location_type: 'warehouse',
  })

  const loadLocations = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('inventory_locations')
      .select('*')
      .eq('store_id', sid)
      .order('name', { ascending: true })

    if (data) {
      setLocations(data as unknown as LocationRow[])
    }
  }, [supabase])

  const loadMovements = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('inventory_movements')
      .select('*, product:products(id, name)')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) {
      setMovements(data as unknown as MovementRow[])
    }
  }, [supabase])

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
        await Promise.all([
          loadLocations(store.id),
          loadMovements(store.id),
        ])
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadLocations, loadMovements])

  const stats = useMemo(() => {
    const totalLocations = locations.length
    const activeLocations = locations.filter(l => l.is_active).length
    const totalMovements = movements.length
    const recentMovements = movements.filter(m => isToday(m.created_at)).length
    return { totalLocations, activeLocations, totalMovements, recentMovements }
  }, [locations, movements])

  const movementTypes = useMemo(() => {
    const types = new Set(movements.map(m => m.movement_type))
    return Array.from(types).sort()
  }, [movements])

  const filteredMovements = useMemo(() => {
    if (!movementTypeFilter) return movements
    return movements.filter(m => m.movement_type === movementTypeFilter)
  }, [movements, movementTypeFilter])

  async function handleCreateLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('inventory_locations')
        .insert({
          store_id: storeId,
          name: form.name,
          location_type: form.location_type,
        })

      if (insertError) throw insertError

      await loadLocations(storeId)
      setShowForm(false)
      setForm({ name: '', location_type: 'warehouse' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create location')
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
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <p className="text-slate-400 mt-1">
            Manage locations and track stock movements
          </p>
        </div>
        {activeTab === 'locations' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Add Location
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Locations</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalLocations}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Locations</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.activeLocations}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total Movements</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalMovements}</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-indigo-400 text-sm">Recent Movements (Today)</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.recentMovements}</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'locations'
              ? 'bg-pink-500 text-white'
              : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          Locations ({locations.length})
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'movements'
              ? 'bg-pink-500 text-white'
              : 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          Movements ({movements.length})
        </button>
      </div>

      {/* Create Location Form */}
      {showForm && activeTab === 'locations' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Add New Location</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateLocation}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Location Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Main Warehouse"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Location Type</label>
                <select
                  value={form.location_type}
                  onChange={(e) => setForm({ ...form, location_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="store">Store</option>
                  <option value="shelf">Shelf</option>
                  <option value="bin">Bin</option>
                  <option value="cold_storage">Cold Storage</option>
                  <option value="display">Display</option>
                  <option value="backroom">Backroom</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Location'}
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

      {/* Locations Tab */}
      {activeTab === 'locations' && (
        <>
          {locations.length > 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Name</th>
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Type</th>
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Barcode</th>
                    <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc) => (
                    <tr key={loc.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-white font-medium">{loc.name}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-slate-300 capitalize">{loc.location_type.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-slate-300 font-mono text-xs">{loc.barcode || '-'}</span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          loc.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {loc.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:py-4 md:px-6">
                        <span className="text-slate-400 text-sm">{formatDate(loc.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">&#128230;</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Locations Yet</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Add your warehouses, stores, and storage locations to manage inventory.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
              >
                <span>+</span> Add First Location
              </button>
            </div>
          )}
        </>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <>
          {/* Movement Type Filter */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Movement Type</label>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  <option value="">All Types</option>
                  {movementTypes.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
            {movementTypeFilter && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <button
                  onClick={() => setMovementTypeFilter('')}
                  className="text-sm text-pink-400 hover:text-pink-300 transition-all"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {filteredMovements.length > 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Product</th>
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Movement Type</th>
                    <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Quantity</th>
                    <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit Cost</th>
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Reference</th>
                    <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((mov) => {
                    const mc = MOVEMENT_COLORS[mov.movement_type] || 'bg-slate-500/20 text-slate-400'
                    return (
                      <tr key={mov.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                        <td className="py-3 px-3 md:py-4 md:px-6">
                          <span className="text-white font-medium">
                            {mov.product?.name || mov.product_id.slice(0, 8) + '...'}
                          </span>
                        </td>
                        <td className="py-3 px-3 md:py-4 md:px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${mc}`}>
                            {mov.movement_type.charAt(0).toUpperCase() + mov.movement_type.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                          <span className={`font-medium ${mov.quantity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {mov.quantity >= 0 ? '+' : ''}{mov.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                          <span className="text-slate-300">
                            {mov.unit_cost != null ? formatCurrency(mov.unit_cost) : '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 md:py-4 md:px-6">
                          <span className="text-slate-400 text-sm">
                            {mov.reference_type || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 md:py-4 md:px-6">
                          <span className="text-slate-400 text-sm">{formatDate(mov.created_at)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : movements.length > 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
              <p className="text-slate-400">No movements match your current filter</p>
              <button
                onClick={() => setMovementTypeFilter('')}
                className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
              >
                Clear filter
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">&#128203;</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Movements Yet</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                Stock movements will appear here as inventory is received, sold, or adjusted.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
