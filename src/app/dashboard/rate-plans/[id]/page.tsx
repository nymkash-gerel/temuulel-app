'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface SeasonalAdjustment {
  name?: string
  start_date?: string
  end_date?: string
  multiplier?: number
  fixed_price?: number
}

interface RatePlan {
  id: string
  store_id: string
  unit_type: string | null
  name: string
  pricing_model: string
  base_price: number
  weekend_price: number | null
  seasonal_adjustments: SeasonalAdjustment[] | null
  min_stay: number
  max_stay: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const PRICING_MODELS: Record<string, string> = {
  per_night: 'Per Night',
  per_person: 'Per Person',
  flat: 'Flat Rate',
}

function formatPrice(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RatePlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const planId = params.id as string

  const [plan, setPlan] = useState<RatePlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editName, setEditName] = useState('')
  const [editUnitType, setEditUnitType] = useState('')
  const [editPricingModel, setEditPricingModel] = useState('per_night')
  const [editBasePrice, setEditBasePrice] = useState('')
  const [editWeekendPrice, setEditWeekendPrice] = useState('')
  const [editMinStay, setEditMinStay] = useState('')
  const [editMaxStay, setEditMaxStay] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/rate-plans/${planId}`)
      if (res.ok) {
        const data = await res.json()
        setPlan(data)
      } else {
        router.push('/dashboard/rate-plans')
        return
      }
    } catch {
      router.push('/dashboard/rate-plans')
      return
    }
    setLoading(false)
  }, [planId, router])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      await loadPlan()
    }
    init()
  }, [planId, supabase, router, loadPlan])

  function startEdit() {
    if (!plan) return
    setEditName(plan.name)
    setEditUnitType(plan.unit_type || '')
    setEditPricingModel(plan.pricing_model)
    setEditBasePrice(String(plan.base_price))
    setEditWeekendPrice(plan.weekend_price !== null ? String(plan.weekend_price) : '')
    setEditMinStay(String(plan.min_stay))
    setEditMaxStay(plan.max_stay !== null ? String(plan.max_stay) : '')
    setEditIsActive(plan.is_active)
    setIsEditing(true)
  }

  async function handleSave() {
    if (!plan) return
    setSaving(true)

    try {
      const changed: Record<string, unknown> = {}

      if (editName !== plan.name) changed.name = editName
      if ((editUnitType || null) !== (plan.unit_type || null)) changed.unit_type = editUnitType || null
      if (editPricingModel !== plan.pricing_model) changed.pricing_model = editPricingModel
      if (parseFloat(editBasePrice) !== plan.base_price) changed.base_price = parseFloat(editBasePrice)

      const newWeekend = editWeekendPrice ? parseFloat(editWeekendPrice) : null
      if (newWeekend !== plan.weekend_price) changed.weekend_price = newWeekend

      const newMin = parseInt(editMinStay) || 1
      if (newMin !== plan.min_stay) changed.min_stay = newMin

      const newMax = editMaxStay ? parseInt(editMaxStay) : null
      if (newMax !== plan.max_stay) changed.max_stay = newMax

      if (editIsActive !== plan.is_active) changed.is_active = editIsActive

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/rate-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (res.ok) {
        setIsEditing(false)
        await loadPlan()
      } else {
        alert('Failed to save changes')
      }
    } catch {
      alert('Failed to save changes')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!plan) return null

  const seasonalAdj = Array.isArray(plan.seasonal_adjustments) ? plan.seasonal_adjustments : []

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/rate-plans"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1 text-white text-2xl font-bold focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  plan.name
                )}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                plan.is_active
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {plan.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-slate-400 mt-1">Rate Plan Detail</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {saving ? '...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Pricing Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Pricing</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Pricing Model</span>
              {isEditing ? (
                <select
                  value={editPricingModel}
                  onChange={(e) => setEditPricingModel(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="per_night">Per Night</option>
                  <option value="per_person">Per Person</option>
                  <option value="flat">Flat Rate</option>
                </select>
              ) : (
                <span className="text-white capitalize">{PRICING_MODELS[plan.pricing_model] || plan.pricing_model}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Base Price</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editBasePrice}
                  onChange={(e) => setEditBasePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-32 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white font-medium">{formatPrice(plan.base_price)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Weekend Price</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editWeekendPrice}
                  onChange={(e) => setEditWeekendPrice(e.target.value)}
                  placeholder="Optional"
                  min="0"
                  step="0.01"
                  className="w-32 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              ) : (
                <span className="text-white">{plan.weekend_price !== null ? formatPrice(plan.weekend_price) : '-'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Unit Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Unit & Stay</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Unit Type</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editUnitType}
                  onChange={(e) => setEditUnitType(e.target.value)}
                  placeholder="e.g. deluxe, suite"
                  className="w-40 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              ) : (
                <span className="text-white capitalize">{plan.unit_type || '-'}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Min Stay</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editMinStay}
                  onChange={(e) => setEditMinStay(e.target.value)}
                  min="1"
                  className="w-24 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500"
                />
              ) : (
                <span className="text-white">{plan.min_stay} night{plan.min_stay !== 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Max Stay</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editMaxStay}
                  onChange={(e) => setEditMaxStay(e.target.value)}
                  placeholder="No limit"
                  min="1"
                  className="w-24 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              ) : (
                <span className="text-white">
                  {plan.max_stay !== null ? `${plan.max_stay} night${plan.max_stay !== 1 ? 's' : ''}` : 'No limit'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Status</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active</span>
              {isEditing ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-white text-sm">{editIsActive ? 'Active' : 'Inactive'}</span>
                </label>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  plan.is_active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              )}
            </div>
          </div>

          {/* Price summary */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-3xl font-bold text-white">{formatPrice(plan.base_price)}</p>
            <p className="text-slate-400 text-sm mt-1">
              {PRICING_MODELS[plan.pricing_model] || plan.pricing_model}
              {plan.weekend_price !== null && ` (Weekend: ${formatPrice(plan.weekend_price)})`}
            </p>
          </div>
        </div>
      </div>

      {/* Seasonal Adjustments */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-white font-medium">
            Seasonal Adjustments ({seasonalAdj.length})
          </h3>
        </div>

        {seasonalAdj.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Start Date</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">End Date</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Multiplier</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Fixed Price</th>
                </tr>
              </thead>
              <tbody>
                {seasonalAdj.map((adj, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-all">
                    <td className="py-3 px-6">
                      <span className="text-white text-sm">{adj.name || `Season ${idx + 1}`}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-slate-300 text-sm">{adj.start_date || '-'}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className="text-slate-300 text-sm">{adj.end_date || '-'}</span>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className="text-white text-sm">{adj.multiplier !== undefined ? `${adj.multiplier}x` : '-'}</span>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className="text-white text-sm">{adj.fixed_price !== undefined ? formatPrice(adj.fixed_price) : '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm">No seasonal adjustments configured</p>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Timestamps</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Created</span>
            <span className="text-slate-300">{formatDateTime(plan.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Updated</span>
            <span className="text-slate-300">{formatDateTime(plan.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
