'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface LegalExpense {
  id: string
  case_id: string
  expense_type: string
  description: string
  amount: number
  incurred_date: string
  is_billable: boolean
  receipt_url: string | null
  created_at: string
  updated_at: string
}

interface LegalCase {
  id: string
  case_number: string
  title: string
}

const EXPENSE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  filing_fee: { label: 'Нэхэмжлэлийн хураамж', color: 'bg-blue-500/20 text-blue-400' },
  travel: { label: 'Зорчих', color: 'bg-green-500/20 text-green-400' },
  expert_witness: { label: 'Шинжээч гэрч', color: 'bg-purple-500/20 text-purple-400' },
  court_reporter: { label: 'Шүүхийн тэмдэглэгч', color: 'bg-orange-500/20 text-orange-400' },
  copying: { label: 'Хуулбарлах', color: 'bg-slate-500/20 text-slate-400' },
  other: { label: 'Бусад', color: 'bg-yellow-500/20 text-yellow-400' },
}

function formatPrice(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function LegalExpensesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState<LegalExpense[]>([])
  const [total, setTotal] = useState(0)
  const [cases, setCases] = useState<LegalCase[]>([])

  // Filters
  const [caseFilter, setCaseFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formCaseId, setFormCaseId] = useState('')
  const [formExpenseType, setFormExpenseType] = useState('other')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formBillable, setFormBillable] = useState(true)
  const [formReceiptUrl, setFormReceiptUrl] = useState('')

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams()
    if (caseFilter) params.set('case_id', caseFilter)
    if (typeFilter) params.set('expense_type', typeFilter)
    if (billableFilter) params.set('is_billable', billableFilter)
    const url = `/api/legal-expenses${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setExpenses(json.data || [])
      setTotal(json.total || 0)
    }
  }, [caseFilter, typeFilter, billableFilter])

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

      const [, casesRes] = await Promise.all([
        loadExpenses(),
        supabase.from('legal_cases').select('id, case_number, title').eq('store_id', store.id).order('case_number'),
      ])

      if (casesRes.data) setCases(casesRes.data)

      setLoading(false)
    }
    load()
  }, [supabase, loadExpenses])

  useEffect(() => {
    if (!loading) {
      const reload = async () => { await loadExpenses() }
      reload()
    }
  }, [loading, loadExpenses])

  const kpis = useMemo(() => {
    const totalCount = expenses.length
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    const billableAmount = expenses.filter(e => e.is_billable).reduce((sum, e) => sum + (e.amount || 0), 0)
    const nonBillableAmount = expenses.filter(e => !e.is_billable).reduce((sum, e) => sum + (e.amount || 0), 0)
    return [
      { label: 'Нийт зардал', value: totalCount },
      { label: 'Нийт дүн', value: formatPrice(totalAmount) },
      { label: 'Тооцоотой', value: formatPrice(billableAmount) },
      { label: 'Тооцоогүй', value: formatPrice(nonBillableAmount) },
    ]
  }, [expenses])

  const caseMap = useMemo(() => {
    const map: Record<string, string> = {}
    cases.forEach(c => { map[c.id] = `${c.case_number} - ${c.title}` })
    return map
  }, [cases])

  async function handleCreate() {
    if (!formCaseId || !formDescription.trim() || !formAmount) return
    setCreating(true)
    try {
      const res = await fetch('/api/legal-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: formCaseId,
          expense_type: formExpenseType,
          description: formDescription,
          amount: Number(formAmount),
          incurred_date: formDate || undefined,
          is_billable: formBillable,
          receipt_url: formReceiptUrl || undefined,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadExpenses()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormCaseId('')
    setFormExpenseType('other')
    setFormDescription('')
    setFormAmount('')
    setFormDate('')
    setFormBillable(true)
    setFormReceiptUrl('')
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
          <h1 className="text-2xl font-bold text-white">Хууль зүйн зардал</h1>
          <p className="text-slate-400 mt-1">Нийт {total} зардал</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ зардал
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төрөл</option>
            <option value="filing_fee">Нэхэмжлэлийн хураамж</option>
            <option value="travel">Зорчих</option>
            <option value="expert_witness">Шинжээч гэрч</option>
            <option value="court_reporter">Шүүхийн тэмдэглэгч</option>
            <option value="copying">Хуулбарлах</option>
            <option value="other">Бусад</option>
          </select>
          <select
            value={billableFilter}
            onChange={(e) => setBillableFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүгд</option>
            <option value="true">Тооцоотой</option>
            <option value="false">Тооцоогүй</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Огноо</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Хэрэг</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төрөл</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Тайлбар</th>
                <th className="text-center px-4 py-3 text-sm text-slate-400 font-medium">Тооцоотой</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Дүн</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => {
                const ec = EXPENSE_TYPE_CONFIG[expense.expense_type] || EXPENSE_TYPE_CONFIG.other
                return (
                  <tr key={expense.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">
                        {new Date(expense.incurred_date).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-400 text-sm">{caseMap[expense.case_id] || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${ec.color}`}>
                        {ec.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white text-sm">{expense.description}</p>
                        {expense.receipt_url && (
                          <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline mt-0.5 block">
                            Баримт харах
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                        expense.is_billable
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {expense.is_billable ? 'Тийм' : 'Үгүй'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white text-sm font-medium">{formatPrice(expense.amount)}</span>
                    </td>
                  </tr>
                )
              })}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Зардал бүртгэгдээгүй байна
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
              <h2 className="text-lg font-bold text-white">Шинэ зардал бүртгэх</h2>
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
              <label className="block text-sm text-slate-400 mb-1">Зардлын төрөл</label>
              <select
                value={formExpenseType}
                onChange={e => setFormExpenseType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="filing_fee">Нэхэмжлэлийн хураамж</option>
                <option value="travel">Зорчих</option>
                <option value="expert_witness">Шинжээч гэрч</option>
                <option value="court_reporter">Шүүхийн тэмдэглэгч</option>
                <option value="copying">Хуулбарлах</option>
                <option value="other">Бусад</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тайлбар *</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={3}
                placeholder="Зардлын тайлбар"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Дүн *</label>
                <input
                  type="number"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Огноо</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formBillable}
                  onChange={e => setFormBillable(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                />
                Тооцоотой
              </label>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Баримтын URL</label>
              <input
                type="url"
                value={formReceiptUrl}
                onChange={e => setFormReceiptUrl(e.target.value)}
                placeholder="https://..."
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
                disabled={creating || !formCaseId || !formDescription.trim() || !formAmount}
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
