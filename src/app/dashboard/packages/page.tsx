'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PackageService {
  id: string
  service_id: string
  services: { id: string; name: string } | null
}

interface ServicePackage {
  id: string
  name: string
  description: string | null
  price: number
  original_price: number | null
  valid_days: number | null
  is_active: boolean
  created_at: string
  package_services: PackageService[]
}

interface NewPackage {
  name: string
  description: string
  price: string
  original_price: string
  valid_days: string
  is_active: boolean
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function PackagesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewPackage>({
    name: '',
    description: '',
    price: '',
    original_price: '',
    valid_days: '',
    is_active: true,
  })

  const loadPackages = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('service_packages')
      .select(`
        id, name, description, price, original_price, valid_days,
        is_active, created_at,
        package_services(id, service_id, services(id, name))
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (data) {
      setPackages(data as unknown as ServicePackage[])
    }
  }, [supabase])

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
        await loadPackages(store.id)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadPackages])

  const filtered = useMemo(() => {
    if (!search.trim()) return packages
    const q = search.trim().toLowerCase()
    return packages.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    )
  }, [packages, search])

  const stats = useMemo(() => {
    const total = packages.length
    const active = packages.filter(p => p.is_active).length
    const prices = packages.filter(p => p.price > 0).map(p => p.price)
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0
    return { total, active, avgPrice }
  }, [packages])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('service_packages')
        .insert({
          store_id: storeId,
          name: form.name,
          description: form.description || null,
          price: parseFloat(form.price) || 0,
          original_price: form.original_price ? parseFloat(form.original_price) : null,
          valid_days: form.valid_days ? parseInt(form.valid_days) : undefined,
          is_active: form.is_active,
        })

      if (insertError) throw insertError

      await loadPackages(storeId)
      setShowForm(false)
      setForm({ name: '', description: '', price: '', original_price: '', valid_days: '', is_active: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create package')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(pkg: ServicePackage) {
    setToggling(pkg.id)
    try {
      await supabase
        .from('service_packages')
        .update({ is_active: !pkg.is_active })
        .eq('id', pkg.id)

      await loadPackages(storeId)
    } finally {
      setToggling(null)
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
          <h1 className="text-2xl font-bold text-white">Service Packages</h1>
          <p className="text-slate-400 mt-1">
            {packages.length} packages total
            {filtered.length !== packages.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <Link
          href="/dashboard/packages/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Package
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Packages</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Packages</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Avg Price</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.avgPrice)}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Package</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Package Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Bridal Glow Package"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Price *</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Original Price</label>
                <input
                  type="number"
                  value={form.original_price}
                  onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                  placeholder="Before discount"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Valid Days</label>
                <input
                  type="number"
                  value={form.valid_days}
                  onChange={(e) => setForm({ ...form, valid_days: e.target.value })}
                  placeholder="e.g. 30"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer pb-3">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-pink-500"
                  />
                  <span className="text-white">Active</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Package'}
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

      {/* Search */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">&#128269;</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages..."
            className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
          />
        </div>
      </div>

      {/* Packages Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Name</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Price</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Original Price</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Valid Days</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Services</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pkg) => {
                const discount = pkg.original_price && pkg.original_price > pkg.price
                  ? Math.round(((pkg.original_price - pkg.price) / pkg.original_price) * 100)
                  : null

                return (
                  <tr key={pkg.id} onClick={() => router.push(`/dashboard/packages/${pkg.id}`)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white font-medium">{pkg.name}</p>
                        {pkg.description && (
                          <p className="text-slate-400 text-sm mt-0.5 truncate max-w-[250px]">{pkg.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(pkg.price)}</span>
                      {discount && (
                        <span className="ml-2 text-xs text-green-400">-{discount}%</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-400">
                        {pkg.original_price ? formatPrice(pkg.original_price) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">
                        {pkg.valid_days ? `${pkg.valid_days} days` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        pkg.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {pkg.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-white">{pkg.package_services?.length || 0}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <button
                        onClick={() => handleToggleActive(pkg)}
                        disabled={toggling === pkg.id}
                        className={`px-3 py-1 text-xs rounded-lg transition-all disabled:opacity-50 ${
                          pkg.is_active
                            ? 'bg-slate-600/20 text-slate-300 hover:bg-slate-600/40'
                            : 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                        }`}
                      >
                        {toggling === pkg.id ? '...' : pkg.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : packages.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No packages match your search</p>
          <button
            onClick={() => setSearch('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128230;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Service Packages</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create bundled service packages to offer customers discounted combos.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Create First Package
          </button>
        </div>
      )}
    </div>
  )
}
