'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Promotion {
  id: string
  name: string
  description: string | null
  discount_type: string
  discount_value: number
  min_order_amount: number | null
  max_discount: number | null
  start_date: string | null
  end_date: string | null
  usage_limit: number | null
  usage_count: number
  status: string
  code: string | null
  applies_to: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  scheduled: { label: 'Төлөвлөгдсөн', color: 'bg-blue-500/20 text-blue-400' },
  expired: { label: 'Дууссан', color: 'bg-gray-500/20 text-gray-400' },
  disabled: { label: 'Идэвхгүй', color: 'bg-red-500/20 text-red-400' },
}

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  percentage: 'Хувиар',
  fixed: 'Тогтмол дүн',
  free_shipping: 'Үнэгүй хүргэлт',
}

function formatPrice(amount: number | null) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
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

export default function PromotionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promotion, setPromotion] = useState<Promotion | null>(null)
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
      const res = await fetch(`/api/promotions/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/promotions')
          return
        }
        throw new Error('Мэдээлэл ачааллахад алдаа гарлаа')
      }
      const data = await res.json()
      setPromotion(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!promotion) return
    setEditData({
      name: promotion.name || '',
      description: promotion.description || '',
      discount_value: promotion.discount_value ?? '',
      min_order_amount: promotion.min_order_amount ?? '',
      max_discount: promotion.max_discount ?? '',
      status: promotion.status || '',
      start_date: promotion.start_date ? promotion.start_date.slice(0, 10) : '',
      end_date: promotion.end_date ? promotion.end_date.slice(0, 10) : '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!promotion) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        name: promotion.name || '',
        description: promotion.description || '',
        discount_value: promotion.discount_value ?? '',
        min_order_amount: promotion.min_order_amount ?? '',
        max_discount: promotion.max_discount ?? '',
        status: promotion.status || '',
        start_date: promotion.start_date ? promotion.start_date.slice(0, 10) : '',
        end_date: promotion.end_date ? promotion.end_date.slice(0, 10) : '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (['discount_value', 'min_order_amount', 'max_discount'].includes(key)) {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else if (['start_date', 'end_date'].includes(key) && editData[key] === '') {
            changes[key] = null
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

      const res = await fetch(`/api/promotions/${id}`, {
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
        <Link href="/dashboard/promotions" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!promotion) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Урамшуулал олдсонгүй</p>
        <Link href="/dashboard/promotions" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[promotion.status] || { label: promotion.status, color: 'bg-slate-500/20 text-slate-400' }
  const usagePercent = promotion.usage_limit
    ? Math.min(100, Math.round((promotion.usage_count / promotion.usage_limit) * 100))
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/promotions"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{promotion.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {promotion.code ? `Код: ${promotion.code}` : 'Кодгүй'}
              {' - '}
              {DISCOUNT_TYPE_LABELS[promotion.discount_type] || promotion.discount_type}
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
        {/* Promotion Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Урамшууллын мэдээлэл</h3>
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
                <p className="text-white mt-1">{promotion.name}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Хөнгөлөлтийн төрөл</p>
              <p className="text-white mt-1">
                {DISCOUNT_TYPE_LABELS[promotion.discount_type] || promotion.discount_type}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хөнгөлөлтийн утга</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.discount_value as string | number}
                  onChange={e => setEditData({ ...editData, discount_value: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="1"
                />
              ) : (
                <p className="text-lg text-white font-medium mt-1">
                  {promotion.discount_type === 'percentage'
                    ? `${promotion.discount_value}%`
                    : formatPrice(promotion.discount_value)}
                </p>
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
                  <option value="scheduled">Төлөвлөгдсөн</option>
                  <option value="expired">Дууссан</option>
                  <option value="disabled">Идэвхгүй</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Хамгийн бага захиалга</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.min_order_amount as string | number}
                  onChange={e => setEditData({ ...editData, min_order_amount: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                />
              ) : (
                <p className="text-white mt-1">{formatPrice(promotion.min_order_amount)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Дээд хөнгөлөлт</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.max_discount as string | number}
                  onChange={e => setEditData({ ...editData, max_discount: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                />
              ) : (
                <p className="text-white mt-1">{formatPrice(promotion.max_discount)}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Код</p>
              <p className="text-white font-mono mt-1">{promotion.code || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хамрах хүрээ</p>
              <p className="text-white mt-1">{promotion.applies_to || '-'}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Date Range Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хугацаа</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Эхлэх огноо</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.start_date as string}
                    onChange={e => setEditData({ ...editData, start_date: e.target.value })}
                    className={`${inputClassName} mt-1`}
                  />
                ) : (
                  <p className="text-white mt-1">{formatDate(promotion.start_date)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Дуусах огноо</p>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.end_date as string}
                    onChange={e => setEditData({ ...editData, end_date: e.target.value })}
                    className={`${inputClassName} mt-1`}
                  />
                ) : (
                  <p className={`mt-1 ${promotion.end_date && new Date(promotion.end_date) < new Date() ? 'text-red-400' : 'text-white'}`}>
                    {formatDate(promotion.end_date)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Usage Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хэрэглээ</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Ашигласан</span>
                <span className="text-white font-medium">{promotion.usage_count}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Хязгаар</span>
                <span className="text-white">{promotion.usage_limit ?? 'Хязгааргүй'}</span>
              </div>
              {usagePercent !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Хэрэглээний явц</span>
                    <span>{usagePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
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
                <span className="text-slate-300">{formatDateTime(promotion.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(promotion.updated_at)}</span>
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
            {promotion.description || 'Тайлбар оруулаагүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(promotion.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(promotion.updated_at)}</span>
      </div>
    </div>
  )
}
