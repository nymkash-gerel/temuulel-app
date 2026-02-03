'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface HousekeepingDetail {
  id: string
  unit_id: string | null
  assigned_to: string | null
  task_type: string | null
  status: string
  priority: string | null
  scheduled_date: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  skipped: { label: 'Алгассан', color: 'bg-yellow-500/20 text-yellow-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Дунд', color: 'bg-yellow-500/20 text-yellow-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

const TASK_TYPE_LABELS: Record<string, string> = {
  cleaning: 'Цэвэрлэгээ',
  turnover: 'Өрөө бэлтгэх',
  inspection: 'Шалгалт',
  deep_cleaning: 'Нарийн цэвэрлэгээ',
  laundry: 'Угаалга',
  other: 'Бусад',
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HousekeepingDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [task, setTask] = useState<HousekeepingDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/housekeeping/${id}`)
      if (!res.ok) {
        throw new Error('Цэвэрлэгээний бүртгэл олдсонгүй')
      }
      const data = await res.json()
      setTask(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!task) return
    setEditData({
      assigned_to: task.assigned_to || '',
      priority: task.priority || '',
      status: task.status || '',
      notes: task.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!task) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        assigned_to: task.assigned_to || '',
        priority: task.priority || '',
        status: task.status || '',
        notes: task.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          changes[key] = editData[key] === '' ? null : editData[key]
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/housekeeping/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Алдаа гарлаа' }))
        throw new Error(err.error || 'Алдаа гарлаа')
      }

      setIsEditing(false)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{error || 'Цэвэрлэгээний бүртгэл олдсонгүй'}</p>
        <Link href="/dashboard/housekeeping" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[task.status] || { label: task.status, color: 'bg-slate-500/20 text-slate-400' }
  const pc = PRIORITY_CONFIG[task.priority || ''] || { label: task.priority || '-', color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  // Calculate duration if started and completed
  let durationText: string | null = null
  if (task.started_at && task.completed_at) {
    const startMs = new Date(task.started_at).getTime()
    const endMs = new Date(task.completed_at).getTime()
    const diffMinutes = Math.round((endMs - startMs) / (1000 * 60))
    if (diffMinutes < 60) {
      durationText = `${diffMinutes} мин`
    } else {
      const hours = Math.floor(diffMinutes / 60)
      const mins = diffMinutes % 60
      durationText = `${hours} цаг ${mins} мин`
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/housekeeping"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Цэвэрлэгээ</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              {isEditing ? (
                <select
                  value={editData.priority as string}
                  onChange={e => setEditData({ ...editData, priority: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="low">Бага</option>
                  <option value="medium">Дунд</option>
                  <option value="high">Өндөр</option>
                  <option value="urgent">Яаралтай</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${pc.color}`}>
                  {pc.label}
                </span>
              )}
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Засах
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-slate-400 mt-1">
              {TASK_TYPE_LABELS[task.task_type || ''] || task.task_type || 'Төрөл тодорхойгүй'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Даалгаврын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Нэгж / Өрөө</p>
              <p className="text-white mt-1">{task.unit_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Даалгаврын төрөл</p>
              <p className="text-white mt-1">{TASK_TYPE_LABELS[task.task_type || ''] || task.task_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хариуцсан</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.assigned_to as string}
                  onChange={e => setEditData({ ...editData, assigned_to: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{task.assigned_to || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Статус</p>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="pending">Хүлээгдэж буй</option>
                  <option value="in_progress">Явагдаж буй</option>
                  <option value="completed">Дууссан</option>
                  <option value="skipped">Алгассан</option>
                </select>
              ) : (
                <p className="mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                    {sc.label}
                  </span>
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Товлосон огноо</p>
              <p className="text-white mt-1">{formatDate(task.scheduled_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Эхэлсэн</p>
              <p className="text-white mt-1">{formatDateTime(task.started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дууссан</p>
              <p className="text-white mt-1">{formatDateTime(task.completed_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Duration + Priority */}
        <div className="space-y-4">
          {/* Duration Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хугацаа</h3>
            {durationText ? (
              <p className="text-2xl font-bold text-white">{durationText}</p>
            ) : (
              <p className="text-slate-500 text-sm">
                {task.started_at ? 'Явагдаж байна...' : 'Эхлээгүй'}
              </p>
            )}
          </div>

          {/* Priority Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Чухал зэрэг</h3>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${pc.color}`}>
              {pc.label}
            </span>
          </div>
        </div>
      </div>

      {/* Notes Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тэмдэглэл</h3>
        {isEditing ? (
          <textarea
            value={editData.notes as string}
            onChange={e => setEditData({ ...editData, notes: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {task.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(task.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(task.updated_at)}</span>
      </div>
    </div>
  )
}
