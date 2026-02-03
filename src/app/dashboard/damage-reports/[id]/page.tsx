'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface DamageReportDetail {
  id: string
  unit_id: string | null
  reservation_id: string | null
  reported_by: string | null
  description: string | null
  damage_type: string | null
  severity: string | null
  estimated_cost: number | null
  repair_cost: number | null
  status: string
  photos: string[] | null
  reported_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reported: { label: 'Мэдэгдсэн', color: 'bg-slate-500/20 text-slate-400' },
  assessed: { label: 'Үнэлэгдсэн', color: 'bg-blue-500/20 text-blue-400' },
  repaired: { label: 'Засагдсан', color: 'bg-green-500/20 text-green-400' },
  billed: { label: 'Нэхэмжлэгдсэн', color: 'bg-yellow-500/20 text-yellow-400' },
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  minor: { label: 'Бага', color: 'bg-slate-500/20 text-slate-400' },
  moderate: { label: 'Дунд', color: 'bg-yellow-500/20 text-yellow-400' },
  major: { label: 'Ноцтой', color: 'bg-orange-500/20 text-orange-400' },
  critical: { label: 'Аюултай', color: 'bg-red-500/20 text-red-400' },
}

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  scratch: 'Зурагдсан',
  dent: 'Хонхорхой',
  crack: 'Хагарал',
  stain: 'Толбо',
  burn: 'Түлэгдсэн',
  water_damage: 'Усны гэмтэл',
  electrical: 'Цахилгааны гэмтэл',
  structural: 'Бүтцийн гэмтэл',
  other: 'Бусад',
}

function formatPrice(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
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

export default function DamageReportDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DamageReportDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/damage-reports/${id}`)
      if (!res.ok) {
        throw new Error('Гэмтлийн тайлан олдсонгүй')
      }
      const data = await res.json()
      setReport(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!report) return
    setEditData({
      severity: report.severity || '',
      estimated_cost: report.estimated_cost ?? '',
      repair_cost: report.repair_cost ?? '',
      status: report.status || '',
      notes: report.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!report) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        severity: report.severity || '',
        estimated_cost: report.estimated_cost ?? '',
        repair_cost: report.repair_cost ?? '',
        status: report.status || '',
        notes: report.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'estimated_cost' || key === 'repair_cost') {
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

      const res = await fetch(`/api/damage-reports/${id}`, {
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

  if (error || !report) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{error || 'Гэмтлийн тайлан олдсонгүй'}</p>
        <Link href="/dashboard/damage-reports" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[report.status] || { label: report.status, color: 'bg-slate-500/20 text-slate-400' }
  const sev = SEVERITY_CONFIG[report.severity || ''] || { label: report.severity || '-', color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const photos = report.photos || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/damage-reports"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Гэмтлийн тайлан</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              {isEditing ? (
                <select
                  value={editData.severity as string}
                  onChange={e => setEditData({ ...editData, severity: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="minor">Бага</option>
                  <option value="moderate">Дунд</option>
                  <option value="major">Ноцтой</option>
                  <option value="critical">Аюултай</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sev.color}`}>
                  {sev.label}
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
              {DAMAGE_TYPE_LABELS[report.damage_type || ''] || report.damage_type || 'Төрөл тодорхойгүй'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Report Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Гэмтлийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Нэгж / Өрөө</p>
              <p className="text-white mt-1">{report.unit_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Захиалгын дугаар</p>
              <p className="text-white font-mono mt-1">{report.reservation_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Мэдэгдсэн</p>
              <p className="text-white mt-1">{report.reported_by || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Гэмтлийн төрөл</p>
              <p className="text-white mt-1">{DAMAGE_TYPE_LABELS[report.damage_type || ''] || report.damage_type || '-'}</p>
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
                  <option value="assessed">Үнэлэгдсэн</option>
                  <option value="repaired">Засагдсан</option>
                  <option value="billed">Нэхэмжлэгдсэн</option>
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
              <p className="text-xs text-slate-500">Мэдэгдсэн огноо</p>
              <p className="text-white mt-1">{formatDateTime(report.reported_at)}</p>
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
              <p className="text-2xl font-bold text-white">{formatPrice(report.estimated_cost)}</p>
            )}
          </div>

          {/* Repair Cost Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Засварын зардал</h3>
            {isEditing ? (
              <input
                type="number"
                value={editData.repair_cost as string | number}
                onChange={e => setEditData({ ...editData, repair_cost: e.target.value })}
                className={inputClassName}
                min="0"
                step="1"
              />
            ) : (
              <p className={`text-2xl font-bold ${
                report.repair_cost && report.estimated_cost && report.repair_cost > report.estimated_cost
                  ? 'text-red-400'
                  : 'text-green-400'
              }`}>
                {formatPrice(report.repair_cost)}
              </p>
            )}
          </div>

          {/* Severity Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хүнд байдал</h3>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${sev.color}`}>
              {sev.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тайлбар</h3>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {report.description || 'Тайлбар оруулаагүй'}
        </p>
      </div>

      {/* Photos Card */}
      {photos.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Зурагнууд ({photos.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((photo, index) => (
              <a
                key={index}
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={`Гэмтлийн зураг ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

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
            {report.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(report.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(report.updated_at)}</span>
      </div>
    </div>
  )
}
