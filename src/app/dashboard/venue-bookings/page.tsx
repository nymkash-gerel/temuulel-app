'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'

interface VenueBooking {
  id: string
  venue_id: string
  customer_id: string | null
  event_type: string | null
  start_at: string
  end_at: string
  guests_count: number | null
  total_amount: number | null
  deposit_amount: number | null
  special_requests: string | null
  status: string
  created_at: string
  updated_at: string
  venues: { id: string; name: string } | null
  customers: { id: string; name: string | null } | null
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed:   { label: 'Баталгаажсан',   color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй',   color: 'bg-cyan-500/20 text-cyan-400' },
  completed:   { label: 'Дууссан',         color: 'bg-green-500/20 text-green-400' },
  cancelled:   { label: 'Цуцлагдсан',     color: 'bg-red-500/20 text-red-400' },
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VenueBookingsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<VenueBooking[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    async function loadBookings() {
      try {
        const res = await fetch('/api/venue-bookings')
        if (res.ok) {
          const json = await res.json()
          setBookings(json.data || [])
          setTotal(json.total || 0)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); setLoading(false); return }
      await loadBookings()
    }
    init()
  }, [supabase, router])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return bookings
    return bookings.filter(b => b.status === statusFilter)
  }, [bookings, statusFilter])

  const stats = useMemo(() => {
    const totalBookings = bookings.length
    const upcoming = bookings.filter(
      b => (b.status === 'pending' || b.status === 'confirmed') && new Date(b.start_at) >= new Date()
    ).length
    const revenue = bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0)
    return { totalBookings, upcoming, revenue }
  }, [bookings])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const b of bookings) {
      counts[b.status] = (counts[b.status] || 0) + 1
    }
    return counts
  }, [bookings])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Заалны захиалгууд</h1>
          <p className="text-slate-400 mt-1">
            Нийт {total} захиалга
            {filtered.length !== bookings.length && ` (${filtered.length} илэрц)`}
          </p>
        </div>
        <Link
          href="/dashboard/venues"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all"
        >
          Заалууд руу
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт захиалга</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalBookings}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Удахгүй болох</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.upcoming}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Нийт орлого</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-400">Төлөв:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              Бүгд ({bookings.length})
            </button>
            {(Object.keys(BOOKING_STATUS) as StatusFilter[]).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                  statusFilter === key
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {BOOKING_STATUS[key].label} ({statusCounts[key] || 0})
              </button>
            ))}
          </div>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      </div>

      {/* Bookings Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Заал</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Захиалагч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Арга хэмжээ</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Эхлэх</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Зочид</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Нийт дүн</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => {
                const statusCfg = BOOKING_STATUS[booking.status] ?? {
                  label: booking.status,
                  color: 'bg-slate-500/20 text-slate-400',
                }
                return (
                  <tr key={booking.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <Link
                        href={`/dashboard/venues/${booking.venue_id}`}
                        className="text-white font-medium hover:text-blue-400 transition-all"
                      >
                        {booking.venues?.name || 'Тодорхойгүй'}
                      </Link>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{booking.customers?.name || 'Тодорхойгүй'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{booking.event_type || '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDateTime(booking.start_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDateTime(booking.end_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{booking.guests_count ?? '-'}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">
                        {booking.total_amount != null ? formatPrice(booking.total_amount) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : bookings.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Шүүлтүүрт тохирох захиалга олдсонгүй</p>
          <button
            onClick={() => setStatusFilter('all')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128197;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Захиалга бүртгэгдээгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Заалны захиалгууд энд харагдана
          </p>
          <Link
            href="/dashboard/venues"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-xl transition-all"
          >
            Заалууд руу очих
          </Link>
        </div>
      )}
    </div>
  )
}
