'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface DailyLog {
  id: string
  project_id: string
  log_date: string
  weather: string | null
  work_completed: string | null
  issues: string | null
  author_id: string | null
  created_at: string
}

interface Project {
  id: string
  name: string
}

interface Staff {
  id: string
  name: string
}

export default function DailyLogsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [projectFilter, setProjectFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formLogDate, setFormLogDate] = useState('')
  const [formWeather, setFormWeather] = useState('')
  const [formWorkCompleted, setFormWorkCompleted] = useState('')
  const [formIssues, setFormIssues] = useState('')
  const [formAuthorId, setFormAuthorId] = useState('')

  const loadLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' })
    if (projectFilter) params.set('project_id', projectFilter)
    if (dateFilter) params.set('log_date', dateFilter)

    const res = await fetch(`/api/daily-logs?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setLogs(json.data || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }, [projectFilter, dateFilter])

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
        const [, projectsRes, staffRes] = await Promise.all([
          loadLogs(),
          supabase.from('projects').select('id, name').eq('store_id', store.id).order('name'),
          supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
        ])

        if (projectsRes.data) setProjects(projectsRes.data)
        if (staffRes.data) setStaff(staffRes.data)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadLogs])

  useEffect(() => {
    if (loading) return
    const reload = async () => { await loadLogs() }
    reload()
  }, [loading, projectFilter, dateFilter, loadLogs])

  const kpis = useMemo(() => {
    const total = logs.length
    const withIssues = logs.filter(l => l.issues && l.issues.trim()).length
    const uniqueProjects = new Set(logs.map(l => l.project_id)).size
    const todayLogs = logs.filter(l => l.log_date === new Date().toISOString().split('T')[0]).length
    return [
      { label: 'Нийт бүртгэл', value: total },
      { label: 'Өнөөдрийн', value: todayLogs },
      { label: 'Асуудалтай', value: withIssues },
      { label: 'Төслийн тоо', value: uniqueProjects },
    ]
  }, [logs])

  async function handleCreate() {
    if (!formProjectId) return
    setCreating(true)
    try {
      const res = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: formProjectId,
          log_date: formLogDate || undefined,
          weather: formWeather.trim() || null,
          work_completed: formWorkCompleted.trim() || null,
          issues: formIssues.trim() || null,
          author_id: formAuthorId || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadLogs()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormProjectId('')
    setFormLogDate('')
    setFormWeather('')
    setFormWorkCompleted('')
    setFormIssues('')
    setFormAuthorId('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Өдрийн бүртгэл</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} бүртгэл
          </p>
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

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төсөл</label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төсөл</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Огноо</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
        </div>
        {(projectFilter || dateFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setProjectFilter(''); setDateFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {logs.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Цаг агаар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хийсэн ажил</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Асуудал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бүртгэгч</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const project = projects.find(p => p.id === log.project_id)
                const author = staff.find(s => s.id === log.author_id)
                return (
                  <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium text-sm">
                        {new Date(log.log_date).toLocaleDateString('mn-MN')}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{project?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{log.weather || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm truncate max-w-[200px] block" title={log.work_completed || ''}>
                        {log.work_completed || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      {log.issues ? (
                        <span className="text-red-400 text-sm truncate max-w-[200px] block" title={log.issues}>
                          {log.issues}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{author?.name || '-'}</span>
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
            <span className="text-4xl">&#128221;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Өдрийн бүртгэл байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {projectFilter || dateFilter
              ? 'Шүүлтүүрт тохирох бүртгэл олдсонгүй.'
              : 'Шинэ өдрийн бүртгэл нэмж эхлээрэй.'}
          </p>
          {(projectFilter || dateFilter) ? (
            <button
              onClick={() => { setProjectFilter(''); setDateFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm"
            >
              + Шинэ бүртгэл үүсгэх
            </button>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ өдрийн бүртгэл</h2>
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
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Огноо</label>
                <input
                  type="date"
                  value={formLogDate}
                  onChange={e => setFormLogDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Цаг агаар</label>
                <input
                  type="text"
                  value={formWeather}
                  onChange={e => setFormWeather(e.target.value)}
                  placeholder="Цэлмэг, -5C"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Хийсэн ажил</label>
              <textarea
                value={formWorkCompleted}
                onChange={e => setFormWorkCompleted(e.target.value)}
                rows={3}
                placeholder="Өнөөдөр хийсэн ажлуудын тайлбар"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Асуудал / Саад тотгор</label>
              <textarea
                value={formIssues}
                onChange={e => setFormIssues(e.target.value)}
                rows={2}
                placeholder="Тулгарсан асуудлууд"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Бүртгэгч</label>
              <select
                value={formAuthorId}
                onChange={e => setFormAuthorId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
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
                disabled={creating || !formProjectId}
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
