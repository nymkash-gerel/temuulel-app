'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ServiceAreaDetail {
  id: string
  name: string
  description: string | null
  zip_codes: string[] | null
  city: string | null
  radius_km: number | null
  base_fee: number | null
  per_km_fee: number | null
  min_order: number | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
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

export default function ServiceAreaDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [area, setArea] = useState<ServiceAreaDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
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
      .from('service_areas')
      .select(`
        id, name, description, zip_codes, city, radius_km, base_fee, per_km_fee,
        min_order, is_active, notes, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/service-areas')
      return
    }

    setArea(data as unknown as ServiceAreaDetail)
    setLoading(false)
  }, [id, supabase, router])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!area) return
    setEditData({
      name: area.name || '',
      description: area.description || '',
      zip_codes: Array.isArray(area.zip_codes) ? area.zip_codes.join(', ') : '',
      city: area.city || '',
      radius_km: area.radius_km ?? '',
      base_fee: area.base_fee ?? '',
      per_km_fee: area.per_km_fee ?? '',
      min_order: area.min_order ?? '',
      is_active: area.is_active ?? true,
      notes: area.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!area) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: area.name || '',
        description: area.description || '',
        zip_codes: Array.isArray(area.zip_codes) ? area.zip_codes.join(', ') : '',
        city: area.city || '',
        radius_km: area.radius_km ?? '',
        base_fee: area.base_fee ?? '',
        per_km_fee: area.per_km_fee ?? '',
        min_order: area.min_order ?? '',
        is_active: area.is_active ?? true,
        notes: area.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'radius_km' || key === 'base_fee' || key === 'per_km_fee' || key === 'min_order') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else if (key === 'zip_codes') {
            const val = editData[key] as string
            changes[key] = val.trim() === '' ? null : val.split(',').map((s: string) => s.trim()).filter(Boolean)
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

      const res = await fetch(`/api/service-areas/${id}`, {
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

  if (!area) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Үйлчилгээний бүс олдсонгүй</p>
        <Link href="/dashboard/service-areas" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/service-areas"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name as string}
                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                    className={inputClassName}
                  />
                ) : (
                  area.name
                )}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${area.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {area.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
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
              {area.city || 'Хот тодорхойгүй'} - {area.radius_km != null ? `${area.radius_km} км радиус` : 'Радиус тодорхойгүй'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Бүсийн мэдээлэл</h3>
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
                <p className="text-white mt-1">{area.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Хот</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.city as string}
                  onChange={e => setEditData({ ...editData, city: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{area.city || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Радиус (км)</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.radius_km as string | number}
                  onChange={e => setEditData({ ...editData, radius_km: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="0.5"
                />
              ) : (
                <p className="text-white mt-1">{area.radius_km != null ? `${area.radius_km} км` : '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Идэвхтэй</p>
              {isEditing ? (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editData.is_active as boolean}
                    onChange={e => setEditData({ ...editData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-white">{editData.is_active ? 'Тийм' : 'Үгүй'}</span>
                </label>
              ) : (
                <p className={`mt-1 font-medium ${area.is_active ? 'text-green-400' : 'text-slate-400'}`}>
                  {area.is_active ? 'Тийм' : 'Үгүй'}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(area.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(area.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төлөв</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${area.is_active ? 'bg-green-500' : 'bg-slate-500'}`} />
              <span className="text-white font-medium">{area.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}</span>
            </div>
          </div>

          {/* Coverage Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хамрах хүрээ</h3>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-400">{area.radius_km ?? '-'}</p>
              <p className="text-xs text-slate-500 mt-1">км радиус</p>
            </div>
          </div>

          {/* Min Order Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Доод захиалга</h3>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{formatPrice(area.min_order)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-4">Үнийн мэдээлэл</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Суурь хураамж</p>
            {isEditing ? (
              <input
                type="number"
                value={editData.base_fee as string | number}
                onChange={e => setEditData({ ...editData, base_fee: e.target.value })}
                className={`${inputClassName} mt-1`}
                min="0"
                step="1"
              />
            ) : (
              <p className="text-lg text-white font-medium mt-1">{formatPrice(area.base_fee)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Км тутамд</p>
            {isEditing ? (
              <input
                type="number"
                value={editData.per_km_fee as string | number}
                onChange={e => setEditData({ ...editData, per_km_fee: e.target.value })}
                className={`${inputClassName} mt-1`}
                min="0"
                step="1"
              />
            ) : (
              <p className="text-lg text-white font-medium mt-1">{formatPrice(area.per_km_fee)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Доод захиалга</p>
            {isEditing ? (
              <input
                type="number"
                value={editData.min_order as string | number}
                onChange={e => setEditData({ ...editData, min_order: e.target.value })}
                className={`${inputClassName} mt-1`}
                min="0"
                step="1"
              />
            ) : (
              <p className="text-lg text-white font-medium mt-1">{formatPrice(area.min_order)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Zip Codes Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Зип кодууд</h3>
        {isEditing ? (
          <div>
            <input
              type="text"
              value={editData.zip_codes as string}
              onChange={e => setEditData({ ...editData, zip_codes: e.target.value })}
              className={inputClassName}
              placeholder="Зип кодуудыг таслалаар тусгаарлана уу"
            />
            <p className="text-xs text-slate-500 mt-1">Жишээ: 13000, 14000, 15000</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {area.zip_codes && area.zip_codes.length > 0 ? (
              area.zip_codes.map((zip, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-slate-700/50 border border-slate-600 rounded-full text-sm text-white font-mono"
                >
                  {zip}
                </span>
              ))
            ) : (
              <p className="text-slate-500 text-sm">Зип код бүртгэгдээгүй</p>
            )}
          </div>
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
            {area.description || 'Тайлбар оруулаагүй'}
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
            {area.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(area.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(area.updated_at)}</span>
      </div>
    </div>
  )
}
