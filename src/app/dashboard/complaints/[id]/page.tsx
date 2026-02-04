'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { medicalComplaintTransitions } from '@/lib/status-machine'

interface ComplaintDetail {
  id: string
  patient_id: string | null
  encounter_id: string | null
  category: string
  severity: string
  description: string
  status: string
  assigned_to: string | null
  resolution: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  encounters: {
    id: string
    encounter_type: string
    encounter_date: string
    chief_complaint: string | null
  } | null
  staff: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-500/20 text-red-400',
  assigned: 'bg-yellow-500/20 text-yellow-400',
  reviewed: 'bg-blue-500/20 text-blue-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-slate-500/20 text-slate-400',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Нээлттэй',
  assigned: 'Хуваарилсан',
  reviewed: 'Шалгасан',
  resolved: 'Шийдвэрлэсэн',
  closed: 'Хаасан',
}

const SEVERITY_COLORS: Record<string, string> = {
  minor: 'bg-slate-500/20 text-slate-400',
  moderate: 'bg-orange-500/20 text-orange-400',
  serious: 'bg-red-500/20 text-red-400',
}

const SEVERITY_LABELS: Record<string, string> = {
  minor: 'Бага',
  moderate: 'Дунд',
  serious: 'Ноцтой',
}

const CATEGORY_LABELS: Record<string, string> = {
  wait_time: 'Хүлээлтийн хугацаа',
  treatment: 'Эмчилгээ',
  staff_behavior: 'Ажилтны зан байдал',
  facility: 'Байгууламж',
  billing: 'Төлбөр тооцоо',
  other: 'Бусад',
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

export default function ComplaintDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    // Fetch complaint via API
    const res = await fetch(`/api/medical-complaints/${id}`)
    if (!res.ok) {
      router.push('/dashboard/complaints')
      return
    }
    const data = await res.json()
    setComplaint(data)
    setLoading(false)
  }, [id, supabase, router])

  useEffect(() => {
    load()
  }, [load])

  function startEdit() {
    if (!complaint) return
    setEditData({
      severity: complaint.severity || 'minor',
      category: complaint.category || 'other',
      resolution: complaint.resolution || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!complaint) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        severity: complaint.severity || 'minor',
        category: complaint.category || 'other',
        resolution: complaint.resolution || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          changes[key] = editData[key] === '' ? null : editData[key]
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/medical-complaints/${id}`, {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Гомдол олдсонгүй</p>
        <Link href="/dashboard/complaints" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_COLORS[complaint.status] || 'bg-slate-500/20 text-slate-400'
  const sl = STATUS_LABELS[complaint.status] || complaint.status
  const sevc = SEVERITY_COLORS[complaint.severity] || 'bg-slate-500/20 text-slate-400'
  const sevl = SEVERITY_LABELS[complaint.severity] || complaint.severity
  const catl = CATEGORY_LABELS[complaint.category] || complaint.category
  const patientName = complaint.patients
    ? `${complaint.patients.first_name} ${complaint.patients.last_name}`
    : null
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/complaints"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Гомдол</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc}`}>
                {sl}
              </span>
              {isEditing ? (
                <select
                  value={editData.severity as string}
                  onChange={e => setEditData({ ...editData, severity: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="minor">Бага</option>
                  <option value="moderate">Дунд</option>
                  <option value="serious">Ноцтой</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sevc}`}>
                  {sevl}
                </span>
              )}
              {isEditing ? (
                <select
                  value={editData.category as string}
                  onChange={e => setEditData({ ...editData, category: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="wait_time">Хүлээлтийн хугацаа</option>
                  <option value="treatment">Эмчилгээ</option>
                  <option value="staff_behavior">Ажилтны зан байдал</option>
                  <option value="facility">Байгууламж</option>
                  <option value="billing">Төлбөр тооцоо</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs bg-slate-600/50 text-slate-300">
                  {catl}
                </span>
              )}
            </div>
            <p className="text-slate-400 mt-1 text-sm">
              {formatDate(complaint.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusActions
          currentStatus={complaint.status}
          transitions={medicalComplaintTransitions}
          statusLabels={STATUS_LABELS}
          apiPath={`/api/medical-complaints/${id}`}
          onSuccess={load}
        />
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

      {/* Description Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Гомдлын тайлбар</h3>
        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
          {complaint.description}
        </p>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Complaint Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Гомдлын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Ангилал</p>
              {isEditing ? (
                <select
                  value={editData.category as string}
                  onChange={e => setEditData({ ...editData, category: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="wait_time">Хүлээлтийн хугацаа</option>
                  <option value="treatment">Эмчилгээ</option>
                  <option value="staff_behavior">Ажилтны зан байдал</option>
                  <option value="facility">Байгууламж</option>
                  <option value="billing">Төлбөр тооцоо</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <p className="text-white mt-1">{catl}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Хүндрэлийн зэрэг</p>
              {isEditing ? (
                <select
                  value={editData.severity as string}
                  onChange={e => setEditData({ ...editData, severity: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="minor">Бага</option>
                  <option value="moderate">Дунд</option>
                  <option value="serious">Ноцтой</option>
                </select>
              ) : (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs mt-1 ${sevc}`}>
                  {sevl}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлөв</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs mt-1 ${sc}`}>
                {sl}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шийдвэрлэсэн огноо</p>
              <p className="text-white mt-1">{formatDateTime(complaint.resolved_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(complaint.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(complaint.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Patient + Staff */}
        <div className="space-y-4">
          {/* Patient Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Өвчтөн</h3>
            {complaint.patients ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {complaint.patients.first_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{patientName}</p>
                  <Link
                    href={`/dashboard/patients/${complaint.patients.id}`}
                    className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                  >
                    Дэлгэрэнгүй
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Сонгоогүй</p>
            )}
          </div>

          {/* Assigned Staff Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хариуцагч</h3>
            {complaint.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {complaint.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{complaint.staff.name}</p>
                  <p className="text-slate-400 text-xs">Хуваарилагдсан</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Хуваарилаагүй</p>
            )}
          </div>

          {/* Encounter Card */}
          {complaint.encounters && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h3 className="text-sm text-slate-400 font-medium mb-3">Холбогдох уулзалт</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Төрөл</span>
                  <span className="text-slate-300 capitalize">{complaint.encounters.encounter_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Огноо</span>
                  <span className="text-slate-300">{formatDate(complaint.encounters.encounter_date)}</span>
                </div>
                {complaint.encounters.chief_complaint && (
                  <div>
                    <span className="text-slate-500">Гол гомдол</span>
                    <p className="text-slate-300 text-xs mt-1">{complaint.encounters.chief_complaint}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Шийдвэрлэлт</h3>
        {isEditing ? (
          <textarea
            value={editData.resolution as string}
            onChange={e => setEditData({ ...editData, resolution: e.target.value })}
            className={`${inputClassName} min-h-[120px]`}
            rows={5}
            placeholder="Шийдвэрлэлтийн тайлбар бичих..."
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {complaint.resolution || 'Шийдвэрлэлт оруулаагүй'}
          </p>
        )}
        {complaint.resolved_at && !isEditing && (
          <p className="text-xs text-slate-500 mt-3">
            Шийдвэрлэсэн: {formatDateTime(complaint.resolved_at)}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(complaint.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(complaint.updated_at)}</span>
      </div>
    </div>
  )
}
