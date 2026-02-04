'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { projectTransitions } from '@/lib/status-machine'

interface Project {
  id: string
  name: string
  customer_id: string | null
  manager_id: string | null
  project_type: string
  priority: string
  status: string
  description: string | null
  start_date: string | null
  end_date: string | null
  budget: number | null
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string } | null
}

interface ProjectTask {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  status: string
  priority: string
  due_date: string | null
  completed_at: string | null
  estimated_hours: number | null
  sort_order: number
  created_at: string
  updated_at: string
  staff: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planning: { label: 'Төлөвлөж буй', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  on_hold: { label: 'Түр зогссон', color: 'bg-orange-500/20 text-orange-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Төлөвлөж байна',
  in_progress: 'Явагдаж байна',
  on_hold: 'Түр зогссон',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
}

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  todo: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  review: { label: 'Хянагдаж буй', color: 'bg-purple-500/20 text-purple-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Дунд', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  construction: 'Барилга',
  renovation: 'Засвар шинэчлэл',
  maintenance: 'Засвар үйлчилгээ',
  design: 'Дизайн',
  consulting: 'Зөвлөх',
  other: 'Бусад',
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateDurationDays(start: string, end: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / msPerDay))
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { setLoading(false); return }

    const [projectRes, tasksRes] = await Promise.all([
      supabase
        .from('projects')
        .select(`
          id, name, customer_id, manager_id, project_type, priority, status, description,
          start_date, end_date, budget, location, notes, created_at, updated_at,
          customers(id, name),
          staff(id, name)
        `)
        .eq('id', id)
        .eq('store_id', store.id)
        .single(),
      supabase
        .from('project_tasks')
        .select(`
          id, project_id, title, description, assigned_to, status, priority,
          due_date, completed_at, estimated_hours, sort_order, created_at, updated_at,
          staff(id, name)
        `)
        .eq('project_id', id)
        .eq('store_id', store.id)
        .order('due_date', { ascending: true, nullsFirst: false }),
    ])

    if (projectRes.data) {
      setProject(projectRes.data as unknown as Project)
    }
    if (tasksRes.data) {
      setTasks(tasksRes.data as unknown as ProjectTask[])
    }

    setLoading(false)
  }, [supabase, router, id])

  useEffect(() => {
    load()
  }, [load])

  const taskProgress = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter((t) => t.status === 'completed').length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, completed, percentage }
  }, [tasks])

  function startEdit() {
    if (!project) return
    setEditData({
      name: project.name,
      description: project.description || '',
      project_type: project.project_type,
      priority: project.priority,
      start_date: project.start_date ? project.start_date.slice(0, 10) : '',
      end_date: project.end_date ? project.end_date.slice(0, 10) : '',
      budget: project.budget ?? '',
      location: project.location || '',
      notes: project.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!project) return
    setSaving(true)
    try {
      const changed: Record<string, unknown> = {}
      const fields = ['name', 'description', 'project_type', 'priority', 'start_date', 'end_date', 'budget', 'location', 'notes']
      for (const field of fields) {
        const editVal = editData[field]
        const currentVal = (() => {
          const raw = project[field as keyof Project]
          if (field === 'start_date' || field === 'end_date') {
            return raw ? (raw as string).slice(0, 10) : ''
          }
          if (field === 'budget') {
            return raw ?? ''
          }
          return raw || ''
        })()
        if (String(editVal) !== String(currentVal)) {
          if (field === 'budget') {
            changed[field] = editVal === '' ? null : Number(editVal)
          } else if ((field === 'start_date' || field === 'end_date') && editVal === '') {
            changed[field] = null
          } else if (field === 'description' || field === 'notes' || field === 'location') {
            changed[field] = editVal === '' ? null : editVal
          } else {
            changed[field] = editVal
          }
        }
      }
      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Хадгалахад алдаа гарлаа' }))
        alert(err.error || 'Хадгалахад алдаа гарлаа')
        setSaving(false)
        return
      }
      setIsEditing(false)
      await load()
    } catch {
      alert('Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const durationDays = useMemo(() => {
    if (!project?.start_date || !project?.end_date) return null
    return calculateDurationDays(project.start_date, project.end_date)
  }, [project])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-slate-700 rounded-xl" />
            <div className="h-48 bg-slate-700 rounded-xl" />
          </div>
          <div className="h-64 bg-slate-700 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Төсөл олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="mt-4 text-blue-400 hover:underline"
        >
          Буцах
        </button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[project.status] || { label: project.status, color: 'bg-slate-500/20 text-slate-400' }
  const priorityCfg = PRIORITY_CONFIG[project.priority] || { label: project.priority, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="text-slate-400 hover:text-white transition-colors self-start"
        >
          &larr; Буцах
        </button>
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editData.name as string}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className={inputClassName + ' text-2xl font-bold'}
            />
          ) : (
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          )}
          <p className="text-slate-400 text-sm mt-1">Төслийн дэлгэрэнгүй</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityCfg.color}`}>
            {priorityCfg.label}
          </span>
          <StatusActions
            currentStatus={project.status}
            transitions={projectTransitions}
            statusLabels={STATUS_LABELS}
            apiPath={`/api/projects/${id}`}
            onSuccess={load}
          />
          {!isEditing ? (
            <button
              onClick={startEdit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Засах
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress Indicator */}
      {tasks.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Даалгаврын явц</span>
            <span className="text-sm text-white font-medium">
              {taskProgress.completed}/{taskProgress.total} ({taskProgress.percentage}%)
            </span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                taskProgress.percentage >= 100
                  ? 'bg-green-500'
                  : taskProgress.percentage >= 50
                    ? 'bg-blue-500'
                    : taskProgress.percentage >= 25
                      ? 'bg-yellow-500'
                      : 'bg-slate-500'
              }`}
              style={{ width: `${taskProgress.percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Project Info Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Төслийн мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name as string}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className={inputClassName}
                />
              ) : (
                <p className="text-white">{project.name}</p>
              )}
            </div>
            <div>
              <span className="text-sm text-slate-400">Төрөл</span>
              {isEditing ? (
                <select
                  value={editData.project_type as string}
                  onChange={(e) => setEditData({ ...editData, project_type: e.target.value })}
                  className={inputClassName}
                >
                  {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : (
                <p className="text-white">{PROJECT_TYPE_LABELS[project.project_type] || project.project_type}</p>
              )}
            </div>
            <div>
              <span className="text-sm text-slate-400">Төлөв</span>
              <p className="mt-1">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Ач холбогдол</span>
              {isEditing ? (
                <select
                  value={editData.priority as string}
                  onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                  className={inputClassName}
                >
                  {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => (
                    <option key={value} value={value}>{cfg.label}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityCfg.color}`}>
                    {priorityCfg.label}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Client Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Захиалагч</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white">
                {project.customers?.name || 'Тодорхойгүй'}
              </p>
            </div>
          </div>
        </div>

        {/* Manager Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Менежер</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white">
                {project.staff?.name || 'Тодорхойгүй'}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Хугацаа</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <div>
                <span className="text-sm text-slate-400">Эхлэх</span>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.start_date as string}
                    onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                    className={inputClassName}
                  />
                ) : (
                  <p className="text-white">
                    {project.start_date ? formatDate(project.start_date) : '-'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-400">Дуусах</span>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.end_date as string}
                    onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                    className={inputClassName}
                  />
                ) : (
                  <p className="text-white">
                    {project.end_date ? formatDate(project.end_date) : '-'}
                  </p>
                )}
              </div>
            </div>
            {durationDays !== null && (
              <div>
                <span className="text-sm text-slate-400">Үргэлжлэх хугацаа</span>
                <p className="text-white">{durationDays} хоног</p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Төсөв</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Төсөвлөсөн дүн</span>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.budget as string | number}
                  onChange={(e) => setEditData({ ...editData, budget: e.target.value })}
                  className={inputClassName}
                  placeholder="0"
                />
              ) : (
                <p className="text-xl font-bold text-white">
                  {project.budget != null ? formatPrice(project.budget) : '-'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Байршил</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Хаяг</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.location as string}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className={inputClassName}
                />
              ) : (
                <p className="text-white">{project.location || '-'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description & Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-2">Тайлбар</h2>
          {isEditing ? (
            <textarea
              value={editData.description as string}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={4}
              className={inputClassName}
            />
          ) : (
            <p className="text-slate-300 whitespace-pre-wrap text-sm">
              {project.description || 'Тайлбар оруулаагүй байна.'}
            </p>
          )}
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-2">Тэмдэглэл</h2>
          {isEditing ? (
            <textarea
              value={editData.notes as string}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              rows={4}
              className={inputClassName}
            />
          ) : (
            <p className="text-slate-300 whitespace-pre-wrap text-sm">
              {project.notes || 'Тэмдэглэл байхгүй.'}
            </p>
          )}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Даалгаврууд
            {tasks.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({taskProgress.completed}/{taskProgress.total} дууссан)
              </span>
            )}
          </h2>
        </div>

        {tasks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Гарчиг</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Хариуцагч</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Төлөв</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Ач холбогдол</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Хугацаа</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const taskStatusCfg = TASK_STATUS[task.status] || { label: task.status, color: 'bg-slate-500/20 text-slate-400' }
                  const taskPriorityCfg = PRIORITY_CONFIG[task.priority] || { label: task.priority, color: 'bg-slate-500/20 text-slate-400' }
                  const isOverdue =
                    task.due_date &&
                    task.status !== 'completed' &&
                    task.status !== 'cancelled' &&
                    new Date(task.due_date) < new Date()

                  return (
                    <tr key={task.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                      <td className="py-3 px-4">
                        <div>
                          <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[250px]" title={task.description}>
                              {task.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-300">
                          {task.staff?.name || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${taskStatusCfg.color}`}>
                          {taskStatusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${taskPriorityCfg.color}`}>
                          {taskPriorityCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {task.due_date ? (
                          <span className={`text-sm ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-300'}`}>
                            {formatDate(task.due_date)}
                            {isOverdue && ' (хугацаа хэтэрсэн)'}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">Даалгавар байхгүй байна.</p>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="text-sm text-slate-500 flex flex-wrap gap-6">
        <span>Үүсгэсэн: {formatDateTime(project.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(project.updated_at)}</span>
      </div>
    </div>
  )
}
