'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { consultationTransitions } from '@/lib/status-machine'

interface Consultation {
  id: string
  customer_id: string
  consultant_id: string | null
  consultation_type: string
  scheduled_at: string
  duration_minutes: number | null
  status: string
  fee: number | null
  location: string | null
  meeting_url: string | null
  notes: string | null
  follow_up_date: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string | null } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  initial: 'Анхны',
  follow_up: 'Дахин',
  review: 'Хяналт',
  strategy: 'Стратеги',
  legal: 'Хууль зүй',
  financial: 'Санхүү',
  technical: 'Техникийн',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Товлогдсон',
  rescheduled: 'Дахин товлогдсон',
  in_progress: 'Явагдаж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
  no_show: 'Ирээгүй',
}


function formatPrice(price: number): string {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮'
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ConsultationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    const { data } = await supabase
      .from('consultations')
      .select(`
        *,
        customers(id, name),
        staff(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) { router.push('/dashboard/consultations'); return }

    setConsultation(data as unknown as Consultation)
    setLoading(false)
  }

  function startEdit() {
    if (!consultation) return
    setEditData({
      consultation_type: consultation.consultation_type,
      scheduled_at: consultation.scheduled_at ? consultation.scheduled_at.slice(0, 16) : '',
      duration_minutes: consultation.duration_minutes ?? '',
      fee: consultation.fee ?? '',
      location: consultation.location ?? '',
      meeting_url: consultation.meeting_url ?? '',
      notes: consultation.notes ?? '',
      follow_up_date: consultation.follow_up_date ? consultation.follow_up_date.slice(0, 10) : '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!consultation) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}

      if (editData.consultation_type !== consultation.consultation_type) {
        changes.consultation_type = editData.consultation_type
      }
      if (editData.scheduled_at !== consultation.scheduled_at?.slice(0, 16)) {
        changes.scheduled_at = new Date(editData.scheduled_at as string).toISOString()
      }
      if (Number(editData.duration_minutes) !== consultation.duration_minutes) {
        changes.duration_minutes = Number(editData.duration_minutes)
      }
      if (Number(editData.fee) !== consultation.fee) {
        changes.fee = Number(editData.fee)
      }
      if (editData.location !== (consultation.location ?? '')) {
        changes.location = editData.location
      }
      if (editData.meeting_url !== (consultation.meeting_url ?? '')) {
        changes.meeting_url = editData.meeting_url
      }
      if (editData.notes !== (consultation.notes ?? '')) {
        changes.notes = editData.notes
      }
      if (editData.follow_up_date !== (consultation.follow_up_date?.slice(0, 10) ?? '')) {
        changes.follow_up_date = editData.follow_up_date || null
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/consultations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Хадгалахад алдаа гарлаа')
      }

      setIsEditing(false)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router, id])


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!consultation) return null

  const sc = STATUS_CONFIG[consultation.status] || STATUS_CONFIG.scheduled
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/consultations"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Зөвлөгөөний дэлгэрэнгүй</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Үүсгэсэн: {formatDateTime(consultation.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusActions
            currentStatus={consultation.status}
            transitions={consultationTransitions}
            statusLabels={STATUS_LABELS}
            apiPath={`/api/consultations/${id}`}
            onSuccess={load}
          />
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-all"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-all"
            >
              Засах
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Info Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Зөвлөгөөний мэдээлэл</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400">Төрөл</p>
                {isEditing ? (
                  <select
                    value={editData.consultation_type as string}
                    onChange={e => setEditData({ ...editData, consultation_type: e.target.value })}
                    className={inputClassName + ' mt-1'}
                  >
                    {Object.entries(CONSULTATION_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white mt-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-200">
                      {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-slate-400">Товлосон цаг</p>
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={editData.scheduled_at as string}
                    onChange={e => setEditData({ ...editData, scheduled_at: e.target.value })}
                    className={inputClassName + ' mt-1'}
                  />
                ) : (
                  <p className="text-white mt-1">{formatDateTime(consultation.scheduled_at)}</p>
                )}
              </div>
              {(isEditing || consultation.duration_minutes != null) && (
                <div>
                  <p className="text-sm text-slate-400">Үргэлжлэх хугацаа</p>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.duration_minutes as string | number}
                      onChange={e => setEditData({ ...editData, duration_minutes: e.target.value })}
                      placeholder="минут"
                      className={inputClassName + ' mt-1'}
                    />
                  ) : (
                    <p className="text-white mt-1">{consultation.duration_minutes} минут</p>
                  )}
                </div>
              )}
              {(isEditing || consultation.location) && (
                <div>
                  <p className="text-sm text-slate-400">Байршил</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.location as string}
                      onChange={e => setEditData({ ...editData, location: e.target.value })}
                      placeholder="Байршил"
                      className={inputClassName + ' mt-1'}
                    />
                  ) : (
                    <p className="text-white mt-1">{consultation.location}</p>
                  )}
                </div>
              )}
              {(isEditing || consultation.meeting_url) && (
                <div className="md:col-span-2">
                  <p className="text-sm text-slate-400">Онлайн холбоос</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.meeting_url as string}
                      onChange={e => setEditData({ ...editData, meeting_url: e.target.value })}
                      placeholder="https://..."
                      className={inputClassName + ' mt-1'}
                    />
                  ) : (
                    <a
                      href={consultation.meeting_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-1 text-blue-400 hover:text-blue-300 transition-all break-all"
                    >
                      {consultation.meeting_url}
                      <span className="text-xs">↗</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Тэмдэглэл</h2>
            {isEditing ? (
              <textarea
                value={editData.notes as string}
                onChange={e => setEditData({ ...editData, notes: e.target.value })}
                rows={5}
                placeholder="Тэмдэглэл..."
                className={inputClassName}
              />
            ) : (
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {consultation.notes || 'Тэмдэглэл байхгүй'}
              </p>
            )}
          </div>

          {/* Follow-up Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Дараагийн уулзалт</h2>
            {isEditing ? (
              <input
                type="date"
                value={editData.follow_up_date as string}
                onChange={e => setEditData({ ...editData, follow_up_date: e.target.value })}
                className={inputClassName}
              />
            ) : consultation.follow_up_date ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 text-sm font-bold">
                    {new Date(consultation.follow_up_date).getDate()}
                  </span>
                </div>
                <div>
                  <p className="text-white">{formatDate(consultation.follow_up_date)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Дараагийн товлосон огноо</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Дараагийн уулзалт товлоогүй</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Үйлчлүүлэгч</h3>
            {consultation.customers ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">
                    {consultation.customers.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">
                    {consultation.customers.name || 'Нэргүй'}
                  </p>
                  <Link
                    href={`/dashboard/customers/${consultation.customers.id}`}
                    className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                  >
                    Дэлгэрэнгүй →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Үйлчлүүлэгч тодорхойгүй</p>
            )}
          </div>

          {/* Consultant Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Зөвлөх</h3>
            {consultation.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">
                    {consultation.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">
                    {consultation.staff.name || 'Нэргүй'}
                  </p>
                  <p className="text-slate-400 text-xs">Зөвлөх</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Зөвлөх тодорхойгүй</p>
            )}
          </div>

          {/* Financial Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Хураамж</h3>
            {isEditing ? (
              <input
                type="number"
                value={editData.fee as string | number}
                onChange={e => setEditData({ ...editData, fee: e.target.value })}
                placeholder="0"
                className={inputClassName}
              />
            ) : consultation.fee != null ? (
              <p className="text-2xl font-bold text-white">{formatPrice(consultation.fee)}</p>
            ) : (
              <p className="text-slate-500 text-sm">Хураамж тодорхойгүй</p>
            )}
          </div>

          {/* Summary Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Хураангуй</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Статус</span>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Төрөл</span>
                <span className="text-white">
                  {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-white">
                  {new Date(consultation.created_at).toLocaleDateString('mn-MN')}
                </span>
              </div>
              {consultation.updated_at !== consultation.created_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Шинэчилсэн</span>
                  <span className="text-white">
                    {new Date(consultation.updated_at).toLocaleString('mn-MN')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
