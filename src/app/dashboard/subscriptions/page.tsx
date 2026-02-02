'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface Subscription {
  id: string
  store_id: string
  customer_id: string
  plan_name: string
  billing_period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  amount: number
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'past_due'
  started_at: string
  next_billing_at: string | null
  cancelled_at: string | null
  expires_at: string | null
  auto_renew: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

interface Customer {
  id: string
  name: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400', icon: '✅' },
  paused: { label: 'Түр зогссон', color: 'bg-yellow-500/20 text-yellow-400', icon: '⏸️' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400', icon: '❌' },
  expired: { label: 'Хугацаа дууссан', color: 'bg-slate-500/20 text-slate-400', icon: '⌛' },
  past_due: { label: 'Хугацаа хэтэрсэн', color: 'bg-orange-500/20 text-orange-400', icon: '⚠️' },
}

const BILLING_PERIOD_LABELS: Record<string, string> = {
  weekly: '7 хоног',
  monthly: 'Сар бүр',
  quarterly: 'Улирал бүр',
  yearly: 'Жил бүр',
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

export default function SubscriptionsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form state
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formPlanName, setFormPlanName] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formBillingPeriod, setFormBillingPeriod] = useState('monthly')
  const [formAutoRenew, setFormAutoRenew] = useState(true)
  const [formNotes, setFormNotes] = useState('')

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
        // Load subscriptions from API and customers from Supabase in parallel
        const [subsRes, customersRes] = await Promise.all([
          fetch(`/api/subscriptions?store_id=${store.id}`),
          supabase
            .from('customers')
            .select('id, name')
            .eq('store_id', store.id)
            .order('name'),
        ])

        if (subsRes.ok) {
          const { data } = await subsRes.json()
          if (data) setSubscriptions(data as Subscription[])
        }

        if (customersRes.data) {
          setCustomers(customersRes.data as Customer[])
          const map: Record<string, string> = {}
          for (const c of customersRes.data) {
            map[c.id] = c.name || 'Нэргүй'
          }
          setCustomerMap(map)
        }
      }
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const filtered = useMemo(() => {
    let result = subscriptions
    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter)
    }
    if (periodFilter) {
      result = result.filter(s => s.billing_period === periodFilter)
    }
    return result
  }, [subscriptions, statusFilter, periodFilter])

  const kpis = useMemo(() => {
    const total = subscriptions.length
    const active = subscriptions.filter(s => s.status === 'active').length
    const paused = subscriptions.filter(s => s.status === 'paused').length
    const mrr = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.amount || 0), 0)
    return [
      { label: 'Нийт захиалга', value: total },
      { label: 'Идэвхтэй', value: active },
      { label: 'Түр зогссон', value: paused },
      { label: 'Сарын орлого', value: new Intl.NumberFormat('mn-MN').format(mrr) + '₮' },
    ]
  }, [subscriptions])

  async function handleCreate() {
    if (!formPlanName.trim() || !formAmount || !formCustomerId) return
    setCreating(true)

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: formCustomerId,
          plan_name: formPlanName.trim(),
          amount: Number(formAmount),
          billing_period: formBillingPeriod,
          auto_renew: formAutoRenew,
          notes: formNotes.trim() || undefined,
        }),
      })

      if (res.ok) {
        const { data: newSub } = await res.json()
        if (newSub) {
          setSubscriptions(prev => [newSub, ...prev])
        }
        setShowCreateForm(false)
        setFormCustomerId('')
        setFormPlanName('')
        setFormAmount('')
        setFormBillingPeriod('monthly')
        setFormAutoRenew(true)
        setFormNotes('')
      } else {
        const err = await res.json()
        alert(err.error || 'Алдаа гарлаа')
      }
    } catch {
      alert('Алдаа гарлаа')
    } finally {
      setCreating(false)
    }
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
          <h1 className="text-2xl font-bold text-white">Захиалга (Subscription)</h1>
          <p className="text-slate-400 mt-1">
            Нийт {subscriptions.length} захиалга
            {filtered.length !== subscriptions.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/subscriptions/new"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
        >
          + Шинэ захиалга
        </Link>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="active">Идэвхтэй</option>
              <option value="paused">Түр зогссон</option>
              <option value="cancelled">Цуцлагдсан</option>
              <option value="expired">Хугацаа дууссан</option>
              <option value="past_due">Хугацаа хэтэрсэн</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх хугацаа</option>
              <option value="weekly">7 хоног</option>
              <option value="monthly">Сар бүр</option>
              <option value="quarterly">Улирал бүр</option>
              <option value="yearly">Жил бүр</option>
            </select>
          </div>
          {(statusFilter || periodFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setPeriodFilter('') }}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-4">Шинэ захиалга үүсгэх</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Харилцагч *</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Харилцагч сонгоно уу</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name || 'Нэргүй'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Багцын нэр *</label>
                <input
                  type="text"
                  value={formPlanName}
                  onChange={(e) => setFormPlanName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  placeholder="Жишээ: Premium багц"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Дүн (₮) *</label>
                  <input
                    type="number"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    placeholder="50000"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Төлбөрийн хугацаа</label>
                  <select
                    value={formBillingPeriod}
                    onChange={(e) => setFormBillingPeriod(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="weekly">7 хоног</option>
                    <option value="monthly">Сар бүр</option>
                    <option value="quarterly">Улирал бүр</option>
                    <option value="yearly">Жил бүр</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoRenew}
                    onChange={(e) => setFormAutoRenew(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-sm text-slate-300">Автомат сунгалт</span>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Нэмэлт мэдээлэл..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
              >
                Цуцлах
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formPlanName.trim() || !formAmount || !formCustomerId}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Үүсгэж байна...' : 'Захиалга үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Багцын нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Харилцагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлбөрийн хугацаа</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дараагийн төлбөр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Автомат сунгалт</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const sc = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active
                return (
                  <tr key={sub.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{sub.plan_name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white">{customerMap[sub.customer_id] || 'Нэргүй'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{formatPrice(sub.amount)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-400">
                        {BILLING_PERIOD_LABELS[sub.billing_period] || sub.billing_period}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {sub.next_billing_at
                          ? new Date(sub.next_billing_at).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {sub.auto_renew ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Тийм</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400">Үгүй</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : subscriptions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Хайлтад тохирох захиалга олдсонгүй</p>
          <button
            onClick={() => { setStatusFilter(''); setPeriodFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🔄</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Захиалга байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Давтагддаг захиалга (subscription) үүсгэж харилцагчдынхаа төлбөрийг автоматжуулаарай
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all"
          >
            Эхний захиалга үүсгэх
          </button>
        </div>
      )}
    </div>
  )
}
