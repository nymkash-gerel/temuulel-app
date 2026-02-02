'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DailyLogDetail {
  id: string
  project_id: string | null
  log_date: string | null
  weather: string | null
  temperature: number | null
  work_summary: string | null
  issues: string | null
  safety_incidents: string | null
  crew_count: number | null
  hours_worked: number | null
  materials_used: string | null
  visitor_log: string | null
  notes: string | null
  created_at: string
  updated_at: string
  projects: { id: string; name: string } | null
}

const WEATHER_CONFIG: Record<string, { label: string; color: string }> = {
  sunny: { label: 'Цэлмэг', color: 'bg-yellow-500/20 text-yellow-400' },
  cloudy: { label: 'Үүлэрхэг', color: 'bg-slate-500/20 text-slate-400' },
  rainy: { label: 'Бороотой', color: 'bg-blue-500/20 text-blue-400' },
  snowy: { label: 'Цастай', color: 'bg-cyan-500/20 text-cyan-400' },
  windy: { label: 'Салхитай', color: 'bg-orange-500/20 text-orange-400' },
  stormy: { label: 'Шуурга', color: 'bg-red-500/20 text-red-400' },
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

export default function DailyLogDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [log, setLog] = useState<DailyLogDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    const { data } = await (supabase as any)
      .from('daily_logs')
      .select(`
        id, project_id, log_date, weather, temperature, work_summary, issues,
        safety_incidents, crew_count, hours_worked, materials_used, visitor_log,
        notes, created_at, updated_at,
        projects(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/daily-logs')
      return
    }

    setLog(data as unknown as DailyLogDetail)
    setLoading(false)
  }

  function startEdit() {
    if (!log) return
    setEditData({
      work_summary: log.work_summary || '',
      issues: log.issues || '',
      safety_incidents: log.safety_incidents || '',
      crew_count: log.crew_count ?? '',
      hours_worked: log.hours_worked ?? '',
      notes: log.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!log) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        work_summary: log.work_summary || '',
        issues: log.issues || '',
        safety_incidents: log.safety_incidents || '',
        crew_count: log.crew_count ?? '',
        hours_worked: log.hours_worked ?? '',
        notes: log.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'crew_count' || key === 'hours_worked') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else {
            changes[key] = editData[key]
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/daily-logs/${id}`, {
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

  if (!log) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Өдрийн бүртгэл олдсонгүй</p>
        <Link href="/dashboard/daily-logs" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const wc = WEATHER_CONFIG[log.weather || ''] || { label: log.weather || '-', color: 'bg-slate-500/20 text-slate-400' }
  const hasSafetyIncidents = log.safety_incidents && log.safety_incidents.trim().length > 0
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/daily-logs"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Өдрийн бүртгэл</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                {formatDate(log.log_date)}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${wc.color}`}>
                {wc.label}
              </span>
              {hasSafetyIncidents && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                  Осол бүртгэгдсэн
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
              {log.projects ? log.projects.name : 'Төсөл тодорхойгүй'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Log Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Бүртгэлийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Огноо</p>
              <p className="text-white mt-1">{formatDate(log.log_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Цаг агаар</p>
              <p className="text-white mt-1">{wc.label}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Температур</p>
              <p className="text-white mt-1">{log.temperature != null ? `${log.temperature}°C` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Ажилчдын тоо</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.crew_count as string | number}
                  onChange={e => setEditData({ ...editData, crew_count: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                />
              ) : (
                <p className="text-white mt-1">{log.crew_count ?? '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Ажилласан цаг</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.hours_worked as string | number}
                  onChange={e => setEditData({ ...editData, hours_worked: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="0.5"
                />
              ) : (
                <p className="text-white mt-1">{log.hours_worked != null ? `${log.hours_worked} цаг` : '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төсөл</p>
              {log.projects ? (
                <Link
                  href={`/dashboard/projects/${log.projects.id}`}
                  className="text-blue-400 hover:text-blue-300 text-sm mt-1 inline-block transition-all"
                >
                  {log.projects.name}
                </Link>
              ) : (
                <p className="text-white mt-1">-</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(log.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(log.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Project Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төсөл</h3>
            {log.projects ? (
              <div>
                <p className="text-white font-medium">{log.projects.name}</p>
                <Link
                  href={`/dashboard/projects/${log.projects.id}`}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                >
                  Дэлгэрэнгүй
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Төсөл холбоогүй</p>
            )}
          </div>

          {/* Quick Stats Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Товч мэдээ</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Ажилчид</span>
                <span className="text-white text-sm font-medium">{log.crew_count ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Цаг</span>
                <span className="text-white text-sm font-medium">{log.hours_worked != null ? `${log.hours_worked}ц` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Температур</span>
                <span className="text-white text-sm font-medium">{log.temperature != null ? `${log.temperature}°C` : '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Work Summary Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Ажлын товчоо</h3>
        {isEditing ? (
          <textarea
            value={editData.work_summary as string}
            onChange={e => setEditData({ ...editData, work_summary: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {log.work_summary || 'Ажлын товчоо оруулаагүй'}
          </p>
        )}
      </div>

      {/* Issues Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Асуудлууд</h3>
        {isEditing ? (
          <textarea
            value={editData.issues as string}
            onChange={e => setEditData({ ...editData, issues: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {log.issues || 'Асуудал бүртгэгдээгүй'}
          </p>
        )}
      </div>

      {/* Safety Incidents Card */}
      <div className={`border rounded-xl p-6 ${hasSafetyIncidents ? 'bg-red-900/20 border-red-800' : 'bg-slate-800/50 border-slate-700'}`}>
        <h3 className={`text-sm font-medium mb-3 ${hasSafetyIncidents ? 'text-red-400' : 'text-slate-400'}`}>
          Аюулгүй байдлын осол
        </h3>
        {isEditing ? (
          <textarea
            value={editData.safety_incidents as string}
            onChange={e => setEditData({ ...editData, safety_incidents: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${hasSafetyIncidents ? 'text-red-300' : 'text-slate-300'}`}>
            {log.safety_incidents || 'Осол бүртгэгдээгүй'}
          </p>
        )}
      </div>

      {/* Materials Used Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Ашигласан материал</h3>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {log.materials_used || 'Материал бүртгэгдээгүй'}
        </p>
      </div>

      {/* Visitor Log Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Зочдын бүртгэл</h3>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {log.visitor_log || 'Зочин бүртгэгдээгүй'}
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
            {log.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(log.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(log.updated_at)}</span>
      </div>
    </div>
  )
}
