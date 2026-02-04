'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import CalendarView from '@/components/ui/CalendarView'
import type { CalendarEvent } from '@/components/ui/CalendarView'

interface ReservationRow {
  id: string
  store_id: string
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
  units: { id: string; unit_number: string; unit_type: string } | null
  guests: { id: string; first_name: string; last_name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
  checked_in: { label: 'Checked In', color: 'bg-green-500/20 text-green-400' },
  checked_out: { label: 'Checked Out', color: 'bg-slate-500/20 text-slate-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'No Show', color: 'bg-orange-500/20 text-orange-400' },
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ReservationsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [reservations, setReservations] = useState<ReservationRow[]>([])
  const [storeId, setStoreId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')

  const loadReservations = useCallback(async (sid: string) => {
    let query = supabase
      .from('reservations')
      .select(`
        id, store_id, unit_id, guest_id, check_in, check_out,
        actual_check_in, actual_check_out, adults, children,
        rate_per_night, total_amount, deposit_amount, deposit_status,
        status, source, special_requests, created_at,
        units(id, unit_number, unit_type),
        guests(id, first_name, last_name)
      `)
      .eq('store_id', sid)
      .order('check_in', { ascending: false })
      .limit(200)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (dateFrom) {
      query = query.gte('check_in', dateFrom)
    }
    if (dateTo) {
      query = query.lte('check_in', dateTo + 'T23:59:59')
    }

    const { data } = await query

    if (data) {
      setReservations(data as unknown as ReservationRow[])
    }
  }, [supabase, statusFilter, dateFrom, dateTo])

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
        await loadReservations(store.id)
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadReservations])

  useEffect(() => {
    if (!storeId || loading) return
    const reload = async () => { await loadReservations(storeId) }
    reload()
  }, [storeId, loading, loadReservations])

  const stats = useMemo(() => {
    const total = reservations.length
    const checkedIn = reservations.filter(r => r.status === 'checked_in').length
    const upcoming = reservations.filter(r => r.status === 'confirmed').length
    const revenue = reservations.reduce((sum, r) => sum + (r.total_amount || 0), 0)
    return { total, checkedIn, upcoming, revenue }
  }, [reservations])

  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return reservations.map(r => ({
      id: r.id,
      title: r.units?.unit_number || 'Өрөө',
      date: r.check_in,
      meta: r.guests ? `${r.guests.first_name} ${r.guests.last_name}` : undefined,
      status: r.status,
      statusColor: STATUS_CONFIG[r.status]?.color || 'bg-slate-500/20 text-slate-400',
    }))
  }, [reservations])

  async function handleCheckIn(reservation: ReservationRow) {
    setUpdating(reservation.id)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'checked_in',
          actual_check_in: new Date().toISOString(),
        })
        .eq('id', reservation.id)

      if (updateError) throw updateError
      await loadReservations(storeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in')
    } finally {
      setUpdating(null)
    }
  }

  async function handleCheckOut(reservation: ReservationRow) {
    setUpdating(reservation.id)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          status: 'checked_out',
          actual_check_out: new Date().toISOString(),
        })
        .eq('id', reservation.id)

      if (updateError) throw updateError
      await loadReservations(storeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check out')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Reservations</h1>
          <p className="text-slate-400 mt-1">{reservations.length} reservation records</p>
        </div>
        <Link
          href="/dashboard/reservations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-medium rounded-xl transition-all"
        >
          <span>+</span> New Reservation
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Reservations</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Checked In</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.checkedIn}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Upcoming</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.upcoming}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Revenue</p>
          <p className="text-2xl font-bold text-white mt-1">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            />
          </div>
        </div>
        {(statusFilter || dateFrom || dateTo) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo('') }}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('list')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
        >
          Жагсаалт
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
        >
          Календар
        </button>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <CalendarView
          events={calendarEvents}
          onEventClick={(event) => router.push(`/dashboard/reservations/${event.id}`)}
        />
      )}

      {/* Table (List View) */}
      {viewMode === 'list' && (
        <>
      {reservations.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1050px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Guest</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Unit</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Check In</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Check Out</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Guests</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Total</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const sc = STATUS_CONFIG[r.status] || { label: r.status, color: 'bg-slate-500/20 text-slate-400' }
                const guestName = r.guests
                  ? `${r.guests.first_name} ${r.guests.last_name}`
                  : '-'
                return (
                  <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{guestName}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <div>
                        <p className="text-white">{r.units?.unit_number || '-'}</p>
                        <p className="text-slate-400 text-xs capitalize">{r.units?.unit_type}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(r.check_in)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300 text-sm">{formatDate(r.check_out)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className="text-slate-300 text-sm">
                        {r.adults}A{r.children > 0 ? ` / ${r.children}C` : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatPrice(r.total_amount)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <div className="flex gap-1 justify-end">
                        {r.status === 'confirmed' && (
                          <button
                            onClick={() => handleCheckIn(r)}
                            disabled={updating === r.id}
                            className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === r.id ? '...' : 'Check In'}
                          </button>
                        )}
                        {r.status === 'checked_in' && (
                          <button
                            onClick={() => handleCheckOut(r)}
                            disabled={updating === r.id}
                            className="px-2 py-1 text-xs bg-slate-600/20 text-slate-300 rounded hover:bg-slate-600/30 disabled:opacity-50 transition-all"
                          >
                            {updating === r.id ? '...' : 'Check Out'}
                          </button>
                        )}
                        {r.status === 'checked_out' && (
                          <span className="text-xs text-slate-500">
                            {r.actual_check_out
                              ? formatDate(r.actual_check_out)
                              : 'Completed'}
                          </span>
                        )}
                        {r.status === 'cancelled' && (
                          <span className="text-xs text-slate-500">Cancelled</span>
                        )}
                        {r.status === 'no_show' && (
                          <span className="text-xs text-slate-500">No show</span>
                        )}
                      </div>
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
            <span className="text-4xl">&#128197;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Reservations</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {statusFilter || dateFrom || dateTo
              ? 'No reservations match your current filters. Try adjusting the filters.'
              : 'Reservation records will appear here once guests start booking.'}
          </p>
          {(statusFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo('') }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
        </>
      )}
    </div>
  )
}
