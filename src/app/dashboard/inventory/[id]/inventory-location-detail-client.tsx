'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

interface InventoryLocationDetail {
  id: string
  name: string
  description?: string | null
  address?: string | null
  location_type: string | null
  is_active: boolean
  is_default?: boolean
  notes?: string | null
  created_at: string
  updated_at: string
}

const LOCATION_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  warehouse: { label: 'Агуулах', color: 'bg-blue-500/20 text-blue-400' },
  store: { label: 'Дэлгүүр', color: 'bg-green-500/20 text-green-400' },
  transit: { label: 'Тээвэрлэлт', color: 'bg-yellow-500/20 text-yellow-400' },
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

interface Props {
  initialLocation: InventoryLocationDetail
  locationId: string
}

export default function InventoryLocationDetailClient({ initialLocation, locationId }: Props) {
  const [location, setLocation] = useState<InventoryLocationDetail>(initialLocation)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/inventory/locations/${locationId}`)
    if (res.ok) {
      const data = await res.json()
      setLocation(data)
    }
  }, [locationId])

  function startEdit() {
    setEditData({
      name: location.name || '',
      location_type: location.location_type || '',
      is_active: location.is_active,
    })
    setIsEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: location.name || '',
        location_type: location.location_type || '',
        is_active: location.is_active,
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          changes[key] = editData[key]
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/inventory/locations/${locationId}`, {
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

  const ltc = LOCATION_TYPE_CONFIG[location.location_type || ''] || { label: location.location_type || '-', color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inventory"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{location.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${ltc.color}`}>
                {ltc.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${location.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {location.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
              {location.is_default && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  Үндсэн
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{location.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Location Info Card */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Байршлын мэдээлэл</h3>
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
                <p className="text-white mt-1">{location.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Байршлын төрөл</p>
              {isEditing ? (
                <select
                  value={editData.location_type as string}
                  onChange={e => setEditData({ ...editData, location_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="">Сонгоно уу</option>
                  <option value="warehouse">Агуулах</option>
                  <option value="store">Дэлгүүр</option>
                  <option value="transit">Тээвэрлэлт</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${ltc.color}`}>
                  {ltc.label}
                </span>
              )}
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500">Хаяг</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.address as string}
                  onChange={e => setEditData({ ...editData, address: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{location.address || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Идэвхтэй эсэх</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={editData.is_active as boolean}
                    onChange={e => setEditData({ ...editData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-white/[0.08] bg-white/[0.06] text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white text-sm">{editData.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
                </label>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${location.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {location.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үндсэн байршил</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    checked={editData.is_default as boolean}
                    onChange={e => setEditData({ ...editData, is_default: e.target.checked })}
                    className="w-4 h-4 rounded border-white/[0.08] bg-white/[0.06] text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white text-sm">{editData.is_default ? 'Тийм' : 'Үгүй'}</span>
                </label>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${location.is_default ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {location.is_default ? 'Тийм' : 'Үгүй'}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(location.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(location.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Quick Info Sidebar */}
        <div className="space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хураангуй</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Төрөл</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${ltc.color}`}>
                  {ltc.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Төлөв</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${location.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {location.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Үндсэн</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${location.is_default ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {location.is_default ? 'Тийм' : 'Үгүй'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description Card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тайлбар</h3>
        {isEditing ? (
          <textarea
            value={editData.description as string}
            onChange={e => setEditData({ ...editData, description: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {location.description || 'Тайлбар оруулаагүй'}
          </p>
        )}
      </div>

      {/* Notes Card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
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
            {location.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(location.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(location.updated_at)}</span>
      </div>
    </div>
  )
}
