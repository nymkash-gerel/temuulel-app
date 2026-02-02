'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EventBooking {
  id: string
  customer_name: string
  event_type: string | null
  event_date: string
  guest_count: number
  status: string
  quoted_amount: number | null
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-500/20 text-blue-400',
  quoted: 'bg-yellow-500/20 text-yellow-400',
  deposit_paid: 'bg-purple-500/20 text-purple-400',
  confirmed: 'bg-green-500/20 text-green-400',
  in_service: 'bg-orange-500/20 text-orange-400',
  closed: 'bg-slate-500/20 text-slate-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'deposit_paid', label: 'Deposit Paid' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_service', label: 'In Service' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'conference', label: 'Conference' },
  { value: 'party', label: 'Party' },
  { value: 'other', label: 'Other' },
]

function formatCurrency(amount: number | null): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 }).format(amount)
}

export default function EventsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<EventBooking[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('event_type', typeFilter)

      const res = await fetch(`/api/event-bookings?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to fetch events')
      }
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : data.events || data.bookings || [])
    } catch {
      setError('Could not load events')
    } finally {
      setLoading(false)
    }
  }, [supabase, statusFilter, typeFilter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const filtered = useMemo(() => {
    if (!search.trim()) return events

    const q = search.trim().toLowerCase()
    return events.filter((e) =>
      e.customer_name?.toLowerCase().includes(q) ||
      e.event_type?.toLowerCase().includes(q)
    )
  }, [events, search])

  const stats = useMemo(() => ({
    total: events.length,
    inquiry: events.filter((e) => e.status === 'inquiry').length,
    confirmed: events.filter((e) => e.status === 'confirmed').length,
    inService: events.filter((e) => e.status === 'in_service').length,
  }), [events])

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
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-slate-400 mt-1">
            {events.length} events total
            {filtered.length !== events.length && ` (${filtered.length} results)`}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Total</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
          <p className="text-cyan-400 text-sm">Inquiry</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inquiry}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Confirmed</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.confirmed}</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
          <p className="text-orange-400 text-sm">In Service</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inService}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer or event type..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Event Cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <div key={event.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">{event.customer_name}</h3>
                  <p className="text-slate-400 text-sm capitalize">{event.event_type || 'General'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[event.status] || 'bg-slate-500/20 text-slate-400'}`}>
                  {event.status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Date</span>
                  <span className="text-white text-sm">
                    {new Date(event.event_date).toLocaleDateString('mn-MN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Guests</span>
                  <span className="text-white text-sm">{event.guest_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Quoted Amount</span>
                  <span className="text-white text-sm font-medium">{formatCurrency(event.quoted_amount)}</span>
                </div>
              </div>

              {event.notes && (
                <p className="mt-4 text-slate-400 text-xs border-t border-slate-700 pt-3 line-clamp-2">
                  {event.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : events.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No events match your filters</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No events yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Event bookings will appear here when customers make inquiries.
          </p>
        </div>
      )}
    </div>
  )
}
