'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ScheduleEntry {
  day: string
  time: string
}

interface FitnessClass {
  id: string
  name: string
  description: string | null
  class_type: string
  capacity: number
  duration_minutes: number
  schedule: ScheduleEntry[] | Record<string, string | string[]> | null
  instructor_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  staff: { id: string; name: string } | null
}

interface ClassBooking {
  id: string
  class_id: string
  customer_id: string
  booking_date: string
  status: string
  created_at: string
  customers: { id: string; name: string } | null
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  yoga: 'Йога',
  pilates: 'Пилатес',
  crossfit: 'CrossFit',
  spinning: 'Spinning',
  boxing: 'Бокс',
  dance: 'Бүжиг',
  strength: 'Хүч',
  cardio: 'Кардио',
  martial_arts: 'Тулааны урлаг',
  swimming: 'Усанд сэлэлт',
}

const BOOKING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  attended: { label: 'Ирсэн', color: 'bg-green-500/20 text-green-400' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Даваа',
  tuesday: 'Мягмар',
  wednesday: 'Лхагва',
  thursday: 'Пүрэв',
  friday: 'Баасан',
  saturday: 'Бямба',
  sunday: 'Ням',
  mon: 'Даваа',
  tue: 'Мягмар',
  wed: 'Лхагва',
  thu: 'Пүрэв',
  fri: 'Баасан',
  sat: 'Бямба',
  sun: 'Ням',
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function renderSchedule(schedule: FitnessClass['schedule']): React.ReactNode {
  if (!schedule) {
    return <p className="text-slate-500">Хуваарь оруулаагүй</p>
  }

  // Handle array of { day, time } entries
  if (Array.isArray(schedule)) {
    if (schedule.length === 0) {
      return <p className="text-slate-500">Хуваарь оруулаагүй</p>
    }
    return (
      <div className="space-y-2">
        {schedule.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-slate-300">
              {DAY_LABELS[entry.day?.toLowerCase()] || entry.day}
            </span>
            <span className="text-white font-medium">{entry.time}</span>
          </div>
        ))}
      </div>
    )
  }

  // Handle object like { monday: "09:00", tuesday: ["09:00", "17:00"] }
  if (typeof schedule === 'object') {
    const entries = Object.entries(schedule)
    if (entries.length === 0) {
      return <p className="text-slate-500">Хуваарь оруулаагүй</p>
    }
    return (
      <div className="space-y-2">
        {entries.map(([day, times]) => (
          <div key={day} className="flex items-center justify-between">
            <span className="text-slate-300">
              {DAY_LABELS[day.toLowerCase()] || day}
            </span>
            <span className="text-white font-medium">
              {Array.isArray(times) ? times.join(', ') : String(times)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return <p className="text-slate-500">Хуваарь оруулаагүй</p>
}

export default function FitnessClassDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [fitnessClass, setFitnessClass] = useState<FitnessClass | null>(null)
  const [bookings, setBookings] = useState<ClassBooking[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      const [classRes, bookingsRes] = await Promise.all([
        supabase
          .from('fitness_classes')
          .select(`
            id, name, description, class_type, capacity, duration_minutes,
            schedule, instructor_id, is_active, created_at, updated_at,
            staff(id, name)
          `)
          .eq('id', id)
          .eq('store_id', store.id)
          .single(),
        supabase
          .from('class_bookings')
          .select(`
            id, class_id, customer_id, booking_date, status, created_at,
            customers(id, name)
          `)
          .eq('class_id', id)
          .order('booking_date', { ascending: false }),
      ])

      if (classRes.data) {
        setFitnessClass(classRes.data as unknown as FitnessClass)
      }
      if (bookingsRes.data) {
        setBookings(bookingsRes.data as unknown as ClassBooking[])
      }

      setLoading(false)
    }
    load()
  }, [supabase, router, id])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 bg-slate-700 rounded-xl"></div>
            <div className="h-48 bg-slate-700 rounded-xl"></div>
          </div>
          <div className="h-64 bg-slate-700 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (!fitnessClass) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Хичээл олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/fitness-classes')}
          className="mt-4 text-blue-400 hover:underline"
        >
          Буцах
        </button>
      </div>
    )
  }

  const classTypeLabel = CLASS_TYPE_LABELS[fitnessClass.class_type] || fitnessClass.class_type

  // Attendance stats
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const attendedCount = bookings.filter(b => b.status === 'attended').length
  const noShowCount = bookings.filter(b => b.status === 'no_show').length
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/fitness-classes')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
        >
          &larr;
        </button>
        <h1 className="text-2xl font-bold text-white">Хичээлийн дэлгэрэнгүй</h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            fitnessClass.is_active
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {fitnessClass.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
        </span>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Class Info Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Хичээлийн мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white font-medium">{fitnessClass.name}</p>
            </div>
            <div>
              <span className="text-sm text-slate-400">Төрөл</span>
              <p className="text-white">{classTypeLabel}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <span className="text-sm text-slate-400">Багтаамж</span>
                <p className="text-white">{fitnessClass.capacity} хүн</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Үргэлжлэх хугацаа</span>
                <p className="text-white">{fitnessClass.duration_minutes} мин</p>
              </div>
            </div>
          </div>
        </div>

        {/* Instructor Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Багш</h2>
          {fitnessClass.staff ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                <span className="text-lg text-slate-300">
                  {fitnessClass.staff.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{fitnessClass.staff.name}</p>
                <p className="text-sm text-slate-400">Багш</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Багш оноогоогүй</p>
          )}
        </div>

        {/* Schedule Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Хуваарь</h2>
          {renderSchedule(fitnessClass.schedule)}
        </div>

        {/* Description Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Тайлбар</h2>
          {fitnessClass.description ? (
            <p className="text-slate-300 whitespace-pre-wrap">{fitnessClass.description}</p>
          ) : (
            <p className="text-slate-500">Тайлбар оруулаагүй</p>
          )}
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{confirmedCount}</p>
          <p className="text-sm text-slate-400 mt-1">Баталгаажсан</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{attendedCount}</p>
          <p className="text-sm text-slate-400 mt-1">Ирсэн</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{noShowCount}</p>
          <p className="text-sm text-slate-400 mt-1">Ирээгүй</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{cancelledCount}</p>
          <p className="text-sm text-slate-400 mt-1">Цуцлагдсан</p>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Бүртгэлүүд ({bookings.length})
        </h2>
        {bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="pb-3 text-sm font-medium text-slate-400">Хэрэглэгч</th>
                  <th className="pb-3 text-sm font-medium text-slate-400">Огноо</th>
                  <th className="pb-3 text-sm font-medium text-slate-400">Статус</th>
                  <th className="pb-3 text-sm font-medium text-slate-400">Бүртгэсэн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {bookings.map((booking) => {
                  const statusCfg = BOOKING_STATUS_CONFIG[booking.status] || {
                    label: booking.status,
                    color: 'bg-slate-500/20 text-slate-400',
                  }
                  return (
                    <tr key={booking.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 text-white">
                        {booking.customers?.name || 'Тодорхойгүй'}
                      </td>
                      <td className="py-3 text-slate-300">
                        {formatDate(booking.booking_date)}
                      </td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 text-sm">
                        {formatDateTime(booking.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500">Бүртгэл байхгүй</p>
        )}
      </div>

      {/* Meta */}
      <div className="mt-6 text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(fitnessClass.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(fitnessClass.updated_at)}</span>
      </div>
    </div>
  )
}
