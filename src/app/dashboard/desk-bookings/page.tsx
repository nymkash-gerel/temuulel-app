'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CalendarView from '@/components/ui/CalendarView'
import type { CalendarEvent } from '@/components/ui/CalendarView'

interface DeskBookingRow {
  id: string
  space_id: string
  customer_id: string
  booking_date: string
  start_time: string
  end_time: string
  total_amount: number
  status: string
  notes: string | null
  created_at: string
  coworking_spaces: { id: string; name: string } | null
  customers: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  checked_in: { label: 'Бүртгэгдсэн', color: 'bg-green-500/20 text-green-400' },
  checked_out: { label: 'Гарсан', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatTime(timeStr: string): string {
  // Handle both "HH:mm:ss" and "HH:mm" formats
  const parts = timeStr.split(':')
  return `${parts[0]}:${parts[1]}`
}

export default function DeskBookingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState<DeskBookingRow[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  async function loadBookings(sid: string) {
    let query = supabase
      .from('desk_bookings')
      .select(`
        id, space_id, customer_id, booking_date, start_time, end_time,
        total_amount, status, notes, created_at,
        coworking_spaces(id, name),
        customers(id, name)
      `)
      .eq('store_id', sid)
      .order('booking_date', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    if (data) {
      setBookings(data as unknown as DeskBookingRow[])
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        await loadBookings(store.id)
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!storeId || loading) return
    loadBookings(storeId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const stats = useMemo(() => {
    const total = bookings.length
    const confirmed = bookings.filter(b => b.status === 'confirmed').length
    const checkedIn = bookings.filter(b => b.status === 'checked_in').length
    const revenue = bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0)
    return { total, confirmed, checkedIn, revenue }
  }, [bookings])

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return bookings.map((b) => {
      const sc = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-slate-500/20 text-slate-400' }
      return {
        id: b.id,
        title: b.coworking_spaces?.name || 'Ширээ',
        date: b.booking_date,
        time: formatTime(b.start_time),
        endTime: formatTime(b.end_time),
        status: sc.label,
        statusColor: sc.color,
        meta: b.customers?.name || undefined,
      }
    })
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
          <h1 className="text-2xl font-bold text-white">Ширээ захиалга</h1>
          <p className="text-slate-400 mt-1">
            Нийт {bookings.length} захиалга
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Жагсаалт
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              viewMode === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Календар
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт захиалга</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Баталгаажсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Бүртгэгдсэн</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.checkedIn}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Нийт орлого</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              <option value="">Бүх төлөв</option>
              <option value="confirmed">Баталгаажсан</option>
              <option value="checked_in">Бүртгэгдсэн</option>
              <option value="checked_out">Гарсан</option>
              <option value="cancelled">Цуцлагдсан</option>
            </select>
          </div>
        </div>
        {statusFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Content: Calendar or Table */}
      {viewMode === 'calendar' ? (
        <CalendarView events={calendarEvents} />
      ) : bookings.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Ширээ/Зай</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хэрэглэгч</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Огноо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Эхлэх</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дуусах</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дүн</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const sc = STATUS_CONFIG[b.status] || { label: b.status, color: 'bg-slate-500/20 text-slate-400' }
                return (
                  <tr key={b.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">
                        {b.coworking_spaces?.name || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">
                        {b.customers?.name || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {formatDate(b.booking_date)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {formatTime(b.start_time)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">
                        {formatTime(b.end_time)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">
                        {formatPrice(b.total_amount)}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128187;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Захиалга байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter
              ? 'Шүүлтүүрт тохирох захиалга олдсонгүй. Шүүлтүүрээ өөрчилнө үү.'
              : 'Ширээ захиалгууд энд харагдана.'}
          </p>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')} 
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          )}
        </div>
      )}
    </div>
  )
}
