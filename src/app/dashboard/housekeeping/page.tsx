'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HousekeepingTask {
  id: string
  store_id: string
  unit_id: string
  assigned_to: string | null
  task_type: string
  priority: string
  status: string
  scheduled_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  units: { id: string; unit_number: string } | null
  staff: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
  normal: { label: 'Normal', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HousekeepingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadTasks = useCallback(async (sid: string) => {
    let query = supabase
      .from('housekeeping_tasks')
      .select(`
        id, store_id, unit_id, assigned_to, task_type, priority,
        status, scheduled_at, completed_at, notes, created_at,
        units(id, unit_number),
        staff(id, name)
      `)
      .eq('store_id', sid)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (priorityFilter) {
      query = query.eq('priority', priorityFilter)
    }

    const { data } = await query

    if (data) {
      setTasks(data as unknown as HousekeepingTask[])
    }
  }, [supabase, statusFilter, priorityFilter])

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
        setStoreId(store.id)
        await loadTasks(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadTasks])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadTasks(storeId) }
    reload()
  }, [statusFilter, priorityFilter, storeId, loading, loadTasks])

  const stats = useMemo(() => {
    const total = tasks.length
    const pending = tasks.filter(t => t.status === 'pending').length
    const inProgress = tasks.filter(t => t.status === 'in_progress').length
    const today = new Date().toDateString()
    const completedToday = tasks.filter(t =>
      t.status === 'completed' && t.completed_at && new Date(t.completed_at).toDateString() === today
    ).length
    return { total, pending, inProgress, completedToday }
  }, [tasks])

  async function handleStart(task: HousekeepingTask) {
    setUpdating(task.id)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('housekeeping_tasks')
        .update({ status: 'in_progress' })
        .eq('id', task.id)

      if (updateError) throw updateError
      await loadTasks(storeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start task')
    } finally {
      setUpdating(null)
    }
  }

  async function handleComplete(task: HousekeepingTask) {
    setUpdating(task.id)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('housekeeping_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id)

      if (updateError) throw updateError
      await loadTasks(storeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Housekeeping</h1>
          <p className="text-slate-400 mt-1">{tasks.length} task records</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Tasks</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.pending}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">In Progress</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Completed Today</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.completedToday}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        {(statusFilter || priorityFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter('') }}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {tasks.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Task Type</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Priority</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Assigned To</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Scheduled</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const sc = STATUS_CONFIG[task.status] || { label: task.status, color: 'bg-slate-500/20 text-slate-400' }
                const pc = PRIORITY_CONFIG[task.priority] || { label: task.priority, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={task.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{task.units?.unit_number || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 capitalize">{task.task_type.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                        {pc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{task.staff?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">
                        {task.scheduled_at ? formatDateTime(task.scheduled_at) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleStart(task)}
                            disabled={updating === task.id}
                            className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === task.id ? '...' : 'Start'}
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleComplete(task)}
                            disabled={updating === task.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === task.id ? '...' : 'Complete'}
                          </button>
                        )}
                        {task.status === 'completed' && (
                          <span className="text-xs text-slate-500">
                            {task.completed_at ? formatDate(task.completed_at) : 'Done'}
                          </span>
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
            <span className="text-4xl">&#128741;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Housekeeping Tasks</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || priorityFilter
              ? 'No tasks match your current filters. Try adjusting the filters.'
              : 'Housekeeping tasks will appear here once they are created for your units.'}
          </p>
          {(statusFilter || priorityFilter) && (
            <button
              onClick={() => { setStatusFilter(''); setPriorityFilter('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
