'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface Retainer {
  id: string
  case_id: string
  client_id: string | null
  initial_amount: number
  current_balance: number
  status: string
  created_at: string
  updated_at: string
}

interface LegalCase {
  id: string
  case_number: string
  title: string
}

interface Customer {
  id: string
  name: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  depleted: { label: 'Дууссан', color: 'bg-red-500/20 text-red-400' },
  refunded: { label: 'Буцаагдсан', color: 'bg-yellow-500/20 text-yellow-400' },
}

function formatPrice(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function RetainersPage() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [retainers, setRetainers] = useState<Retainer[]>([])
  const [total, setTotal] = useState(0)
  const [cases, setCases] = useState<LegalCase[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  // Filters
  const [caseFilter, setCaseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formCaseId, setFormCaseId] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formInitialAmount, setFormInitialAmount] = useState('')

  const loadRetainers = useCallback(async () => {
    const params = new URLSearchParams()
    if (caseFilter) params.set('case_id', caseFilter)
    if (statusFilter) params.set('status', statusFilter)
    const url = `/api/retainers${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setRetainers(json.data || [])
      setTotal(json.total || 0)
    }
  }, [caseFilter, statusFilter])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) return

      const [, casesRes, customersRes] = await Promise.all([
        loadRetainers(),
        supabase.from('legal_cases').select('id, case_number, title').eq('store_id', store.id).order('case_number'),
        supabase.from('customers').select('id, name').eq('store_id', store.id).order('name'),
      ])

      if (casesRes.data) setCases(casesRes.data)
      if (customersRes.data) setCustomers(customersRes.data)

      setLoading(false)
    }
    load()
  }, [supabase, loadRetainers])

  useEffect(() => {
    if (!loading) {
      const reload = async () => { await loadRetainers() }
      reload()
    }
  }, [caseFilter, statusFilter, loading, loadRetainers])

  const kpis = useMemo(() => {
    const totalCount = retainers.length
    const active = retainers.filter(r => r.status === 'active').length
    const totalInitial = retainers.reduce((sum, r) => sum + (r.initial_amount || 0), 0)
    const totalBalance = retainers.reduce((sum, r) => sum + (r.current_balance || 0), 0)
    return [
      { label: 'Нийт урьдчилгаа', value: totalCount },
      { label: 'Идэвхтэй', value: active },
      { label: 'Нийт дүн', value: formatPrice(totalInitial) },
      { label: 'Үлдэгдэл', value: formatPrice(totalBalance) },
    ]
  }, [retainers])

  const caseMap = useMemo(() => {
    const map: Record<string, string> = {}
    cases.forEach(c => { map[c.id] = `${c.case_number} - ${c.title}` })
    return map
  }, [cases])

  const customerMap = useMemo(() => {
    const map: Record<string, string> = {}
    customers.forEach(c => { map[c.id] = c.name || 'N/A' })
    return map
  }, [customers])

  async function handleCreate() {
    if (!formCaseId || !formInitialAmount) return
    setCreating(true)
    try {
      const res = await fetch('/api/retainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: formCaseId,
          client_id: formClientId || null,
          initial_amount: Number(formInitialAmount),
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadRetainers()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormCaseId('')
    setFormClientId('')
    setFormInitialAmount('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Урьдчилгаа төлбөр</h1>
          <p className="text-slate-400 mt-1">Нийт {total} урьдчилгаа</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ урьдчилгаа
        </button>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filter Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <select
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх хэрэг</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төлөв</option>
            <option value="active">Идэвхтэй</option>
            <option value="depleted">Дууссан</option>
            <option value="refunded">Буцаагдсан</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Хэрэг</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Үйлчлүүлэгч</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төлөв</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Анхны дүн</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Үлдэгдэл</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Ашиглагдсан</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Огноо</th>
              </tr>
            </thead>
            <tbody>
              {retainers.map(retainer => {
                const sc = STATUS_CONFIG[retainer.status] || STATUS_CONFIG.active
                const used = retainer.initial_amount - retainer.current_balance
                const usedPercent = retainer.initial_amount > 0
                  ? Math.round((used / retainer.initial_amount) * 100)
                  : 0
                return (
                  <tr key={retainer.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-blue-400 text-sm">{caseMap[retainer.case_id] || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {retainer.client_id ? (customerMap[retainer.client_id] || '-') : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white text-sm font-medium">{formatPrice(retainer.initial_amount)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white text-sm font-medium">{formatPrice(retainer.current_balance)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="text-slate-300 text-sm">{formatPrice(used)}</p>
                        <div className="mt-1 w-full bg-slate-700 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(usedPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{usedPercent}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {new Date(retainer.created_at).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {retainers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Урьдчилгаа бүртгэгдээгүй байна
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ урьдчилгаа бүртгэх</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Хэрэг *</label>
              <select
                value={formCaseId}
                onChange={e => setFormCaseId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Сонгох --</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Үйлчлүүлэгч</label>
              <select
                value={formClientId}
                onChange={e => setFormClientId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Сонгох --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name || 'N/A'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Анхны дүн *</label>
              <input
                type="number"
                value={formInitialAmount}
                onChange={e => setFormInitialAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Болих
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !formCaseId || !formInitialAmount}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Бүртгэж байна...' : 'Бүртгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
