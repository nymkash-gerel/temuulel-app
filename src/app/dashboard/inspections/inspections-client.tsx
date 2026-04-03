'use client'

import { useState, useMemo, useCallback } from 'react'
import KpiCards from '@/components/ui/KpiCards'

interface Inspection {
  id: string
  project_id: string
  inspection_type: string
  inspector_name: string
  scheduled_date: string
  result: string
  required_corrections: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  name: string
}

const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  pass: { label: 'Тэнцсэн', color: 'bg-green-500/20 text-green-400' },
  fail: { label: 'Тэнцээгүй', color: 'bg-red-500/20 text-red-400' },
  partial: { label: 'Хэсэгчилсэн', color: 'bg-yellow-500/20 text-yellow-400' },
}

const TYPE_LABELS: Record<string, string> = {
  structural: 'Бүтцийн',
  electrical: 'Цахилгаан',
  plumbing: 'Сантехник',
  fire: 'Галын аюулгүй байдал',
  final: 'Эцсийн',
  other: 'Бусад',
}

interface InspectionsClientProps {
  initialInspections: Inspection[]
  initialTotal: number
  initialProjects: Project[]
}

export default function InspectionsClient({ initialInspections, initialTotal, initialProjects }: InspectionsClientProps) {
  const [inspections, setInspections] = useState<Inspection[]>(initialInspections)
  const [totalCount, setTotalCount] = useState(initialTotal)
  const projects = initialProjects
  const [resultFilter, setResultFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formInspectionType, setFormInspectionType] = useState('structural')
  const [formInspectorName, setFormInspectorName] = useState('')
  const [formScheduledDate, setFormScheduledDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadInspections = useCallback(async (result?: string, type?: string) => {
    const params = new URLSearchParams({ limit: '200' })
    if (result) params.set('result', result)
    if (type) params.set('inspection_type', type)

    const res = await fetch(`/api/inspections?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setInspections(json.data || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }, [])

  const handleFilterChange = useCallback((newResult: string, newType: string) => {
    setResultFilter(newResult)
    setTypeFilter(newType)
    loadInspections(newResult, newType)
  }, [loadInspections])

  const kpis = useMemo(() => {
    const total = inspections.length
    const pending = inspections.filter(i => i.result === 'pending').length
    const passed = inspections.filter(i => i.result === 'pass').length
    const failed = inspections.filter(i => i.result === 'fail').length
    return [
      { label: 'Нийт шалгалт', value: total },
      { label: 'Хүлээгдэж буй', value: pending },
      { label: 'Тэнцсэн', value: passed },
      { label: 'Тэнцээгүй', value: failed },
    ]
  }, [inspections])

  async function handleCreate() {
    if (!formProjectId || !formInspectorName.trim() || !formScheduledDate) return
    setCreating(true)
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: formProjectId,
          inspection_type: formInspectionType,
          inspector_name: formInspectorName.trim(),
          scheduled_date: formScheduledDate,
          notes: formNotes.trim() || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadInspections(resultFilter, typeFilter)
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormProjectId('')
    setFormInspectionType('structural')
    setFormInspectorName('')
    setFormScheduledDate('')
    setFormNotes('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Шалгалтууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} шалгалт
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ шалгалт
        </button>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Үр дүн</label>
            <select
              value={resultFilter}
              onChange={(e) => handleFilterChange(e.target.value, typeFilter)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">Бүх үр дүн</option>
              <option value="pending">Хүлээгдэж буй</option>
              <option value="pass">Тэнцсэн</option>
              <option value="fail">Тэнцээгүй</option>
              <option value="partial">Хэсэгчилсэн</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төрөл</label>
            <select
              value={typeFilter}
              onChange={(e) => handleFilterChange(resultFilter, e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.06] rounded-xl text-white focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="structural">Бүтцийн</option>
              <option value="electrical">Цахилгаан</option>
              <option value="plumbing">Сантехник</option>
              <option value="fire">Галын аюулгүй байдал</option>
              <option value="final">Эцсийн</option>
              <option value="other">Бусад</option>
            </select>
          </div>
        </div>
        {(resultFilter || typeFilter) && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <button
              onClick={() => handleFilterChange('', '')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {inspections.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Шалгагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөл</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үр дүн</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Товлосон огноо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Засах шаардлага</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((insp) => {
                const rc = RESULT_CONFIG[insp.result] || { label: insp.result, color: 'bg-slate-500/20 text-slate-400' }
                const project = projects.find(p => p.id === insp.project_id)
                return (
                  <tr key={insp.id} className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className="text-white font-medium">{insp.inspector_name}</p>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {TYPE_LABELS[insp.inspection_type] || insp.inspection_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{project?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${rc.color}`}>
                        {rc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {new Date(insp.scheduled_date).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm truncate max-w-[200px] block" title={insp.required_corrections || ''}>
                        {insp.required_corrections || '-'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128269;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Шалгалт байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {resultFilter || typeFilter
              ? 'Шүүлтүүрт тохирох шалгалт олдсонгүй.'
              : 'Шинэ шалгалт нэмж эхлээрэй.'}
          </p>
          {(resultFilter || typeFilter) ? (
            <button
              onClick={() => handleFilterChange('', '')}
              className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm"
            >
              + Шинэ шалгалт үүсгэх
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ шалгалт</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Төсөл *</label>
              <select
                value={formProjectId}
                onChange={e => setFormProjectId(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
              <select
                value={formInspectionType}
                onChange={e => setFormInspectionType(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="structural">Бүтцийн</option>
                <option value="electrical">Цахилгаан</option>
                <option value="plumbing">Сантехник</option>
                <option value="fire">Галын аюулгүй байдал</option>
                <option value="final">Эцсийн</option>
                <option value="other">Бусад</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Шалгагчийн нэр *</label>
              <input
                type="text"
                value={formInspectorName}
                onChange={e => setFormInspectorName(e.target.value)}
                placeholder="Шалгагчийн нэр"
                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Товлосон огноо *</label>
              <input
                type="date"
                value={formScheduledDate}
                onChange={e => setFormScheduledDate(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Нэмэлт тэмдэглэл"
                className="w-full bg-white/[0.06] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/20"
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
                disabled={creating || !formProjectId || !formInspectorName.trim() || !formScheduledDate}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Үүсгэж байна...' : 'Үүсгэх'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
