'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface TimeEntry {
  id: string
  case_id: string
  staff_id: string | null
  description: string
  hours: number
  billable_rate: number
  is_billable: boolean
  entry_date: string
  created_at: string
  updated_at: string
}

interface LegalCase {
  id: string
  case_number: string
  title: string
}

interface Staff {
  id: string
  name: string
}

function formatPrice(amount: number | null) {
  if (!amount) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function TimeTrackingPage() {
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [total, setTotal] = useState(0)
  const [cases, setCases] = useState<LegalCase[]>([])
  const [staff, setStaff] = useState<Staff[]>([])

  // Filters
  const [caseFilter, setCaseFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formCaseId, setFormCaseId] = useState('')
  const [formStaffId, setFormStaffId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formHours, setFormHours] = useState('')
  const [formRate, setFormRate] = useState('')
  const [formBillable, setFormBillable] = useState(true)
  const [formDate, setFormDate] = useState('')

  const loadEntries = useCallback(async () => {
    const params = new URLSearchParams()
    if (caseFilter) params.set('case_id', caseFilter)
    if (billableFilter) params.set('is_billable', billableFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const url = `/api/time-entries${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setEntries(json.data || [])
      setTotal(json.total || 0)
    }
  }, [caseFilter, billableFilter, dateFrom, dateTo])

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

      const [, casesRes, staffRes] = await Promise.all([
        loadEntries(),
        supabase.from('legal_cases').select('id, case_number, title').eq('store_id', store.id).order('case_number'),
        supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
      ])

      if (casesRes.data) setCases(casesRes.data)
      if (staffRes.data) setStaff(staffRes.data)

      setLoading(false)
    }
    load()
  }, [supabase, loadEntries])

  useEffect(() => {
    if (!loading) {
      const reload = async () => { await loadEntries() }
      reload()
    }
  }, [caseFilter, billableFilter, dateFrom, dateTo, loadEntries, loading])

  const kpis = useMemo(() => {
    const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)
    const billableHours = entries.filter(e => e.is_billable).reduce((sum, e) => sum + (e.hours || 0), 0)
    const totalRevenue = entries.filter(e => e.is_billable).reduce((sum, e) => sum + (e.hours * e.billable_rate), 0)
    const entryCount = entries.length
    return [
      { label: 'Нийт бүртгэл', value: entryCount },
      { label: 'Нийт цаг', value: totalHours.toFixed(1) },
      { label: 'Тооцоотой цаг', value: billableHours.toFixed(1) },
      { label: 'Нийт орлого', value: formatPrice(totalRevenue) },
    ]
  }, [entries])

  const caseMap = useMemo(() => {
    const map: Record<string, string> = {}
    cases.forEach(c => { map[c.id] = `${c.case_number} - ${c.title}` })
    return map
  }, [cases])

  const staffMap = useMemo(() => {
    const map: Record<string, string> = {}
    staff.forEach(s => { map[s.id] = s.name })
    return map
  }, [staff])

  async function handleCreate() {
    if (!formCaseId || !formDescription.trim() || !formHours) return
    setCreating(true)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: formCaseId,
          staff_id: formStaffId || null,
          description: formDescription,
          hours: Number(formHours),
          billable_rate: formRate ? Number(formRate) : 0,
          is_billable: formBillable,
          entry_date: formDate || undefined,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadEntries()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormCaseId('')
    setFormStaffId('')
    setFormDescription('')
    setFormHours('')
    setFormRate('')
    setFormBillable(true)
    setFormDate('')
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
          <h1 className="text-2xl font-bold text-white">Цагийн бүртгэл</h1>
          <p className="text-slate-400 mt-1">Нийт {total} бүртгэл</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ бүртгэл
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
            value={billableFilter}
            onChange={(e) => setBillableFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">Бүх төрөл</option>
            <option value="true">Тооцоотой</option>
            <option value="false">Тооцоогүй</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Эхлэх огноо"
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Дуусах огноо"
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          />
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
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Ажилтан</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Тайлбар</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Цаг</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Үнэ/цаг</th>
                <th className="text-center px-4 py-3 text-sm text-slate-400 font-medium">Тооцоотой</th>
                <th className="text-right px-4 py-3 text-sm text-slate-400 font-medium">Дүн</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-slate-300 text-sm">
                      {new Date(entry.entry_date).toLocaleDateString('mn-MN')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-blue-400 text-sm">{caseMap[entry.case_id] || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300 text-sm">
                      {entry.staff_id ? (staffMap[entry.staff_id] || '-') : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white text-sm">{entry.description}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white text-sm font-medium">{entry.hours}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-slate-300 text-sm">{formatPrice(entry.billable_rate)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                      entry.is_billable
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {entry.is_billable ? 'Тийм' : 'Үгүй'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white text-sm font-medium">
                      {entry.is_billable ? formatPrice(entry.hours * entry.billable_rate) : '-'}
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    Цагийн бүртгэл байхгүй байна
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
              <h2 className="text-lg font-bold text-white">Шинэ цагийн бүртгэл</h2>
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
              <label className="block text-sm text-slate-400 mb-1">Ажилтан</label>
              <select
                value={formStaffId}
                onChange={e => setFormStaffId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Сонгох --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тайлбар *</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={3}
                placeholder="Хийсэн ажлын тайлбар"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Цаг *</label>
                <input
                  type="number"
                  step="0.25"
                  value={formHours}
                  onChange={e => setFormHours(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Үнэ/цаг</label>
                <input
                  type="number"
                  value={formRate}
                  onChange={e => setFormRate(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Огноо</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
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
                disabled={creating || !formCaseId || !formDescription.trim() || !formHours}
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
