'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface PackagePurchaseDetail {
  id: string
  package_id: string | null
  customer_id: string | null
  customer_name: string | null
  purchase_date: string | null
  expiry_date: string | null
  total_sessions: number | null
  used_sessions: number | null
  remaining_sessions: number | null
  amount_paid: number | null
  status: string
  payment_method: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  expired: { label: 'Хугацаа дууссан', color: 'bg-slate-500/20 text-slate-400' },
  fully_used: { label: 'Бүрэн ашигласан', color: 'bg-blue-500/20 text-blue-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
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

export default function PackagePurchaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [purchase, setPurchase] = useState<PackagePurchaseDetail | null>(null)
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
      .from('package_purchases')
      .select(`
        id, package_id, customer_id, purchase_date,
        total_sessions, used_sessions, remaining_sessions, amount_paid, status,
        payment_method, notes, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/package-purchases')
      return
    }

    setPurchase(data as PackagePurchaseDetail)
    setLoading(false)
  }

  function startEdit() {
    if (!purchase) return
    setEditData({
      status: purchase.status || '',
      notes: purchase.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!purchase) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        status: purchase.status || '',
        notes: purchase.notes || '',
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

      const res = await fetch(`/api/package-purchases/${id}`, {
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

  if (!purchase) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Багцын худалдан авалт олдсонгүй</p>
        <Link href="/dashboard/package-purchases" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[purchase.status] || { label: purchase.status, color: 'bg-slate-500/20 text-slate-400' }
  const totalSessions = purchase.total_sessions || 0
  const usedSessions = purchase.used_sessions || 0
  const remainingSessions = purchase.remaining_sessions ?? (totalSessions - usedSessions)
  const usagePercent = totalSessions > 0 ? Math.round((usedSessions / totalSessions) * 100) : 0
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  // Check if expiry is approaching (within 7 days)
  const isExpiringSoon = purchase.expiry_date
    ? new Date(purchase.expiry_date).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 && new Date(purchase.expiry_date).getTime() > Date.now()
    : false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/package-purchases"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Багцын худалдан авалт</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              {isExpiringSoon && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                  Хугацаа дуусах гэж байна
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{purchase.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Purchase Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Худалдан авалтын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Багц</p>
              <p className="text-white mt-1">{purchase.package_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үйлчлүүлэгч</p>
              <p className="text-white mt-1">{purchase.customer_name || purchase.customer_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Худалдан авсан огноо</p>
              <p className="text-white mt-1">{formatDate(purchase.purchase_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хугацаа дуусах</p>
              <p className={`mt-1 ${isExpiringSoon ? 'text-yellow-400 font-medium' : 'text-white'}`}>
                {formatDate(purchase.expiry_date)}
              </p>
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
                  <option value="expired">Хугацаа дууссан</option>
                  <option value="fully_used">Бүрэн ашигласан</option>
                  <option value="cancelled">Цуцлагдсан</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлбөрийн хэлбэр</p>
              <p className="text-white mt-1">{PAYMENT_METHOD_LABELS[purchase.payment_method || ''] || purchase.payment_method || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлсөн дүн</p>
              <p className="text-lg text-green-400 font-medium mt-1">{formatPrice(purchase.amount_paid)}</p>
            </div>
          </div>
        </div>

        {/* Sessions Sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хичээлийн мэдээлэл</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Нийт хичээл</p>
                <p className="text-lg text-white font-medium mt-1">{totalSessions}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Ашигласан</p>
                <p className="text-lg text-blue-400 font-medium mt-1">{usedSessions}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Үлдсэн</p>
                <p className={`text-lg font-medium mt-1 ${remainingSessions > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                  {remainingSessions}
                </p>
              </div>
            </div>
            {totalSessions > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Ашиглалтын явц</span>
                  <span>{usagePercent}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, usagePercent)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Customer Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Үйлчлүүлэгч</h3>
            {purchase.customer_name ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {purchase.customer_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{purchase.customer_name}</p>
                  {purchase.customer_id && (
                    <Link
                      href={`/dashboard/customers/${purchase.customer_id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                    >
                      Дэлгэрэнгүй
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Сонгоогүй</p>
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
            {purchase.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(purchase.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(purchase.updated_at)}</span>
      </div>
    </div>
  )
}
