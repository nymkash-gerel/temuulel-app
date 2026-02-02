'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Vehicle {
  id: string
  owner_name: string | null
  plate_number: string | null
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  vin: string | null
  vehicle_type: string | null
  notes: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: 'Седан',
  suv: 'Жийп',
  truck: 'Ачааны',
  van: 'Микроавтобус',
  motorcycle: 'Мотоцикл',
  bus: 'Автобус',
  other: 'Бусад',
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

export default function VehicleDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
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
      const res = await fetch(`/api/vehicles/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/vehicles')
          return
        }
        throw new Error('Мэдээлэл ачааллахад алдаа гарлаа')
      }
      const data = await res.json()
      setVehicle(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!vehicle) return
    setEditData({
      plate_number: vehicle.plate_number || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year ?? '',
      color: vehicle.color || '',
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
        plate_number: vehicle.plate_number || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        year: vehicle.year ?? '',
        color: vehicle.color || '',
        notes: vehicle.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'year') {
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

      const res = await fetch(`/api/vehicles/${id}`, {
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
        <Link href="/dashboard/vehicles" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Тээврийн хэрэгсэл олдсонгүй</p>
        <Link href="/dashboard/vehicles" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const vehicleTitle = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Тодорхойгүй'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/vehicles"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{vehicleTitle}</h1>
              {vehicle.plate_number && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 font-mono">
                  {vehicle.plate_number}
                </span>
              )}
            </div>
            <p className="text-slate-400 mt-1">
              {vehicle.owner_name || 'Эзэмшигчгүй'}
              {vehicle.year ? ` - ${vehicle.year} он` : ''}
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
        {/* Vehicle Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Тээврийн хэрэгслийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
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
                  max="2100"
                />
              ) : (
                <p className="text-white mt-1">{vehicle.year ?? '-'}</p>
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
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-white">{vehicle.color || '-'}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төрөл</p>
              <p className="text-white mt-1">
                {VEHICLE_TYPE_LABELS[vehicle.vehicle_type || ''] || vehicle.vehicle_type || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">VIN</p>
              <p className="text-white font-mono mt-1 text-sm">{vehicle.vin || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Эзэмшигч</p>
              <p className="text-white mt-1">{vehicle.owner_name || '-'}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Owner Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Эзэмшигч</h3>
            {vehicle.owner_name ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {vehicle.owner_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{vehicle.owner_name}</p>
                  {vehicle.customer_id && (
                    <Link
                      href={`/dashboard/customers/${vehicle.customer_id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                    >
                      Дэлгэрэнгүй
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Эзэмшигч сонгоогүй</p>
            )}
          </div>

          {/* Timestamps Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Огноо</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(vehicle.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(vehicle.updated_at)}</span>
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
