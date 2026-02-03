'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Venue {
  id: string
  name: string
  description: string | null
  capacity: number
  hourly_rate: number
  daily_rate: number
  amenities: string[] | null
  images: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface VenueBooking {
  id: string
  venue_id: string
  customer_id: string | null
  event_type: string
  start_at: string
  end_at: string
  guests_count: number
  total_amount: number
  deposit_amount: number
  status: string
  special_requests: string | null
  created_at: string
  customers: { id: string; name: string | null } | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed:   { label: 'Баталгаажсан',   color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'Явагдаж буй',   color: 'bg-cyan-500/20 text-cyan-400' },
  completed:   { label: 'Дууссан',         color: 'bg-green-500/20 text-green-400' },
  cancelled:   { label: 'Цуцлагдсан',     color: 'bg-red-500/20 text-red-400' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VenueDetailPage(): React.ReactNode {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [venue, setVenue] = useState<Venue | null>(null)
  const [bookings, setBookings] = useState<VenueBooking[]>([])

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadBookings = useCallback(async (venueId: string): Promise<void> => {
    const { data } = await supabase
      .from('venue_bookings')
      .select(`
        id, venue_id, customer_id, event_type, start_at, end_at,
        guests_count, total_amount, deposit_amount, status,
        special_requests, created_at,
        customers(id, name)
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })

    if (data) {
      setBookings(data as unknown as VenueBooking[])
    }
  }, [supabase])

  const loadVenue = useCallback(async (): Promise<void> => {
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
      .from('venues')
      .select(`
        id, name, description, capacity, hourly_rate, daily_rate,
        amenities, images, is_active, created_at, updated_at
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    const venueData = data as unknown as Venue

    if (venueData) {
      setVenue(venueData)
      await loadBookings(venueData.id)
    }

    setLoading(false)
  }, [supabase, router, id, loadBookings])

  useEffect(() => {
    loadVenue()
  }, [loadVenue])

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!venue) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-400 mb-4">Заал олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/venues')}
          className="text-blue-400 hover:text-blue-300 transition-all"
        >
          Буцах
        </button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const amenitiesList: string[] = Array.isArray(venue.amenities)
    ? venue.amenities
    : []

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div>
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/venues')}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Заалны дэлгэрэнгүй</h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  venue.is_active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {venue.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
            </div>
            <p className="text-slate-400 mt-1 text-sm">
              {formatDateTime(venue.created_at)} -д үүсгэсэн
            </p>
          </div>
        </div>
      </div>

      {/* ---- Info Cards Grid ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Venue info card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Заалны мэдээлэл</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Нэр</span>
              <span className="text-white font-medium">{venue.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Багтаамж</span>
              <span className="text-white">{venue.capacity} хүн</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Төлөв</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  venue.is_active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {venue.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Үнэ</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Цагийн үнэ</span>
              <span className="text-white font-medium text-lg">
                {venue.hourly_rate > 0 ? formatPrice(venue.hourly_rate) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Өдрийн үнэ</span>
              <span className="text-white font-medium text-lg">
                {venue.daily_rate > 0 ? formatPrice(venue.daily_rate) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Amenities card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Тоног төхөөрөмж</h2>
          {amenitiesList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {amenitiesList.map((amenity, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm rounded-lg"
                >
                  {amenity}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Тоног төхөөрөмж бүртгэгдээгүй</p>
          )}
        </div>

        {/* Description card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Тайлбар</h2>
          {venue.description ? (
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{venue.description}</p>
          ) : (
            <p className="text-slate-400 text-sm">Тайлбар оруулаагүй</p>
          )}
        </div>
      </div>

      {/* ---- Bookings Section ---- */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          Захиалгууд ({bookings.length})
        </h2>

        {bookings.length > 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Захиалагч
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Арга хэмжээний төрөл
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Эхлэх
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Дуусах
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                    Зочид
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                    Нийт дүн
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                    Төлөв
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const statusCfg = BOOKING_STATUS[booking.status] ?? {
                    label: booking.status,
                    color: 'bg-slate-500/20 text-slate-400',
                  }

                  return (
                    <tr
                      key={booking.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white">
                          {booking.customers?.name || 'Тодорхойгүй'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300">{booking.event_type}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {formatDateTime(booking.start_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {formatDateTime(booking.end_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-slate-300">{booking.guests_count}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-white font-medium">
                          {formatPrice(booking.total_amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">Захиалга байхгүй байна</p>
          </div>
        )}
      </div>

      {/* ---- Meta ---- */}
      <div className="text-sm text-slate-500 flex flex-wrap gap-6 mb-4">
        <span>Үүсгэсэн: {formatDateTime(venue.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(venue.updated_at)}</span>
      </div>
    </div>
  )
}
