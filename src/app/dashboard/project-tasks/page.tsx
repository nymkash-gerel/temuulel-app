'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import KpiCards from '@/components/ui/KpiCards'
import { resolveStoreId } from '@/lib/resolve-store'

interface ProjectTask {
  id: string
  project_id: string
  title: string
  assigned_to: string | null
  description: string | null
  due_date: string | null
  estimated_hours: number | null
  priority: string
  sort_order: number
  status: string
  created_at: string
  updated_at: string
  projects: { id: string; name: string } | null
  staff: { id: string; name: string } | null
}

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  todo: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
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

export default function ProjectTasksPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const loadTasks = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)
    if (priorityFilter) params.set('priority', priorityFilter)

    const res = await fetch(`/api/project-tasks?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      setTasks((json.data as ProjectTask[]) || [])
      setTotalCount(json.total ?? (json.data?.length || 0))
    }
  }, [statusFilter, priorityFilter])

  // One-time auth/store init. try/finally guarantees the spinner clears even if a
  // fetch throws; deps exclude loadTasks so a filter change doesn't re-run
  // getUser()/resolveStoreId (the reload effect below handles filter-driven refetch).
  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const storeId = await resolveStoreId(supabase, user.id)
        if (storeId) {
          await loadTasks()
        }
      } finally {
        setLoading(false)
      }
    }
    init()
    // loadTasks intentionally omitted — init runs once, not per filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router])

  useEffect(() => {
    if (loading) return
    const reload = async () => { await loadTasks() }
    reload()
  }, [loading, loadTasks])

  const kpis = useMemo(() => {
    const total = tasks.length
    const todo = tasks.filter(t => t.status === 'todo').length
    const inProgress = tasks.filter(t => t.status === 'in_progress').length
    const completed = tasks.filter(t => t.status === 'completed').length
    return [
      { label: 'Нийт даалгавар', value: total },
      { label: 'Хүлээгдэж буй', value: todo },
      { label: 'Явагдаж буй', value: inProgress },
      { label: 'Дууссан', value: completed },
    ]
  }, [tasks])

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
          <h1 className="text-2xl font-bold text-white">Төслийн даалгаврууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {totalCount} даалгавар
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCards cards={kpis} />

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="todo">Хүлээгдэж буй</option>
              <option value="in_progress">Явагдаж буй</option>
              <option value="review">Хянагдаж буй</option>
              <option value="completed">Дууссан</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ач холбогдол</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх ач холбогдол</option>
              <option value="low">Бага</option>
              <option value="medium">Дунд</option>
              <option value="high">Өндөр</option>
              <option value="urgent">Яаралтай</option>
            </select>
          </div>
        </div>
        {(statusFilter || priorityFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {tasks.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Даалгавар</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төсөл</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хариуцагч</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Ач холбогдол</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах огноо</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const statusCfg = TASK_STATUS[task.status] || { label: task.status, color: 'bg-slate-500/20 text-slate-400' }
                const priorityCfg = PRIORITY_CONFIG[task.priority] || { label: task.priority, color: 'bg-slate-500/20 text-slate-400' }
                const overdue =
                  task.due_date &&
                  task.status !== 'completed' &&
                  task.status !== 'cancelled' &&
                  new Date(task.due_date) < new Date()
                return (
                  <tr key={task.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <p className={`font-medium ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[250px]" title={task.description}>
                          {task.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{task.projects?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{task.staff?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${priorityCfg.color}`}>
                        {priorityCfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className={`text-sm ${overdue ? 'text-red-400' : 'text-slate-300'}`}>
                        {task.due_date
                          ? new Date(task.due_date).toLocaleDateString('mn-MN')
                          : '-'}
                      </span>
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
            <span className="text-4xl">&#128203;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Даалгавар байхгүй</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || priorityFilter
              ? 'Шүүлтүүрт тохирох даалгавар олдсонгүй.'
              : 'Даалгаврыг төслийн дэлгэрэнгүй хуудаснаас нэмнэ.'}
          </p>
          {(statusFilter || priorityFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
