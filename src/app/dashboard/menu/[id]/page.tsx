'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface MenuItem {
  id: string
  name: string
  description: string | null
  base_price: number
  status: string
  category: string | null
  images: string[] | null
  menu_category_id: string | null
  sku: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  draft: { label: 'Ноорог', color: 'bg-gray-500/20 text-gray-400' },
  archived: { label: 'Архивлагдсан', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number | null) {
  if (amount == null) return '-'
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

export default function MenuItemDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [menuItem, setMenuItem] = useState<MenuItem | null>(null)
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
      const res = await fetch(`/api/products/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/menu')
          return
        }
        throw new Error('Мэдээлэл ачааллахад алдаа гарлаа')
      }
      const data = await res.json()
      setMenuItem(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!menuItem) return
    setEditData({
      name: menuItem.name || '',
      description: menuItem.description || '',
      base_price: menuItem.base_price ?? '',
      status: menuItem.status || '',
      sku: menuItem.sku || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!menuItem) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: menuItem.name || '',
        description: menuItem.description || '',
        base_price: menuItem.base_price ?? '',
        status: menuItem.status || '',
        sku: menuItem.sku || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'base_price') {
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

      const res = await fetch(`/api/products/${id}`, {
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
        <Link href="/dashboard/menu" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!menuItem) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Цэсний зүйл олдсонгүй</p>
        <Link href="/dashboard/menu" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[menuItem.status] || { label: menuItem.status, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/menu"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{menuItem.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {menuItem.category || 'Ангилалгүй'} {menuItem.sku ? `- ${menuItem.sku}` : ''}
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
        {/* Product Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Бүтээгдэхүүний мэдээлэл</h3>
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
                <p className="text-white mt-1">{menuItem.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үнэ</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.base_price as string | number}
                  onChange={e => setEditData({ ...editData, base_price: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="1"
                />
              ) : (
                <p className="text-lg text-white font-medium mt-1">{formatPrice(menuItem.base_price)}</p>
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
                  <option value="active">Идэвхтэй</option>
                  <option value="draft">Ноорог</option>
                  <option value="archived">Архивлагдсан</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">SKU</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.sku as string}
                  onChange={e => setEditData({ ...editData, sku: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white font-mono mt-1">{menuItem.sku || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Ангилал</p>
              <p className="text-white mt-1">{menuItem.category || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Цэсний ангилал ID</p>
              <p className="text-white font-mono mt-1 text-sm">{menuItem.menu_category_id || '-'}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Images Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Зургууд</h3>
            {menuItem.images && menuItem.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {menuItem.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-700">
                    <img
                      src={img}
                      alt={`${menuItem.name} - ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Зураг байхгүй</p>
            )}
          </div>

          {/* Timestamps Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хугацаа</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(menuItem.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(menuItem.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
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
            {menuItem.description || 'Тайлбар оруулаагүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(menuItem.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(menuItem.updated_at)}</span>
      </div>
    </div>
  )
}
