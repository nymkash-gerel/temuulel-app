'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'

interface Project {
  id: string
  name: string
  description: string | null
  project_type: string
  status: string
  priority: string
  start_date: string | null
  end_date: string | null
  budget: number | null
  actual_cost: number | null
  completion_percentage: number
  location: string | null
  notes: string | null
  customer_id: string | null
  manager_id: string | null
  created_at: string
  updated_at: string
}

interface Customer {
  id: string
  name: string | null
}

interface Staff {
  id: string
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: 'Төлөвлөж буй', color: 'bg-slate-500/20 text-slate-400' },
  in_progress: { label: 'Хийгдэж буй', color: 'bg-blue-500/20 text-blue-400' },
  on_hold: { label: 'Түр зогссон', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  construction: 'Барилга',
  renovation: 'Засвар шинэчлэл',
  maintenance: 'Засвар үйлчилгээ',
  design: 'Дизайн',
  consulting: 'Зөвлөх',
  other: 'Бусад',
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Дунд', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function ProjectsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formProjectType, setFormProjectType] = useState('construction')
  const [formPriority, setFormPriority] = useState('medium')
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formManagerId, setFormManagerId] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formBudget, setFormBudget] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formNotes, setFormNotes] = useState('')

  async function loadProjects() {
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)
    if (typeFilter) params.set('project_type', typeFilter)
    if (priorityFilter) params.set('priority', priorityFilter)

    const res = await fetch(`/api/projects?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setProjects(json.data || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }

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
        const [, customersRes, staffRes] = await Promise.all([
          loadProjects(),
          supabase.from('customers').select('id, name').eq('store_id', store.id).order('name'),
          supabase.from('staff').select('id, name').eq('store_id', store.id).order('name'),
        ])

        if (customersRes.data) setCustomers(customersRes.data)
        if (staffRes.data) setStaff(staffRes.data)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading) return
    loadProjects()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, priorityFilter])

  // KPI calculations
  const kpis = useMemo(() => {
    const total = projects.length
    const active = projects.filter(p => p.status === 'in_progress').length
    const planning = projects.filter(p => p.status === 'planning').length
    const completed = projects.filter(p => p.status === 'completed').length
    return [
      { label: 'Нийт төсөл', value: total },
      { label: 'Төлөвлөж буй', value: planning },
      { label: 'Явагдаж буй', value: active },
      { label: 'Дууссан', value: completed },
    ]
  }, [projects])

  async function handleCreate() {
    if (!formName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          project_type: formProjectType,
          priority: formPriority,
          customer_id: formCustomerId || null,
          manager_id: formManagerId || null,
          start_date: formStartDate || null,
          end_date: formEndDate || null,
          budget: formBudget ? Number(formBudget) : null,
          location: formLocation.trim() || null,
          notes: formNotes.trim() || null,
        }),
      })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        await loadProjects()
      }
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setFormName('')
    setFormDescription('')
    setFormProjectType('construction')
    setFormPriority('medium')
    setFormCustomerId('')
    setFormManagerId('')
    setFormStartDate('')
    setFormEndDate('')
    setFormBudget('')
    setFormLocation('')
    setFormNotes('')
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
          <h1 className="text-2xl font-bold text-white">Төслүүд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} төсөл
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          + Шинэ төсөл
        </Link>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="planning">Төлөвлөж буй</option>
              <option value="in_progress">Хийгдэж буй</option>
              <option value="on_hold">Түр зогссон</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төрөл</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төрөл</option>
              <option value="construction">Барилга</option>
              <option value="renovation">Засвар шинэчлэл</option>
              <option value="maintenance">Засвар үйлчилгээ</option>
              <option value="design">Дизайн</option>
              <option value="consulting">Зөвлөх</option>
              <option value="other">Бусад</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ач холбогдол</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх зэрэг</option>
              <option value="low">Бага</option>
              <option value="medium">Дунд</option>
              <option value="high">Өндөр</option>
              <option value="urgent">Яаралтай</option>
            </select>
          </div>
        </div>
        {(statusFilter || typeFilter || priorityFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter(''); setPriorityFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Projects Table */}
      {projects.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нэр</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төрөл</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Ач холбогдол</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Гүйцэтгэл</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бодит зардал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Байршил</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хугацаа</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const sc = STATUS_CONFIG[project.status] || { label: project.status, color: 'bg-slate-500/20 text-slate-400' }
                const pc = PRIORITY_CONFIG[project.priority] || { label: project.priority, color: 'bg-slate-500/20 text-slate-400' }
                const completion = project.completion_percentage || 0
                const progressColor = completion >= 80
                  ? 'bg-green-500'
                  : completion >= 50
                    ? 'bg-blue-500'
                    : completion >= 25
                      ? 'bg-yellow-500'
                      : 'bg-slate-500'

                return (
                  <tr key={project.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white font-medium">{project.name}</p>
                        {project.description && (
                          <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[200px]" title={project.description}>
                            {project.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColor}`}
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-300 w-9 text-right">{completion}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white text-sm">
                        {project.budget != null ? formatPrice(project.budget) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className={`text-sm ${
                        project.budget && project.actual_cost && project.actual_cost > project.budget
                          ? 'text-red-400'
                          : 'text-slate-300'
                      }`}>
                        {project.actual_cost != null ? formatPrice(project.actual_cost) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm truncate max-w-[150px] block" title={project.location || ''}>
                        {project.location || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div className="text-xs text-slate-400">
                        {project.start_date
                          ? new Date(project.start_date).toLocaleDateString('mn-MN')
                          : '-'}
                        {project.end_date && (
                          <>
                            {' - '}
                            {new Date(project.end_date).toLocaleDateString('mn-MN')}
                          </>
                        )}
                      </div>
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
            <span className="text-4xl">&#128215;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Төсөл байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || typeFilter || priorityFilter
              ? 'Шүүлтүүрт тохирох төсөл олдсонгүй. Шүүлтүүрээ өөрчилж үзнэ үү.'
              : 'Шинэ төсөл нэмж барилгын ажлуудаа удирдаарай.'}
          </p>
          {(statusFilter || typeFilter || priorityFilter) ? (
            <button
              onClick={() => { setStatusFilter(''); setTypeFilter(''); setPriorityFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm"
            >
              + Шинэ төсөл үүсгэх
            </button>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Шинэ төсөл</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Төслийн нэр *</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Төслийн нэрийг оруулна уу"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тайлбар</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={3}
                placeholder="Төслийн тайлбар"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Төрөл</label>
                <select
                  value={formProjectType}
                  onChange={e => setFormProjectType(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="construction">Барилга</option>
                  <option value="renovation">Засвар шинэчлэл</option>
                  <option value="maintenance">Засвар үйлчилгээ</option>
                  <option value="design">Дизайн</option>
                  <option value="consulting">Зөвлөх</option>
                  <option value="other">Бусад</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ач холбогдол</label>
                <select
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="low">Бага</option>
                  <option value="medium">Дунд</option>
                  <option value="high">Өндөр</option>
                  <option value="urgent">Яаралтай</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Захиалагч</label>
              <select
                value={formCustomerId}
                onChange={e => setFormCustomerId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name || 'Нэргүй'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Менежер</label>
              <select
                value={formManagerId}
                onChange={e => setFormManagerId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">-- Сонгох --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Эхлэх огноо</label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={e => setFormStartDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Дуусах огноо</label>
                <input
                  type="date"
                  value={formEndDate}
                  onChange={e => setFormEndDate(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Төсөв</label>
              <input
                type="number"
                value={formBudget}
                onChange={e => setFormBudget(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Байршил</label>
              <input
                type="text"
                value={formLocation}
                onChange={e => setFormLocation(e.target.value)}
                placeholder="Байршлын мэдээлэл"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Тэмдэглэл</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Нэмэлт тэмдэглэл"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
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
                disabled={creating || !formName.trim()}
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
