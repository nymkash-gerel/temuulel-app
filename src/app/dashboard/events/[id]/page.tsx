'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TimelineMilestone {
  id: string
  milestone_type: string
  scheduled_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
}

interface EventBooking {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  event_type: string | null
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  guest_count: number
  venue_resource_id: string | null
  status: string
  budget_estimate: number | null
  quoted_amount: number | null
  final_amount: number | null
  special_requirements: string | null
  menu_selection: unknown
  setup_notes: string | null
  created_at: string
  updated_at: string
  event_timeline: TimelineMilestone[]
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  quoted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  deposit_paid: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_service: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  inquiry: 'Лавлагаа',
  quoted: 'Үнэ санал болгосон',
  deposit_paid: 'Урьдчилгаа төлсөн',
  confirmed: 'Баталгаажсан',
  in_service: 'Үйлчилж буй',
  closed: 'Хаагдсан',
  cancelled: 'Цуцлагдсан',
}

const STATUS_PIPELINE = ['inquiry', 'quoted', 'deposit_paid', 'confirmed', 'in_service', 'closed']

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Хурим',
  corporate: 'Байгууллагын',
  birthday: 'Төрсөн өдөр',
  conference: 'Хурал',
  party: 'Үдэшлэг',
  other: 'Бусад',
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 }).format(amount)
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

export default function EventBookingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<EventBooking | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [specialRequirements, setSpecialRequirements] = useState('')
  const [setupNotes, setSetupNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadBooking = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/event-bookings/' + id)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/events')
          return
        }
        throw new Error('Failed to fetch event booking')
      }
      const data = await res.json()
      setBooking(data)
      setSpecialRequirements(data.special_requirements || '')
      setSetupNotes(data.setup_notes || '')
    } catch {
      setError('Арга хэмжээний мэдээлэл ачаалахад алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }, [id, supabase, router])

  useEffect(() => {
    loadBooking()
  }, [loadBooking])

  async function updateBooking(updates: Record<string, unknown>) {
    if (!booking) return
    setUpdating(true)
    setError(null)

    try {
      const res = await fetch('/api/event-bookings/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        throw new Error('Failed to update')
      }

      const data = await res.json()
      setBooking(data)
      setSpecialRequirements(data.special_requirements || '')
      setSetupNotes(data.setup_notes || '')
    } catch {
      setError('Шинэчлэхэд алдаа гарлаа')
    } finally {
      setUpdating(false)
    }
  }

  async function updateStatus(newStatus: string) {
    await updateBooking({ status: newStatus })
  }

  async function saveEditableFields() {
    await updateBooking({
      special_requirements: specialRequirements,
      setup_notes: setupNotes,
    })
    setEditing(false)
  }

  function getNextStatus(): string | null {
    if (!booking) return null
    const idx = STATUS_PIPELINE.indexOf(booking.status)
    if (idx === -1 || idx >= STATUS_PIPELINE.length - 1) return null
    return STATUS_PIPELINE[idx + 1]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Арга хэмжээ олдсонгүй</p>
        <Link href="/dashboard/events" className="mt-4 text-blue-400 hover:underline inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_COLORS[booking.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  const nextStatus = getNextStatus()
  const menuSelection = booking.menu_selection as Record<string, unknown> | string[] | null

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/events"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{booking.customer_name}</h1>
              {booking.event_type && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                  {EVENT_TYPE_LABELS[booking.event_type] || booking.event_type}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusCfg}`}>
                {STATUS_LABELS[booking.status] || booking.status}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {formatDate(booking.event_date)} | {booking.guest_count} зочин
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
          >
            {editing ? 'Болих' : 'Засах'}
          </button>
          {booking.status !== 'cancelled' && booking.status !== 'closed' && (
            <button
              onClick={() => {
                if (confirm('Арга хэмжээ цуцлах уу?')) updateStatus('cancelled')
              }}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all"
            >
              Цуцлах
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() => updateStatus(nextStatus)}
              disabled={updating}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {updating ? '...' : `${STATUS_LABELS[nextStatus]} болгох`}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Status Pipeline */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">Явцын шат</h3>
        <div className="flex items-center justify-between overflow-x-auto">
          {STATUS_PIPELINE.map((status, i) => {
            const currentIdx = STATUS_PIPELINE.indexOf(booking.status)
            const isCancelled = booking.status === 'cancelled'
            const isCompleted = !isCancelled && i <= currentIdx
            const isCurrent = status === booking.status

            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? isCurrent ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-emerald-500'
                      : 'bg-slate-700'
                  }`}>
                    <span className="text-white">
                      {isCompleted ? (isCurrent ? (i + 1) : '✓') : (i + 1)}
                    </span>
                  </div>
                  <span className={`text-xs mt-2 text-center whitespace-nowrap ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                {i < STATUS_PIPELINE.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    !isCancelled && i < currentIdx ? 'bg-emerald-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        {booking.status === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">Энэ арга хэмжээ цуцлагдсан байна</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Grid */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Арга хэмжээний мэдээлэл</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Огноо</span>
                <p className="text-white mt-1">{formatDate(booking.event_date)}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Зочдын тоо</span>
                <p className="text-white mt-1">{booking.guest_count}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Эхлэх цаг</span>
                <p className="text-white mt-1">{booking.event_start_time || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Дуусах цаг</span>
                <p className="text-white mt-1">{booking.event_end_time || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Арга хэмжээний төрөл</span>
                <p className="text-white mt-1 capitalize">
                  {booking.event_type ? (EVENT_TYPE_LABELS[booking.event_type] || booking.event_type) : '-'}
                </p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Танхим / Нөөц</span>
                <p className="text-white mt-1">{booking.venue_resource_id || '-'}</p>
              </div>
            </div>
          </div>

          {/* Financial Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Санхүүгийн мэдээлэл</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Төсвийн тооцоо</span>
                <span className="text-white font-medium">{formatCurrency(booking.budget_estimate)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Санал болгосон дүн</span>
                <span className="text-white font-medium">{formatCurrency(booking.quoted_amount)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <span className="text-slate-400 text-sm">Эцсийн дүн</span>
                <span className="text-white text-lg font-bold">{formatCurrency(booking.final_amount)}</span>
              </div>
            </div>
          </div>

          {/* Menu Selection */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Цэсний сонголт</h3>
            {menuSelection && typeof menuSelection === 'object' ? (
              Array.isArray(menuSelection) ? (
                <div className="space-y-2">
                  {menuSelection.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-xl">
                      <span className="text-white text-sm">{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(menuSelection).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                      <span className="text-slate-400 text-sm capitalize">{key}</span>
                      <span className="text-white text-sm">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-slate-500 text-sm">Цэс сонгогдоогүй</p>
            )}
          </div>

          {/* Special Requirements */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Тусгай шаардлага</h3>
            {editing ? (
              <textarea
                value={specialRequirements}
                onChange={(e) => setSpecialRequirements(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                placeholder="Тусгай шаардлага оруулах..."
              />
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {booking.special_requirements || 'Тусгай шаардлага байхгүй'}
              </p>
            )}
          </div>

          {/* Setup Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Бэлтгэлийн тэмдэглэл</h3>
            {editing ? (
              <div>
                <textarea
                  value={setupNotes}
                  onChange={(e) => setSetupNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Бэлтгэлийн тэмдэглэл..."
                />
                <button
                  onClick={saveEditableFields}
                  disabled={updating}
                  className="mt-3 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {updating ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {booking.setup_notes || 'Тэмдэглэл байхгүй'}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Харилцагч</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {booking.customer_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{booking.customer_name}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {booking.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Утас</span>
                  <span className="text-slate-300">{booking.customer_phone}</span>
                </div>
              )}
              {booking.customer_email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Имэйл</span>
                  <span className="text-slate-300">{booking.customer_email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Event Timeline Milestones */}
          {booking.event_timeline && booking.event_timeline.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Хуваарь</h3>
              <div className="space-y-3">
                {booking.event_timeline.map((milestone) => (
                  <div key={milestone.id} className="p-3 bg-slate-700/30 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium capitalize">
                        {milestone.milestone_type.replace(/_/g, ' ')}
                      </span>
                      {milestone.completed_at ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                          Дууссан
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400">
                          Хүлээгдэж буй
                        </span>
                      )}
                    </div>
                    {milestone.scheduled_at && (
                      <p className="text-slate-400 text-xs">
                        Хуваарь: {formatDateTime(milestone.scheduled_at)}
                      </p>
                    )}
                    {milestone.completed_at && (
                      <p className="text-green-400 text-xs">
                        Дууссан: {formatDateTime(milestone.completed_at)}
                      </p>
                    )}
                    {milestone.notes && (
                      <p className="text-slate-400 text-xs mt-1">{milestone.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Огноо</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(booking.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(booking.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
