'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface FleetVehicleDetail {
  id: string
  name: string
  plate_number: string | null
  vin: string | null
  vehicle_type: string | null
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  status: string
  current_mileage: number | null
  fuel_type: string | null
  insurance_expiry: string | null
  registration_expiry: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  maintenance: { label: 'Засварт', color: 'bg-yellow-500/20 text-yellow-400' },
  retired: { label: 'Ашиглахгүй', color: 'bg-slate-500/20 text-slate-400' },
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  gasoline: 'Бензин',
  diesel: 'Дизель',
  electric: 'Цахилгаан',
  hybrid: 'Гибрид',
  lpg: 'Шатдаг хий',
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

function formatNumber(num: number | null) {
  if (num === null || num === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(num)
}

export default function FleetVehicleDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vehicle, setVehicle] = useState<FleetVehicleDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fleet-vehicles/${id}`)
      if (!res.ok) {
        throw new Error('Тээврийн хэрэгсэл олдсонгүй')
      }
      const data = await res.json()
      setVehicle(data)
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
    if (!vehicle) return
    setEditData({
      name: vehicle.name || '',
      plate_number: vehicle.plate_number || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year ?? '',
      color: vehicle.color || '',
      status: vehicle.status || '',
      fuel_type: vehicle.fuel_type || '',
      current_mileage: vehicle.current_mileage ?? '',
      notes: vehicle.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!vehicle) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: vehicle.name || '',
        plate_number: vehicle.plate_number || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year ?? '',
        color: vehicle.color || '',
        status: vehicle.status || '',
        fuel_type: vehicle.fuel_type || '',
        current_mileage: vehicle.current_mileage ?? '',
        notes: vehicle.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'year' || key === 'current_mileage') {
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

      const res = await fetch(`/api/fleet-vehicles/${id}`, {
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

  if (error || !vehicle) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{error || 'Тээврийн хэрэгсэл олдсонгүй'}</p>
        <Link href="/dashboard/fleet-vehicles" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[vehicle.status] || { label: vehicle.status, color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  // Check if insurance or registration is expiring soon (within 30 days)
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const insuranceExpiring = vehicle.insurance_expiry && new Date(vehicle.insurance_expiry) <= thirtyDaysFromNow
  const registrationExpiring = vehicle.registration_expiry && new Date(vehicle.registration_expiry) <= thirtyDaysFromNow

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/fleet-vehicles"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{vehicle.name}</h1>
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
            <p className="text-slate-400 mt-1">
              {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Мэдээлэл байхгүй'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vehicle Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Тээврийн хэрэгслийн мэдээлэл</h3>
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
                <p className="text-white mt-1">{vehicle.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Улсын дугаар</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.plate_number as string}
                  onChange={e => setEditData({ ...editData, plate_number: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white font-mono mt-1">{vehicle.plate_number || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">VIN</p>
              <p className="text-white font-mono mt-1 text-xs">{vehicle.vin || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төрөл</p>
              <p className="text-white mt-1">{vehicle.vehicle_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үйлдвэрлэгч</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.make as string}
                  onChange={e => setEditData({ ...editData, make: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{vehicle.make || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Загвар</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.model as string}
                  onChange={e => setEditData({ ...editData, model: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{vehicle.model || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Он</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.year as string | number}
                  onChange={e => setEditData({ ...editData, year: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="1900"
                  max="2099"
                />
              ) : (
                <p className="text-white mt-1">{vehicle.year || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Өнгө</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.color as string}
                  onChange={e => setEditData({ ...editData, color: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{vehicle.color || '-'}</p>
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
                  <option value="active">Идэвхтэй</option>
                  <option value="maintenance">Засварт</option>
                  <option value="retired">Ашиглахгүй</option>
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
              <p className="text-xs text-slate-500">Шатахуун</p>
              {isEditing ? (
                <select
                  value={editData.fuel_type as string}
                  onChange={e => setEditData({ ...editData, fuel_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="">Сонгох</option>
                  <option value="gasoline">Бензин</option>
                  <option value="diesel">Дизель</option>
                  <option value="electric">Цахилгаан</option>
                  <option value="hybrid">Гибрид</option>
                  <option value="lpg">Шатдаг хий</option>
                </select>
              ) : (
                <p className="text-white mt-1">{FUEL_TYPE_LABELS[vehicle.fuel_type || ''] || vehicle.fuel_type || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Одоогийн гүйлт (км)</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.current_mileage as string | number}
                  onChange={e => setEditData({ ...editData, current_mileage: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                />
              ) : (
                <p className="text-white mt-1">{formatNumber(vehicle.current_mileage)} км</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Expiry dates */}
        <div className="space-y-4">
          {/* Insurance Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Даатгал</h3>
            <p className={`text-sm font-medium ${insuranceExpiring ? 'text-red-400' : 'text-white'}`}>
              {formatDate(vehicle.insurance_expiry)}
            </p>
            {insuranceExpiring && (
              <p className="text-xs text-red-400 mt-1">Даатгалын хугацаа дуусах гэж байна!</p>
            )}
          </div>

          {/* Registration Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Гэрчилгээ</h3>
            <p className={`text-sm font-medium ${registrationExpiring ? 'text-red-400' : 'text-white'}`}>
              {formatDate(vehicle.registration_expiry)}
            </p>
            {registrationExpiring && (
              <p className="text-xs text-red-400 mt-1">Гэрчилгээний хугацаа дуусах гэж байна!</p>
            )}
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
            {vehicle.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(vehicle.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(vehicle.updated_at)}</span>
      </div>
    </div>
  )
}
