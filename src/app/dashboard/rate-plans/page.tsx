'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RatePlanRow {
  id: string
  store_id: string
  unit_type: string | null
  name: string
  pricing_model: string
  base_price: number
  weekend_price: number | null
  seasonal_adjustments: unknown[]
  min_stay: number
  max_stay: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface NewRatePlan {
  name: string
  unit_type: string
  pricing_model: string
  base_price: string
  weekend_price: string
  min_stay: string
  max_stay: string
}

const PRICING_MODELS = [
  { value: 'per_night', label: 'Per Night' },
  { value: 'per_person', label: 'Per Person' },
  { value: 'flat', label: 'Flat Rate' },
]

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function RatePlansPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [ratePlans, setRatePlans] = useState<RatePlanRow[]>([])
  const [pricingFilter, setPricingFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<NewRatePlan>({
    name: '',
    unit_type: '',
    pricing_model: 'per_night',
    base_price: '',
    weekend_price: '',
    min_stay: '1',
    max_stay: '',
  })

  const loadRatePlans = useCallback(async (sid: string) => {
    let query = supabase
      .from('rate_plans')
      .select('*')
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (pricingFilter) {
      query = query.eq('pricing_model', pricingFilter)
    }

    const { data } = await query

    if (data) {
      setRatePlans(data as unknown as RatePlanRow[])
    }
  }, [supabase, pricingFilter])

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
        await loadRatePlans(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadRatePlans])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadRatePlans(storeId) }
    reload()
  }, [pricingFilter, storeId, loading, loadRatePlans])

  const stats = useMemo(() => {
    const total = ratePlans.length
    const active = ratePlans.filter(r => r.is_active).length
    const avgPrice = total > 0 ? ratePlans.reduce((sum, r) => sum + r.base_price, 0) / total : 0
    return { total, active, avgPrice }
  }, [ratePlans])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('rate_plans')
        .insert({
          store_id: storeId,
          name: form.name,
          unit_type: form.unit_type || null,
          pricing_model: form.pricing_model,
          base_price: parseFloat(form.base_price),
          weekend_price: form.weekend_price ? parseFloat(form.weekend_price) : null,
          min_stay: parseInt(form.min_stay) || 1,
          max_stay: form.max_stay ? parseInt(form.max_stay) : null,
        })

      if (insertError) throw insertError

      await loadRatePlans(storeId)
      setShowForm(false)
      setForm({ name: '', unit_type: '', pricing_model: 'per_night', base_price: '', weekend_price: '', min_stay: '1', max_stay: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rate plan')
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
          <h1 className="text-2xl font-bold text-white">Rate Plans</h1>
          <p className="text-slate-400 mt-1">{ratePlans.length} rate plans</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Rate Plan
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
          <p className="text-slate-400 text-sm">Total Plans</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Plans</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.active}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Avg Base Price</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.avgPrice)}</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">New Rate Plan</h2>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Plan Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Standard Room Rate"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Unit Type</label>
                <input
                  type="text"
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  placeholder="e.g. deluxe, suite"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Pricing Model</label>
                <select
                  value={form.pricing_model}
                  onChange={(e) => setForm({ ...form, pricing_model: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  {PRICING_MODELS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Base Price *</label>
                <input
                  type="number"
                  value={form.base_price}
                  onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Weekend Price</label>
                <input
                  type="number"
                  value={form.weekend_price}
                  onChange={(e) => setForm({ ...form, weekend_price: e.target.value })}
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Min Stay (nights)</label>
                <input
                  type="number"
                  value={form.min_stay}
                  onChange={(e) => setForm({ ...form, min_stay: e.target.value })}
                  min="1"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
              >
                {saving ? 'Creating...' : 'Create Rate Plan'}
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
          <label className="block text-xs text-slate-400 mb-1">Pricing Model</label>
          <select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
          >
            <option value="">All Models</option>
            {PRICING_MODELS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {pricingFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setPricingFilter('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {ratePlans.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit Type</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Model</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Base Price</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Weekend</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Min Stay</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {ratePlans.map((plan) => (
                <tr key={plan.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{plan.name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 capitalize">{plan.unit_type || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 capitalize">{plan.pricing_model.replace('_', ' ')}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-white font-medium">{formatPrice(plan.base_price)}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                    <span className="text-slate-300">{plan.weekend_price ? formatPrice(plan.weekend_price) : '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className="text-slate-300">{plan.min_stay}{plan.max_stay ? `-${plan.max_stay}` : '+'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      plan.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128178;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Rate Plans</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {pricingFilter
              ? 'No rate plans match your current filter. Try adjusting the filter.'
              : 'Create rate plans to define pricing for different unit types and seasons.'}
          </p>
          {pricingFilter ? (
            <button
              onClick={() => setPricingFilter('')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filter
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
            >
              <span>+</span> Create First Rate Plan
            </button>
          )}
        </div>
      )}
    </div>
  )
}
