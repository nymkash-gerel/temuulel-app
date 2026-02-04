'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface WashOrderDetail {
  id: string
  vehicle_id: string | null
  customer_id: string | null
  service_type: string | null
  wash_package: string | null
  status: string
  price: number | null
  paid_amount: number | null
  payment_method: string | null
  assigned_to: string | null
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  queued: { label: 'Дараалалд', color: 'bg-slate-500/20 text-slate-400' },
  in_progress: { label: 'Угааж байна', color: 'bg-blue-500/20 text-blue-400' },
  drying: { label: 'Хатааж байна', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const WASH_PACKAGE_LABELS: Record<string, string> = {
  basic: 'Энгийн',
  standard: 'Стандарт',
  premium: 'Премиум',
  deluxe: 'Делюкс',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Бэлэн',
  card: 'Карт',
  qpay: 'QPay',
  transfer: 'Шилжүүлэг',
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

export default function CarWashDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [washOrder, setWashOrder] = useState<WashOrderDetail | null>(null)
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
      .from('wash_orders')
      .select(`
        id, vehicle_id, customer_id, service_type, status,
        notes, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/car-wash')
      return
    }

    setWashOrder(data as WashOrderDetail)
    setLoading(false)
  }, [id, supabase, router])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!washOrder) return
    setEditData({
      status: washOrder.status || '',
      wash_package: washOrder.wash_package || '',
      notes: washOrder.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!washOrder) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        status: washOrder.status || '',
        wash_package: washOrder.wash_package || '',
        notes: washOrder.notes || '',
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

      const res = await fetch(`/api/wash-orders/${id}`, {
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

  if (!washOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Угаалгын захиалга олдсонгүй</p>
        <Link href="/dashboard/car-wash" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[washOrder.status] || { label: washOrder.status, color: 'bg-slate-500/20 text-slate-400' }
  const balance = (washOrder.price || 0) - (washOrder.paid_amount || 0)
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/car-wash"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Угаалгын захиалга</h1>
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{washOrder.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Захиалгын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Тээврийн хэрэгсэл</p>
              <p className="text-white mt-1">{washOrder.vehicle_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үйлчлүүлэгч</p>
              <p className="text-white mt-1">{washOrder.customer_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үйлчилгээний төрөл</p>
              <p className="text-white mt-1">{washOrder.service_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Угаалгын багц</p>
              {isEditing ? (
                <select
                  value={editData.wash_package as string}
                  onChange={e => setEditData({ ...editData, wash_package: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="">Сонгоно уу</option>
                  <option value="basic">Энгийн</option>
                  <option value="standard">Стандарт</option>
                  <option value="premium">Премиум</option>
                  <option value="deluxe">Делюкс</option>
                </select>
              ) : (
                <p className="text-white mt-1">{WASH_PACKAGE_LABELS[washOrder.wash_package || ''] || washOrder.wash_package || '-'}</p>
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
                  <option value="queued">Дараалалд</option>
                  <option value="in_progress">Угааж байна</option>
                  <option value="drying">Хатааж байна</option>
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
              <p className="text-xs text-slate-500">Хариуцсан</p>
              <p className="text-white mt-1">{washOrder.assigned_to || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Эхэлсэн</p>
              <p className="text-white mt-1">{formatDateTime(washOrder.started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дууссан</p>
              <p className="text-white mt-1">{formatDateTime(washOrder.completed_at)}</p>
            </div>
          </div>
        </div>

        {/* Payment Sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төлбөрийн мэдээлэл</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Үнэ</p>
                <p className="text-lg text-white font-medium mt-1">{formatPrice(washOrder.price)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Төлсөн</p>
                <p className="text-lg text-green-400 font-medium mt-1">{formatPrice(washOrder.paid_amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Үлдэгдэл</p>
                <p className={`text-lg font-medium mt-1 ${balance > 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
                  {washOrder.price ? formatPrice(balance) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Төлбөрийн хэлбэр</p>
                <p className="text-white mt-1">{PAYMENT_METHOD_LABELS[washOrder.payment_method || ''] || washOrder.payment_method || '-'}</p>
              </div>
            </div>
            {washOrder.price && washOrder.price > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Төлбөрийн явц</span>
                  <span>{Math.round(((washOrder.paid_amount || 0) / washOrder.price) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((washOrder.paid_amount || 0) / washOrder.price) * 100)}%` }}
                  />
                </div>
              </div>
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
            {washOrder.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(washOrder.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(washOrder.updated_at)}</span>
      </div>
    </div>
  )
}
