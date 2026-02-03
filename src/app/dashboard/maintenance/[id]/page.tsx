'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface MaintenanceDetail {
  id: string
  unit_id: string | null
  reported_by: string | null
  assigned_to: string | null
  category: string | null
  description: string | null
  priority: string
  status: string
  estimated_cost: number | null
  actual_cost: number | null
  scheduled_date: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reported: { label: 'Мэдэгдсэн', color: 'bg-slate-500/20 text-slate-400' },
  assigned: { label: 'Хариуцуулсан', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  medium: { label: 'Дунд', color: 'bg-yellow-500/20 text-yellow-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
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

export default function MaintenanceDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [maintenance, setMaintenance] = useState<MaintenanceDetail | null>(null)
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
      const res = await fetch(`/api/maintenance/${id}`)
      if (!res.ok) {
        throw new Error('Засварын бүртгэл олдсонгүй')
      }
      const data = await res.json()
      setMaintenance(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!maintenance) return
    setEditData({
      assigned_to: maintenance.assigned_to || '',
      priority: maintenance.priority || '',
      status: maintenance.status || '',
      estimated_cost: maintenance.estimated_cost ?? '',
      actual_cost: maintenance.actual_cost ?? '',
      notes: maintenance.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!maintenance) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        assigned_to: maintenance.assigned_to || '',
        priority: maintenance.priority || '',
        status: maintenance.status || '',
        estimated_cost: maintenance.estimated_cost ?? '',
        actual_cost: maintenance.actual_cost ?? '',
        notes: maintenance.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'estimated_cost' || key === 'actual_cost') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else {
            changes[key] = editData[key] === '' ? null : editData[key]
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/maintenance/${id}`, {
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

  if (error || !maintenance) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{error || 'Засварын бүртгэл олдсонгүй'}</p>
        <Link href="/dashboard/maintenance" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[maintenance.status] || { label: maintenance.status, color: 'bg-slate-500/20 text-slate-400' }
  const pc = PRIORITY_CONFIG[maintenance.priority] || { label: maintenance.priority, color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/maintenance"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Засварын бүртгэл</h1>
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
            <p className="text-slate-400 mt-1">{maintenance.category || 'Ангилал тодорхойгүй'}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Maintenance Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Засварын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Нэгж / Өрөө</p>
              <p className="text-white mt-1">{maintenance.unit_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Ангилал</p>
              <p className="text-white mt-1">{maintenance.category || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Мэдэгдсэн</p>
              <p className="text-white mt-1">{maintenance.reported_by || '-'}</p>
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
                <p className="text-white mt-1">{maintenance.assigned_to || '-'}</p>
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
                  <option value="reported">Мэдэгдсэн</option>
                  <option value="assigned">Хариуцуулсан</option>
                  <option value="in_progress">Явагдаж буй</option>
                  <option value="completed">Дууссан</option>
                  <option value="cancelled">Цуцлагдсан</option>
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
              <p className="text-white mt-1">{formatDate(maintenance.scheduled_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дууссан огноо</p>
              <p className="text-white mt-1">{formatDateTime(maintenance.completed_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Cost Info */}
        <div className="space-y-4">
          {/* Estimated Cost Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төсөвт зардал</h3>
            {isEditing ? (
              <input
                type="number"
                value={editData.estimated_cost as string | number}
                onChange={e => setEditData({ ...editData, estimated_cost: e.target.value })}
                className={inputClassName}
                min="0"
                step="1"
              />
            ) : (
              <p className="text-2xl font-bold text-white">{formatPrice(maintenance.estimated_cost)}</p>
            )}
          </div>

          {/* Actual Cost Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Бодит зардал</h3>
            {isEditing ? (
              <input
                type="number"
                value={editData.actual_cost as string | number}
                onChange={e => setEditData({ ...editData, actual_cost: e.target.value })}
                className={inputClassName}
                min="0"
                step="1"
              />
            ) : (
              <p className={`text-2xl font-bold ${
                maintenance.actual_cost && maintenance.estimated_cost && maintenance.actual_cost > maintenance.estimated_cost
                  ? 'text-red-400'
                  : 'text-green-400'
              }`}>
                {formatPrice(maintenance.actual_cost)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тайлбар</h3>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {maintenance.description || 'Тайлбар оруулаагүй'}
        </p>
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
            {maintenance.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(maintenance.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(maintenance.updated_at)}</span>
      </div>
    </div>
  )
}
