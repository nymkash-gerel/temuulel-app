'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface CoworkingSpaceDetail {
  id: string
  name: string
  description: string | null
  space_type: string | null
  capacity: number | null
  hourly_rate: number | null
  daily_rate: number | null
  monthly_rate: number | null
  amenities: string[] | null
  status: string
  floor: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Сул', color: 'bg-green-500/20 text-green-400' },
  occupied: { label: 'Ашиглагдаж буй', color: 'bg-blue-500/20 text-blue-400' },
  maintenance: { label: 'Засвар', color: 'bg-yellow-500/20 text-yellow-400' },
  reserved: { label: 'Захиалсан', color: 'bg-orange-500/20 text-orange-400' },
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  hot_desk: 'Нээлттэй ширээ',
  dedicated_desk: 'Тогтмол ширээ',
  private_office: 'Хувийн өрөө',
  meeting_room: 'Хурлын өрөө',
  event_space: 'Арга хэмжээний зал',
  phone_booth: 'Утасны бүхээг',
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

export default function CoworkingSpaceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [space, setSpace] = useState<CoworkingSpaceDetail | null>(null)
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

    const { data } = await supabase
      .from('coworking_spaces')
      .select(`
        id, name, space_type, capacity, hourly_rate, daily_rate, monthly_rate,
        amenities, status, floor, is_active, notes, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/coworking')
      return
    }

    setSpace(data as CoworkingSpaceDetail)
    setLoading(false)
  }

  function startEdit() {
    if (!space) return
    setEditData({
      name: space.name || '',
      description: space.description || '',
      capacity: space.capacity ?? '',
      hourly_rate: space.hourly_rate ?? '',
      daily_rate: space.daily_rate ?? '',
      monthly_rate: space.monthly_rate ?? '',
      status: space.status || '',
      is_active: space.is_active,
      notes: space.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!space) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: space.name || '',
        description: space.description || '',
        capacity: space.capacity ?? '',
        hourly_rate: space.hourly_rate ?? '',
        daily_rate: space.daily_rate ?? '',
        monthly_rate: space.monthly_rate ?? '',
        status: space.status || '',
        is_active: space.is_active,
        notes: space.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (['capacity', 'hourly_rate', 'daily_rate', 'monthly_rate'].includes(key)) {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else if (key === 'is_active') {
            changes[key] = editData[key]
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

      const res = await fetch(`/api/coworking-spaces/${id}`, {
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

  if (!space) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Коворкинг зай олдсонгүй</p>
        <Link href="/dashboard/coworking" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[space.status] || { label: space.status, color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/coworking"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{space.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${space.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {space.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
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
            <p className="text-slate-400 mt-1">{SPACE_TYPE_LABELS[space.space_type || ''] || space.space_type || '-'}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Space Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Зайн мэдээлэл</h3>
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
                <p className="text-white mt-1">{space.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Зайн төрөл</p>
              <p className="text-white mt-1">{SPACE_TYPE_LABELS[space.space_type || ''] || space.space_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Багтаамж</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.capacity as string | number}
                  onChange={e => setEditData({ ...editData, capacity: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                />
              ) : (
                <p className="text-white mt-1">{space.capacity ? `${space.capacity} хүн` : '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Давхар</p>
              <p className="text-white mt-1">{space.floor || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Статус</p>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="available">Сул</option>
                  <option value="occupied">Ашиглагдаж буй</option>
                  <option value="maintenance">Засвар</option>
                  <option value="reserved">Захиалсан</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
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
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white text-sm">{editData.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
                </label>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${space.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {space.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Үнийн мэдээлэл</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Цагийн үнэ</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.hourly_rate as string | number}
                    onChange={e => setEditData({ ...editData, hourly_rate: e.target.value })}
                    className={`${inputClassName} mt-1`}
                    min="0"
                    step="1"
                  />
                ) : (
                  <p className="text-lg text-white font-medium mt-1">{formatPrice(space.hourly_rate)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Өдрийн үнэ</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.daily_rate as string | number}
                    onChange={e => setEditData({ ...editData, daily_rate: e.target.value })}
                    className={`${inputClassName} mt-1`}
                    min="0"
                    step="1"
                  />
                ) : (
                  <p className="text-lg text-blue-400 font-medium mt-1">{formatPrice(space.daily_rate)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Сарын үнэ</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.monthly_rate as string | number}
                    onChange={e => setEditData({ ...editData, monthly_rate: e.target.value })}
                    className={`${inputClassName} mt-1`}
                    min="0"
                    step="1"
                  />
                ) : (
                  <p className="text-lg text-green-400 font-medium mt-1">{formatPrice(space.monthly_rate)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amenities Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тохижилт</h3>
        {space.amenities && space.amenities.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {space.amenities.map((amenity, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-medium"
              >
                {amenity}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Тохижилтын мэдээлэл байхгүй</p>
        )}
      </div>

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
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
            {space.description || 'Тайлбар оруулаагүй'}
          </p>
        )}
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
            {space.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(space.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(space.updated_at)}</span>
      </div>
    </div>
  )
}
