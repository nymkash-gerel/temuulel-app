'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Customer {
  id: string
  name: string | null
}

interface TreatmentPlan {
  id: string
  name: string
  description: string | null
  customer_id: string | null
  customer?: Customer | null
  sessions_total: number
  sessions_used: number
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

interface TreatmentPlanForm {
  name: string
  customer_id: string
  description: string
  sessions_total: number
  start_date: string
  end_date: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Бүгд' },
  { value: 'active', label: 'Идэвхтэй' },
  { value: 'completed', label: 'Дууссан' },
  { value: 'paused', label: 'Түр зогссон' },
  { value: 'cancelled', label: 'Цуцлагдсан' },
]

const STATUS_LABELS: Record<string, string> = {
  active: 'Идэвхтэй',
  completed: 'Дууссан',
  paused: 'Түр зогссон',
  cancelled: 'Цуцлагдсан',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  completed: 'bg-blue-500/20 text-blue-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const INITIAL_FORM: TreatmentPlanForm = {
  name: '',
  customer_id: '',
  description: '',
  sessions_total: 1,
  start_date: '',
  end_date: '',
}

export default function TreatmentPlansPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TreatmentPlanForm>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchPlans = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/treatment-plans${params.toString() ? `?${params.toString()}` : ''}`)
      if (!res.ok) {
        throw new Error('Failed to fetch treatment plans')
      }
      const body = await res.json()
      setPlans(Array.isArray(body) ? body : body.data || [])
    } catch {
      setError('Could not load treatment plans')
    } finally {
      setLoading(false)
    }
  }, [supabase, statusFilter])

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('id, name')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setCustomers(data || [])
    } catch {
      // Silently handle customer fetch error
    }
  }, [supabase])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const filtered = useMemo(() => {
    let result = plans

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.customer && (p.customer.name || '').toLowerCase().includes(q))
      )
    }

    return result
  }, [plans, search])

  const kpis = useMemo(() => ({
    total: plans.length,
    active: plans.filter((p) => p.status === 'active').length,
    completed: plans.filter((p) => p.status === 'completed').length,
    paused: plans.filter((p) => p.status === 'paused').length,
  }), [plans])

  function handleFormChange(field: keyof TreatmentPlanForm, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    if (!form.name.trim()) {
      setError('Нэр оруулна уу')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          customer_id: form.customer_id || null,
          description: form.description.trim() || null,
          sessions_total: form.sessions_total || 1,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to create treatment plan')
      }

      setSuccess('Эмчилгээний төлөвлөгөө амжилттай үүсгэлээ')
      setForm(INITIAL_FORM)
      setShowForm(false)
      await fetchPlans()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  function getSessionPercent(used: number, total: number): number {
    if (!total || total <= 0) return 0
    return Math.min(Math.round((used / total) * 100), 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Эмчилгээний төлөвлөгөө</h1>
          <p className="text-slate-400 mt-1">
            Нийт {plans.length} төлөвлөгөө
            {filtered.length !== plans.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/treatment-plans/new"
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl text-sm transition-all inline-flex items-center gap-2"
        >
          + Шинэ төлөвлөгөө
        </Link>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Нийт төлөвлөгөө</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Идэвхтэй</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.active}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Дууссан</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.completed}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Түр зогссон</p>
          <p className="text-2xl font-bold text-white mt-1">{kpis.paused}</p>
        </div>
      </div>

      {/* Create Treatment Plan Form */}
      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Шинэ төлөвлөгөө</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Нэр <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="Төлөвлөгөөний нэр"
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Үйлчлүүлэгч
                </label>
                <select
                  value={form.customer_id}
                  onChange={(e) => handleFormChange('customer_id', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="">Сонгох...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Нэргүй'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sessions Total */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Нийт сессийн тоо
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.sessions_total}
                  onChange={(e) => handleFormChange('sessions_total', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Эхлэх огноо
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => handleFormChange('start_date', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Дуусах огноо
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => handleFormChange('end_date', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Тайлбар
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="Төлөвлөгөөний тайлбар..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all"
              >
                {submitting ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setError(null) }}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
              >
                Болих
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters: Search + Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Нэр, тайлбар, үйлчлүүлэгчээр хайх..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Treatment Plans Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үйлчлүүлэгч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Сесс</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Эхлэх огноо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах огноо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үүсгэсэн</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((plan) => {
                const percent = getSessionPercent(plan.sessions_used, plan.sessions_total)
                return (
                  <tr key={plan.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{plan.name}</span>
                      {plan.description && (
                        <p className="text-slate-500 text-xs mt-0.5 truncate max-w-[200px]">{plan.description}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {plan.customer
                          ? (plan.customer.name || 'Нэргүй')
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="min-w-[120px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300">{plan.sessions_used} / {plan.sessions_total}</span>
                          <span className="text-slate-400">{percent}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {plan.start_date
                          ? new Date(plan.start_date).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {plan.end_date
                          ? new Date(plan.end_date).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[plan.status] || 'bg-slate-500/20 text-slate-400'}`}>
                        {STATUS_LABELS[plan.status] || plan.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {new Date(plan.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : plans.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох төлөвлөгөө олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Төлөвлөгөө байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Дээрх &quot;+ Шинэ төлөвлөгөө&quot; товчийг дарж эхний эмчилгээний төлөвлөгөөг үүсгэнэ үү.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl transition-all inline-block"
          >
            + Шинэ төлөвлөгөө
          </button>
        </div>
      )}
    </div>
  )
}
