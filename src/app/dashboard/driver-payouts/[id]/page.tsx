'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DriverPayoutDetail {
  id: string
  driver_id: string | null
  store_id: string
  period_start: string | null
  period_end: string | null
  total_amount: number | null
  delivery_count: number | null
  status: string
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  delivery_drivers: { id: string; name: string; phone: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-blue-500/20 text-blue-400' },
  paid: { label: 'Төлсөн', color: 'bg-green-500/20 text-green-400' },
  rejected: { label: 'Татгалзсан', color: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Цуцалсан', color: 'bg-red-500/20 text-red-400' },
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

export default function DriverPayoutDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payout, setPayout] = useState<DriverPayoutDetail | null>(null)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      const { data } = await supabase
        .from('driver_payouts')
        .select(`
          id, driver_id, store_id, period_start, period_end, total_amount,
          delivery_count, status, paid_at, notes, created_at, updated_at,
          delivery_drivers(id, name, phone)
        `)
        .eq('id', id)
        .eq('store_id', store.id)
        .single()

      if (!data) {
        router.push('/dashboard/driver-payouts')
        return
      }

      setPayout(data as DriverPayoutDetail)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!payout) return
    setEditData({
      status: payout.status || '',
      notes: payout.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!payout) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      if (editData.status !== payout.status) changes.status = editData.status
      if (editData.notes !== (payout.notes || '')) changes.notes = editData.notes || null

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/driver-payouts/${id}`, {
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
        <Link href="/dashboard/driver-payouts" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!payout) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Төлбөрийн мэдээлэл олдсонгүй</p>
        <Link href="/dashboard/driver-payouts" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[payout.status] || { label: payout.status, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/driver-payouts"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Жолоочийн төлбөр</h1>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="pending">Хүлээгдэж буй</option>
                  <option value="approved">Зөвшөөрсөн</option>
                  <option value="paid">Төлсөн</option>
                  <option value="rejected">Татгалзсан</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{payout.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payout Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Төлбөрийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Нийт дүн</p>
              <p className="text-lg text-blue-400 font-medium mt-1">{formatPrice(payout.total_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хүргэлтийн тоо</p>
              <p className="text-white mt-1">{payout.delivery_count ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хугацааны эхлэл</p>
              <p className="text-white mt-1">{formatDate(payout.period_start)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хугацааны төгсгөл</p>
              <p className="text-white mt-1">{formatDate(payout.period_end)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлөв</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлсөн огноо</p>
              <p className="text-white mt-1">{formatDateTime(payout.paid_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(payout.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(payout.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Driver */}
        <div className="space-y-4">
          {/* Driver Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Жолооч</h3>
            {payout.delivery_drivers ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {payout.delivery_drivers.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{payout.delivery_drivers.name}</p>
                  {payout.delivery_drivers.phone && (
                    <p className="text-slate-400 text-xs">{payout.delivery_drivers.phone}</p>
                  )}
                  <Link
                    href={`/dashboard/delivery-drivers`}
                    className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                  >
                    Жолоочид
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Жолооч тодорхойгүй</p>
            )}
          </div>

          {/* Period Summary Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хугацааны мэдээлэл</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500">Эхлэл</p>
                <p className="text-white text-sm">{formatDate(payout.period_start)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Төгсгөл</p>
                <p className="text-white text-sm">{formatDate(payout.period_end)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Хүргэлт</p>
                <p className="text-white text-sm font-medium">{payout.delivery_count ?? 0} удаа</p>
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
            {payout.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(payout.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(payout.updated_at)}</span>
      </div>
    </div>
  )
}
