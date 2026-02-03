'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DeskBookingDetail {
  id: string
  space_id: string | null
  customer_id: string | null
  customer_name: string | null
  booking_date: string | null
  start_time: string | null
  end_time: string | null
  status: string
  amount: number | null
  payment_status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  checked_in: { label: 'Ирсэн', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Дууссан', color: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400' },
}

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  paid: { label: 'Төлсөн', color: 'bg-green-500/20 text-green-400' },
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  unpaid: { label: 'Төлөөгүй', color: 'bg-red-500/20 text-red-400' },
  refunded: { label: 'Буцаагдсан', color: 'bg-slate-500/20 text-slate-400' },
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

function formatTime(time: string | null) {
  if (!time) return '-'
  // Handle both full datetime and time-only strings
  if (time.includes('T') || time.includes(' ')) {
    return new Date(time).toLocaleTimeString('mn-MN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return time
}

export default function DeskBookingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<DeskBookingDetail | null>(null)
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
      .from('desk_bookings')
      .select(`
        id, space_id, customer_id, booking_date, start_time, end_time,
        status, notes, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/desk-bookings')
      return
    }

    setBooking(data as DeskBookingDetail)
    setLoading(false)
  }, [id, supabase, router])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!booking) return
    setEditData({
      status: booking.status || '',
      notes: booking.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!booking) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        status: booking.status || '',
        notes: booking.notes || '',
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

      const res = await fetch(`/api/desk-bookings/${id}`, {
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

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Ширээний захиалга олдсонгүй</p>
        <Link href="/dashboard/desk-bookings" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[booking.status] || { label: booking.status, color: 'bg-slate-500/20 text-slate-400' }
  const ps = PAYMENT_STATUS_CONFIG[booking.payment_status || ''] || { label: booking.payment_status || '-', color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/desk-bookings"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Ширээний захиалга</h1>
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{booking.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Booking Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Захиалгын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Зай / Ширээ</p>
              <p className="text-white mt-1">{booking.space_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үйлчлүүлэгч</p>
              <p className="text-white mt-1">{booking.customer_name || booking.customer_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Захиалгын огноо</p>
              <p className="text-white mt-1">{formatDate(booking.booking_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Статус</p>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="confirmed">Баталгаажсан</option>
                  <option value="checked_in">Ирсэн</option>
                  <option value="completed">Дууссан</option>
                  <option value="cancelled">Цуцлагдсан</option>
                  <option value="no_show">Ирээгүй</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Эхлэх цаг</p>
              <p className="text-white mt-1">{formatTime(booking.start_time)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дуусах цаг</p>
              <p className="text-white mt-1">{formatTime(booking.end_time)}</p>
            </div>
          </div>
        </div>

        {/* Payment Sidebar */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Төлбөрийн мэдээлэл</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500">Дүн</p>
                <p className="text-lg text-white font-medium mt-1">{formatPrice(booking.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Төлбөрийн төлөв</p>
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${ps.color}`}>
                  {ps.label}
                </span>
              </div>
            </div>
          </div>

          {/* Customer Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Үйлчлүүлэгч</h3>
            {booking.customer_name ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {booking.customer_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{booking.customer_name}</p>
                  {booking.customer_id && (
                    <Link
                      href={`/dashboard/customers/${booking.customer_id}`}
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
            {booking.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(booking.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(booking.updated_at)}</span>
      </div>
    </div>
  )
}
