'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface CaseEventDetail {
  id: string
  case_id: string | null
  event_type: string | null
  title: string | null
  scheduled_at: string | null
  location: string | null
  outcome: string | null
  notes: string | null
  created_at: string
  updated_at: string
  legal_cases: { id: string; case_number: string; title: string } | null
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  hearing: { label: 'Шүүх хурал', color: 'bg-blue-500/20 text-blue-400' },
  deposition: { label: 'Мэдүүлэг', color: 'bg-purple-500/20 text-purple-400' },
  filing: { label: 'Бүртгэл', color: 'bg-cyan-500/20 text-cyan-400' },
  meeting: { label: 'Уулзалт', color: 'bg-yellow-500/20 text-yellow-400' },
  deadline: { label: 'Эцсийн хугацаа', color: 'bg-red-500/20 text-red-400' },
  other: { label: 'Бусад', color: 'bg-slate-500/20 text-slate-400' },
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

export default function CaseEventDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caseEvent, setCaseEvent] = useState<CaseEventDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/case-events/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/legal-cases')
          return
        }
        throw new Error('Мэдээлэл ачаалахад алдаа гарлаа')
      }
      const data = await res.json()
      setCaseEvent(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!caseEvent) return
    setEditData({
      title: caseEvent.title || '',
      event_type: caseEvent.event_type || '',
      scheduled_at: caseEvent.scheduled_at ? caseEvent.scheduled_at.slice(0, 16) : '',
      location: caseEvent.location || '',
      outcome: caseEvent.outcome || '',
      notes: caseEvent.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!caseEvent) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        title: caseEvent.title || '',
        event_type: caseEvent.event_type || '',
        scheduled_at: caseEvent.scheduled_at ? caseEvent.scheduled_at.slice(0, 16) : '',
        location: caseEvent.location || '',
        outcome: caseEvent.outcome || '',
        notes: caseEvent.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if ((key === 'scheduled_at') && editData[key] === '') {
            changes[key] = null
          } else {
            changes[key] = editData[key] || null
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/case-events/${id}`, {
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

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <Link href="/dashboard/legal-cases" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!caseEvent) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Үйл явдлын мэдээлэл олдсонгүй</p>
        <Link href="/dashboard/legal-cases" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const eventTypeConfig = EVENT_TYPE_CONFIG[caseEvent.event_type || ''] || { label: caseEvent.event_type || '-', color: 'bg-slate-500/20 text-slate-400' }

  // Check if the event date is in the past
  const isPast = caseEvent.scheduled_at ? new Date(caseEvent.scheduled_at) < new Date() : false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/legal-cases"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.title as string}
                    onChange={e => setEditData({ ...editData, title: e.target.value })}
                    className={`${inputClassName} text-2xl font-bold`}
                  />
                ) : (
                  caseEvent.title || 'Нэргүй үйл явдал'
                )}
              </h1>
              {isEditing ? (
                <select
                  value={editData.event_type as string}
                  onChange={e => setEditData({ ...editData, event_type: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="hearing">Шүүх хурал</option>
                  <option value="deposition">Мэдүүлэг</option>
                  <option value="filing">Бүртгэл</option>
                  <option value="meeting">Уулзалт</option>
                  <option value="deadline">Эцсийн хугацаа</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${eventTypeConfig.color}`}>
                  {eventTypeConfig.label}
                </span>
              )}
              {isPast && !isEditing && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
                  Өнгөрсөн
                </span>
              )}
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{caseEvent.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Event Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Үйл явдлын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Гарчиг</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.title as string}
                  onChange={e => setEditData({ ...editData, title: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{caseEvent.title || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төрөл</p>
              {isEditing ? (
                <select
                  value={editData.event_type as string}
                  onChange={e => setEditData({ ...editData, event_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="hearing">Шүүх хурал</option>
                  <option value="deposition">Мэдүүлэг</option>
                  <option value="filing">Бүртгэл</option>
                  <option value="meeting">Уулзалт</option>
                  <option value="deadline">Эцсийн хугацаа</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${eventTypeConfig.color}`}>
                  {eventTypeConfig.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Товлосон огноо</p>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editData.scheduled_at as string}
                  onChange={e => setEditData({ ...editData, scheduled_at: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className={`mt-1 ${caseEvent.scheduled_at ? (isPast ? 'text-slate-400' : 'text-blue-400 font-medium') : 'text-white'}`}>
                  {formatDateTime(caseEvent.scheduled_at)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Байршил</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.location as string}
                  onChange={e => setEditData({ ...editData, location: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{caseEvent.location || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(caseEvent.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(caseEvent.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Case */}
        <div className="space-y-4">
          {/* Case Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Холбогдох хэрэг</h3>
            {caseEvent.legal_cases ? (
              <div>
                <p className="text-white font-medium">{caseEvent.legal_cases.case_number}</p>
                <p className="text-slate-400 text-sm mt-1">{caseEvent.legal_cases.title}</p>
                <Link
                  href={`/dashboard/legal-cases/${caseEvent.legal_cases.id}`}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-all mt-2 inline-block"
                >
                  Хэрэг харах
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Хэрэг холбоогүй</p>
            )}
          </div>

          {/* Event Schedule Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хуваарь</h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500">Огноо</p>
                <p className="text-white text-sm">{formatDate(caseEvent.scheduled_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Цаг</p>
                <p className="text-white text-sm">
                  {caseEvent.scheduled_at
                    ? new Date(caseEvent.scheduled_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Байршил</p>
                <p className="text-white text-sm">{caseEvent.location || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Outcome Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Үр дүн</h3>
        {isEditing ? (
          <textarea
            value={editData.outcome as string}
            onChange={e => setEditData({ ...editData, outcome: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {caseEvent.outcome || 'Үр дүн оруулаагүй'}
          </p>
        )}
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
            {caseEvent.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(caseEvent.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(caseEvent.updated_at)}</span>
      </div>
    </div>
  )
}
