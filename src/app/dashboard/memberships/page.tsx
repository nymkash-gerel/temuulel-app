'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface MembershipPlan {
  id: string
  name: string
  description: string | null
  price: number
  billing_period: 'monthly' | 'quarterly' | 'yearly' | 'one_time'
  benefits: string[] | null
  is_active: boolean
  created_at: string
  customer_memberships: { id: string; status: string }[]
}

interface NewPlan {
  name: string
  description: string
  price: string
  billing_period: 'monthly' | 'quarterly' | 'yearly' | 'one_time'
  benefits: string
  is_active: boolean
}

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One Time',
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function MembershipsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<NewPlan>({
    name: '',
    description: '',
    price: '',
    billing_period: 'monthly',
    benefits: '',
    is_active: true,
  })

  const loadPlans = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('memberships')
      .select(`
        id, name, description, price, billing_period, benefits,
        is_active, created_at,
        customer_memberships(id, status)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })

    if (data) {
      setPlans(data as unknown as MembershipPlan[])
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
        await loadPlans(store.id)
      }
      setLoading(false)
    }
    load()
  }, [supabase, router, loadPlans])

  const stats = useMemo(() => {
    const total = plans.length
    const activeMembers = plans.reduce((sum, p) => {
      return sum + (p.customer_memberships?.filter(m => m.status === 'active').length || 0)
    }, 0)
    const monthlyRevenue = plans.reduce((sum, p) => {
      const activeCount = p.customer_memberships?.filter(m => m.status === 'active').length || 0
      if (p.billing_period === 'monthly') return sum + (p.price * activeCount)
      if (p.billing_period === 'quarterly') return sum + ((p.price / 3) * activeCount)
      if (p.billing_period === 'yearly') return sum + ((p.price / 12) * activeCount)
      return sum
    }, 0)
    return { total, activeMembers, monthlyRevenue: Math.round(monthlyRevenue) }
  }, [plans])

  function startEdit(plan: MembershipPlan) {
    setEditingId(plan.id)
    setForm({
      name: plan.name,
      description: plan.description || '',
      price: String(plan.price),
      billing_period: plan.billing_period,
      benefits: (plan.benefits || []).join(', '),
      is_active: plan.is_active,
    })
    setShowForm(true)
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setForm({
      name: '',
      description: '',
      price: '',
      billing_period: 'monthly',
      benefits: '',
      is_active: true,
    })
    setShowForm(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId) return

    setSaving(true)
    setError('')

    const benefits = form.benefits
      .split(',')
      .map(b => b.trim())
      .filter(b => b.length > 0)

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('memberships')
          .update({
            name: form.name,
            description: form.description || null,
            price: parseFloat(form.price) || 0,
            billing_period: form.billing_period,
            benefits: benefits.length > 0 ? benefits : null,
            is_active: form.is_active,
          })
          .eq('id', editingId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('memberships')
          .insert({
            store_id: storeId,
            name: form.name,
            description: form.description || null,
            price: parseFloat(form.price) || 0,
            billing_period: form.billing_period,
            benefits: benefits.length > 0 ? benefits : null,
            is_active: form.is_active,
          })

        if (insertError) throw insertError
      }

      await loadPlans(storeId)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save membership plan')
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
          <h1 className="text-2xl font-bold text-white">Memberships</h1>
          <p className="text-slate-400 mt-1">{plans.length} membership plans</p>
        </div>
        <Link
          href="/dashboard/memberships/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Plan
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Plans</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Active Members</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.activeMembers}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Revenue / Month (est.)</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.monthlyRevenue)}</p>
        </div>
      </div>

      {/* Create / Edit Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Edit Plan' : 'Create New Plan'}
          </h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Plan Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Gold Membership"
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
                <label className="block text-sm font-medium text-slate-300 mb-2">Billing Period *</label>
                <select
                  value={form.billing_period}
                  onChange={(e) => setForm({ ...form, billing_period: e.target.value as NewPlan['billing_period'] })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One Time</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">Benefits (comma-separated)</label>
                <input
                  type="text"
                  value={form.benefits}
                  onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                  placeholder="e.g. 10% discount, Priority booking, Free consultations"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
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
                {saving ? 'Saving...' : editingId ? 'Update Plan' : 'Create Plan'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plans Table */}
      {plans.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Plan</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Price</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Billing</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Active Members</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const activeCount = plan.customer_memberships?.filter(m => m.status === 'active').length || 0

                return (
                  <tr key={plan.id} onClick={() => router.push(`/dashboard/memberships/${plan.id}`)} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white font-medium">{plan.name}</p>
                        {plan.description && (
                          <p className="text-slate-400 text-sm mt-0.5 truncate max-w-[250px]">{plan.description}</p>
                        )}
                        {plan.benefits && plan.benefits.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {plan.benefits.slice(0, 3).map((b, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-700/50 text-slate-300 text-xs rounded-full">
                                {b}
                              </span>
                            ))}
                            {plan.benefits.length > 3 && (
                              <span className="text-xs text-slate-500">+{plan.benefits.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(plan.price)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                        {BILLING_LABELS[plan.billing_period] || plan.billing_period}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        plan.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-white font-medium">{activeCount}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <button
                        onClick={() => startEdit(plan)}
                        className="px-3 py-1 text-xs bg-slate-600/20 text-slate-300 rounded-lg hover:bg-slate-600/40 transition-all"
                      >
                        Edit
                      </button>
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
            <span className="text-4xl">&#127891;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Membership Plans</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Create membership plans to offer recurring benefits to your loyal customers.
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span> Create First Plan
          </button>
        </div>
      )}
    </div>
  )
}
