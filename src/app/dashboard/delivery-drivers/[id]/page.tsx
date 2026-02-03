'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface DeliveryDriverDetail {
  id: string
  name: string
  phone: string | null
  email: string | null
  vehicle_type: string | null
  license_plate: string | null
  status: string
  current_location: string | null
  rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  on_delivery: { label: 'Хүргэлтэнд', color: 'bg-blue-500/20 text-blue-400' },
  offline: { label: 'Офлайн', color: 'bg-slate-500/20 text-slate-400' },
  suspended: { label: 'Түтгэлзүүлсэн', color: 'bg-red-500/20 text-red-400' },
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

export default function DeliveryDriverDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [driver, setDriver] = useState<DeliveryDriverDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/delivery-drivers/${id}`)
      if (!res.ok) {
        throw new Error('Жолооч олдсонгүй')
      }
      const data = await res.json()
      setDriver(data)
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
    if (!driver) return
    setEditData({
      name: driver.name || '',
      phone: driver.phone || '',
      email: driver.email || '',
      vehicle_type: driver.vehicle_type || '',
      license_plate: driver.license_plate || '',
      notes: driver.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!driver) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: driver.name || '',
        phone: driver.phone || '',
        email: driver.email || '',
        vehicle_type: driver.vehicle_type || '',
        license_plate: driver.license_plate || '',
        notes: driver.notes || '',
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

      const res = await fetch(`/api/delivery-drivers/${id}`, {
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

  if (error || !driver) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{error || 'Жолооч олдсонгүй'}</p>
        <Link href="/dashboard/delivery-drivers" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[driver.status] || { label: driver.status, color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/delivery-drivers"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{driver.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
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
            <p className="text-slate-400 mt-1">{driver.phone || 'Утас бүртгэгдээгүй'}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Driver Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Жолоочийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Нэр</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name as string}
                  onChange={e => setEditData({ ...editData, name: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{driver.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Утас</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.phone as string}
                  onChange={e => setEditData({ ...editData, phone: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{driver.phone || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Имэйл</p>
              {isEditing ? (
                <input
                  type="email"
                  value={editData.email as string}
                  onChange={e => setEditData({ ...editData, email: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{driver.email || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Тээврийн хэрэгсэл</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.vehicle_type as string}
                  onChange={e => setEditData({ ...editData, vehicle_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{driver.vehicle_type || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Улсын дугаар</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.license_plate as string}
                  onChange={e => setEditData({ ...editData, license_plate: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white font-mono mt-1">{driver.license_plate || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Статус</p>
              <p className="mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar: Location + Rating */}
        <div className="space-y-4">
          {/* Rating Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Үнэлгээ</h3>
            {driver.rating !== null ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-yellow-400">{driver.rating.toFixed(1)}</span>
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg
                      key={star}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill={star <= Math.round(driver.rating || 0) ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="2"
                      className={star <= Math.round(driver.rating || 0) ? 'text-yellow-400' : 'text-slate-600'}
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Үнэлгээ байхгүй</p>
            )}
          </div>

          {/* Location Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Одоогийн байршил</h3>
            <p className="text-white text-sm">{driver.current_location || 'Тодорхойгүй'}</p>
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
            {driver.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(driver.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(driver.updated_at)}</span>
      </div>
    </div>
  )
}
