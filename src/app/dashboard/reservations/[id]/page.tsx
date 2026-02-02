'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Reservation {
  id: string
  unit_id: string
  guest_id: string
  check_in: string
  check_out: string
  actual_check_in: string | null
  actual_check_out: string | null
  adults: number
  children: number
  rate_per_night: number
  total_amount: number
  deposit_amount: number
  deposit_status: string
  status: string
  source: string
  special_requests: string | null
  created_at: string
  updated_at: string
  units: { id: string; unit_number: string; unit_type: string } | null
  guests: { id: string; first_name: string; last_name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  checked_in: { label: 'Бүртгэгдсэн', color: 'bg-green-500/20 text-green-400' },
  checked_out: { label: 'Гарсан', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400' },
}

const DEPOSIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  paid: { label: 'Төлсөн', color: 'bg-green-500/20 text-green-400' },
  refunded: { label: 'Буцаагдсан', color: 'bg-slate-500/20 text-slate-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateNights(checkIn: string, checkOut: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay))
}

export default function ReservationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    loadReservation()
  }, [id])

  async function loadReservation() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { setLoading(false); return }

    const { data } = await supabase
      .from('reservations')
      .select(`
        id, unit_id, guest_id, check_in, check_out, actual_check_in, actual_check_out,
        adults, children, rate_per_night, total_amount, deposit_amount, deposit_status,
        status, source, special_requests, created_at, updated_at,
        units(id, unit_number, unit_type),
        guests(id, first_name, last_name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    setReservation(data as unknown as Reservation)
    setLoading(false)
  }

  async function updateStatus(newStatus: string) {
    if (!reservation) return
    setUpdating(true)

    const res = await fetch(`/api/reservations/${reservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (res.ok) {
      const data = await res.json()
      setReservation(data)
    }
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="h-64 bg-slate-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Захиалга олдсонгүй.</p>
        <button onClick={() => router.push('/dashboard/reservations')} className="mt-4 text-blue-400 hover:underline">
          Буцах
        </button>
      </div>
    )
  }

  const nights = calculateNights(reservation.check_in, reservation.check_out)
  const statusCfg = STATUS_CONFIG[reservation.status] || { label: reservation.status, color: 'bg-slate-500/20 text-slate-400' }
  const depositCfg = DEPOSIT_STATUS_CONFIG[reservation.deposit_status] || { label: reservation.deposit_status, color: 'bg-slate-500/20 text-slate-400' }

  const statusActions: { status: string; label: string; color: string }[] = []
  if (reservation.status === 'confirmed') {
    statusActions.push({ status: 'checked_in', label: 'Бүртгэх (Check In)', color: 'bg-green-600 hover:bg-green-500' })
    statusActions.push({ status: 'cancelled', label: 'Цуцлах', color: 'bg-red-600 hover:bg-red-500' })
    statusActions.push({ status: 'no_show', label: 'Ирээгүй', color: 'bg-orange-600 hover:bg-orange-500' })
  } else if (reservation.status === 'checked_in') {
    statusActions.push({ status: 'checked_out', label: 'Гаргах (Check Out)', color: 'bg-blue-600 hover:bg-blue-500' })
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/reservations')} className="text-slate-400 hover:text-white">
          ← Буцах
        </button>
        <h1 className="text-2xl font-bold text-white">Захиалгын дэлгэрэнгүй</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Status Actions */}
      {statusActions.length > 0 && (
        <div className="flex gap-3 mb-6">
          {statusActions.map(action => (
            <button
              key={action.status}
              onClick={() => updateStatus(action.status)}
              disabled={updating}
              className={`px-4 py-2 rounded-lg text-white font-medium ${action.color} disabled:opacity-50`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Guest Info */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Зочны мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white">
                {reservation.guests
                  ? `${reservation.guests.first_name} ${reservation.guests.last_name}`
                  : 'Тодорхойгүй'}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Том хүн / Хүүхэд</span>
              <p className="text-white">{reservation.adults} том хүн, {reservation.children} хүүхэд</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Эх сурвалж</span>
              <p className="text-white capitalize">{reservation.source}</p>
            </div>
          </div>
        </div>

        {/* Unit Info */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Өрөө / Байр</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Өрөөний дугаар</span>
              <p className="text-white">{reservation.units?.unit_number || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Төрөл</span>
              <p className="text-white capitalize">{reservation.units?.unit_type || '-'}</p>
            </div>
          </div>
        </div>

        {/* Stay Details */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Байрлах хугацаа</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <div>
                <span className="text-sm text-slate-400">Ирэх</span>
                <p className="text-white">{formatDate(reservation.check_in)}</p>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-400">Гарах</span>
                <p className="text-white">{formatDate(reservation.check_out)}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-slate-400">Хоног</span>
              <p className="text-white">{nights} хоног</p>
            </div>
            {reservation.actual_check_in && (
              <div>
                <span className="text-sm text-slate-400">Бүртгэгдсэн</span>
                <p className="text-green-400">{formatDateTime(reservation.actual_check_in)}</p>
              </div>
            )}
            {reservation.actual_check_out && (
              <div>
                <span className="text-sm text-slate-400">Гарсан</span>
                <p className="text-blue-400">{formatDateTime(reservation.actual_check_out)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Төлбөрийн мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэг хоногийн үнэ</span>
              <p className="text-white">{formatPrice(reservation.rate_per_night)}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Нийт дүн</span>
              <p className="text-xl font-bold text-white">{formatPrice(reservation.total_amount)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <span className="text-sm text-slate-400">Урьдчилгаа</span>
                <p className="text-white">{formatPrice(reservation.deposit_amount)}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${depositCfg.color}`}>
                {depositCfg.label}
              </span>
            </div>
            <div>
              <span className="text-sm text-slate-400">Үлдэгдэл</span>
              <p className="text-yellow-400 font-medium">
                {formatPrice(reservation.total_amount - reservation.deposit_amount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Special Requests */}
      {reservation.special_requests && (
        <div className="mt-6 bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-2">Тусгай хүсэлт</h2>
          <p className="text-slate-300 whitespace-pre-wrap">{reservation.special_requests}</p>
        </div>
      )}

      {/* Meta */}
      <div className="mt-6 text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(reservation.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(reservation.updated_at)}</span>
      </div>
    </div>
  )
}
