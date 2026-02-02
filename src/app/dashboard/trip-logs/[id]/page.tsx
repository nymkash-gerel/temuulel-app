'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface TripLog {
  id: string
  fleet_vehicle_id: string | null
  driver_name: string | null
  start_location: string | null
  end_location: string | null
  start_time: string | null
  end_time: string | null
  distance_km: number | null
  fuel_used: number | null
  purpose: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  planned: { label: 'Төлөвлөгдсөн', color: 'bg-gray-500/20 text-gray-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
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

function formatNumber(num: number | null, unit: string) {
  if (num == null) return '-'
  return new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 1 }).format(num) + ' ' + unit
}

function calculateDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '-'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours} цаг ${minutes} мин`
  return `${minutes} мин`
}

export default function TripLogDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tripLog, setTripLog] = useState<TripLog | null>(null)
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
      const res = await fetch(`/api/trip-logs/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/trip-logs')
          return
        }
        throw new Error('Мэдээлэл ачааллахад алдаа гарлаа')
      }
      const data = await res.json()
      setTripLog(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!tripLog) return
    setEditData({
      driver_name: tripLog.driver_name || '',
      purpose: tripLog.purpose || '',
      distance_km: tripLog.distance_km ?? '',
      fuel_used: tripLog.fuel_used ?? '',
      status: tripLog.status || '',
      notes: tripLog.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!tripLog) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        driver_name: tripLog.driver_name || '',
        purpose: tripLog.purpose || '',
        distance_km: tripLog.distance_km ?? '',
        fuel_used: tripLog.fuel_used ?? '',
        status: tripLog.status || '',
        notes: tripLog.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (['distance_km', 'fuel_used'].includes(key)) {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else {
            changes[key] = editData[key] || null
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/trip-logs/${id}`, {
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

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <Link href="/dashboard/trip-logs" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!tripLog) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Аяллын бүртгэл олдсонгүй</p>
        <Link href="/dashboard/trip-logs" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[tripLog.status] || { label: tripLog.status, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/trip-logs"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Аяллын бүртгэл</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {tripLog.driver_name || 'Жолоочгүй'} - {tripLog.purpose || 'Зорилгогүй'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trip Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Аяллын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Жолооч</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.driver_name as string}
                  onChange={e => setEditData({ ...editData, driver_name: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{tripLog.driver_name || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Зорилго</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.purpose as string}
                  onChange={e => setEditData({ ...editData, purpose: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{tripLog.purpose || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Эхлэх байрлал</p>
              <p className="text-white mt-1">{tripLog.start_location || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дуусах байрлал</p>
              <p className="text-white mt-1">{tripLog.end_location || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Эхлэх цаг</p>
              <p className="text-white mt-1">{formatDateTime(tripLog.start_time)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дуусах цаг</p>
              <p className="text-white mt-1">{formatDateTime(tripLog.end_time)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Зай (км)</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.distance_km as string | number}
                  onChange={e => setEditData({ ...editData, distance_km: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="0.1"
                />
              ) : (
                <p className="text-white mt-1">{formatNumber(tripLog.distance_km, 'км')}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Шатахуун (л)</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.fuel_used as string | number}
                  onChange={e => setEditData({ ...editData, fuel_used: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="0.1"
                />
              ) : (
                <p className="text-white mt-1">{formatNumber(tripLog.fuel_used, 'л')}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлөв</p>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="planned">Төлөвлөгдсөн</option>
                  <option value="in_progress">Явагдаж буй</option>
                  <option value="completed">Дууссан</option>
                  <option value="cancelled">Цуцлагдсан</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Тээврийн хэрэгсэл ID</p>
              <p className="text-white font-mono mt-1 text-sm">{tripLog.fleet_vehicle_id || '-'}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Statistics Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Статистик</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Нийт зай</span>
                <span className="text-white font-medium">{formatNumber(tripLog.distance_km, 'км')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Шатахуун</span>
                <span className="text-white font-medium">{formatNumber(tripLog.fuel_used, 'л')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Хугацаа</span>
                <span className="text-white font-medium">
                  {calculateDuration(tripLog.start_time, tripLog.end_time)}
                </span>
              </div>
              {tripLog.distance_km && tripLog.fuel_used && tripLog.fuel_used > 0 && (
                <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-700">
                  <span className="text-slate-500">Зарцуулалт</span>
                  <span className="text-cyan-400 font-medium">
                    {(tripLog.fuel_used / tripLog.distance_km * 100).toFixed(1)} л/100км
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Огноо</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(tripLog.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(tripLog.updated_at)}</span>
              </div>
            </div>
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
            {tripLog.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(tripLog.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(tripLog.updated_at)}</span>
      </div>
    </div>
  )
}
