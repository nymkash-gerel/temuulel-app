'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface CaseEvent {
  id: string
  case_id: string
  event_type: string
  title: string
  scheduled_at: string
  location: string | null
  outcome: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface LegalCase {
  id: string
  case_number: string
  title: string
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  hearing: { label: 'Шүүх хурал', color: 'bg-purple-500/20 text-purple-400' },
  filing_deadline: { label: 'Нэхэмжлэлийн хугацаа', color: 'bg-red-500/20 text-red-400' },
  consultation: { label: 'Зөвлөгөө', color: 'bg-blue-500/20 text-blue-400' },
  court_date: { label: 'Шүүхийн өдөр', color: 'bg-orange-500/20 text-orange-400' },
  deposition: { label: 'Мэдүүлэг', color: 'bg-yellow-500/20 text-yellow-400' },
  mediation: { label: 'Эвлэрүүлэх', color: 'bg-green-500/20 text-green-400' },
}

export default function CaseEventsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [total, setTotal] = useState(0)
  const [cases, setCases] = useState<LegalCase[]>([])

  // Filters
  const [caseFilter, setCaseFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formCaseId, setFormCaseId] = useState('')
  const [formEventType, setFormEventType] = useState('hearing')
  const [formTitle, setFormTitle] = useState('')
  const [formScheduledAt, setFormScheduledAt] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formNotes, setFormNotes] = useState('')

  async function loadEvents() {
    const params = new URLSearchParams()
    if (caseFilter) params.set('case_id', caseFilter)
    if (typeFilter) params.set('event_type', typeFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const url = `/api/case-events${params.toString() ? '?' + params.toString() : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setEvents(json.data || [])
      setTotal(json.total || 0)
    }
  }

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
        loadEvents(),
        supabase.from('legal_cases').select('id, case_number, title').eq('store_id', store.id).order('case_number'),
      ])

      if (casesRes.data) setCases(casesRes.data)

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) {
      loadEvents()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFilter, typeFilter, dateFrom, dateTo])

  const kpis = useMemo(() => {
    const totalCount = events.length
    const upcoming = events.filter(e => new Date(e.scheduled_at) > new Date()).length
    const hearings = events.filter(e => e.event_type === 'hearing').length
    const deadlines = events.filter(e => e.event_type === 'filing_deadline').length
    return [
      { label: 'Нийт үйл явдал', value: totalCount },
      { label: 'Ирээдүйн', value: upcoming },
      { label: 'Шүүх хурал', value: hearings },
      { label: 'Хугацаа', value: deadlines },
    ]
  }, [events])

  const caseMap = useMemo(() => {
    const map: Record<string, string> = {}
    cases.forEach(c => { map[c.id] = `${c.case_number} - ${c.title}` })
    return map
  }, [cases])

  async function handleCreate() {
    if (!formCaseId || !formTitle.trim() || !formScheduledAt) return
    setCreating(true)
    try {
      const res = await fetch('/api/case-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: formCaseId,
          event_type: formEventType,
          title: formTitle,
          scheduled_at: formScheduledAt,
          location: formLocation || null,
          notes: formNotes || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadEvents()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormCaseId('')
    setFormEventType('hearing')
    setFormTitle('')
    setFormScheduledAt('')
    setFormLocation('')
    setFormNotes('')
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
          <h1 className="text-2xl font-bold text-white">Хэргийн үйл явдал</h1>
          <p className="text-slate-400 mt-1">Нийт {total} үйл явдал</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ үйл явдал
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
            <option value="hearing">Шүүх хурал</option>
            <option value="filing_deadline">Нэхэмжлэлийн хугацаа</option>
            <option value="consultation">Зөвлөгөө</option>
            <option value="court_date">Шүүхийн өдөр</option>
            <option value="deposition">Мэдүүлэг</option>
            <option value="mediation">Эвлэрүүлэх</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
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
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Огноо/Цаг</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Хэрэг</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Төрөл</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Гарчиг</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Байршил</th>
                <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">Үр дүн</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => {
                const tc = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.hearing
                const isPast = new Date(event.scheduled_at) < new Date()
                return (
                  <tr key={event.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className={`text-sm font-medium ${isPast ? 'text-slate-400' : 'text-white'}`}>
                          {new Date(event.scheduled_at).toLocaleDateString('mn-MN')}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(event.scheduled_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-400 text-sm">{caseMap[event.case_id] || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${tc.color}`}>
                        {tc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white text-sm">{event.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">{event.location || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">{event.outcome || '-'}</span>
                    </td>
                  </tr>
                )
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Хэргийн үйл явдал бүртгэгдээгүй байна
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
              <h2 className="text-lg font-bold text-white">Шинэ үйл явдал бүртгэх</h2>
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
              <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
              <select
                value={formEventType}
                onChange={e => setFormEventType(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="hearing">Шүүх хурал</option>
                <option value="filing_deadline">Нэхэмжлэлийн хугацаа</option>
                <option value="consultation">Зөвлөгөө</option>
                <option value="court_date">Шүүхийн өдөр</option>
                <option value="deposition">Мэдүүлэг</option>
                <option value="mediation">Эвлэрүүлэх</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Гарчиг *</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Үйл явдлын гарчиг"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Товлосон огноо/цаг *</label>
              <input
                type="datetime-local"
                value={formScheduledAt}
                onChange={e => setFormScheduledAt(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Байршил</label>
              <input
                type="text"
                value={formLocation}
                onChange={e => setFormLocation(e.target.value)}
                placeholder="Жишээ: Сүхбаатар дүүргийн шүүх"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Нэмэлт тэмдэглэл"
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
                disabled={creating || !formCaseId || !formTitle.trim() || !formScheduledAt}
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
