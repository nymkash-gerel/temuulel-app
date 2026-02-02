'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { admissionTransitions } from '@/lib/status-machine'

interface BedAssignment {
  id: string
  unit_id: string | null
  start_at: string | null
  end_at: string | null
  bookable_resources: { id: string; name: string; type: string } | null
}

interface AdmissionDetail {
  id: string
  patient_id: string
  attending_staff_id: string | null
  admit_diagnosis: string | null
  admit_at: string
  discharge_at: string | null
  discharge_summary: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  patients: {
    id: string
    first_name: string
    last_name: string
    date_of_birth: string | null
    gender: string | null
    blood_type: string | null
    allergies: string | null
  } | null
  staff: { id: string; name: string } | null
  bed_assignments: BedAssignment[]
}

const STATUS_COLORS: Record<string, string> = {
  admitted: 'bg-blue-500/20 text-blue-400',
  discharged: 'bg-green-500/20 text-green-400',
  transferred: 'bg-yellow-500/20 text-yellow-400',
}

const STATUS_LABELS: Record<string, string> = {
  admitted: 'Хэвтсэн',
  discharged: 'Гарсан',
  transferred: 'Шилжүүлсэн',
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

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default function AdmissionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [admission, setAdmission] = useState<AdmissionDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    // Fetch admission via API
    const res = await fetch(`/api/admissions/${id}`)
    if (!res.ok) {
      router.push('/dashboard/inpatient')
      return
    }
    const data = await res.json()
    setAdmission(data)
    setLoading(false)
  }

  function startEdit() {
    if (!admission) return
    setEditData({
      discharge_summary: admission.discharge_summary || '',
      notes: admission.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!admission) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        discharge_summary: admission.discharge_summary || '',
        notes: admission.notes || '',
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

      const res = await fetch(`/api/admissions/${id}`, {
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

  if (!admission) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Хэвтэн эмчлүүлэгчийн мэдээлэл олдсонгүй</p>
        <Link href="/dashboard/inpatient" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_COLORS[admission.status] || 'bg-slate-500/20 text-slate-400'
  const sl = STATUS_LABELS[admission.status] || admission.status
  const patientName = admission.patients
    ? `${admission.patients.first_name} ${admission.patients.last_name}`
    : '-'
  const daysAdmitted = admission.status === 'admitted'
    ? daysSince(admission.admit_at)
    : admission.discharge_at
      ? Math.floor((new Date(admission.discharge_at).getTime() - new Date(admission.admit_at).getTime()) / (1000 * 60 * 60 * 24))
      : daysSince(admission.admit_at)
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/inpatient"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{patientName}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc}`}>
                {sl}
              </span>
              {admission.status === 'admitted' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                  {daysAdmitted} хоног
                </span>
              )}
            </div>
            <p className="text-slate-400 mt-1">{admission.admit_diagnosis || 'Онош оруулаагүй'}</p>
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusActions
          currentStatus={admission.status}
          transitions={admissionTransitions}
          statusLabels={STATUS_LABELS}
          apiPath={`/api/admissions/${id}`}
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

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Admission Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Хэвтэлтийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Онош</p>
              <p className="text-white mt-1">{admission.admit_diagnosis || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хариуцсан эмч</p>
              <p className="text-white mt-1">{admission.staff?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хэвтсэн огноо</p>
              <p className="text-white mt-1">{formatDateTime(admission.admit_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Гарсан огноо</p>
              <p className="text-white mt-1">{formatDateTime(admission.discharge_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хэвтсэн хоног</p>
              <p className="text-white font-medium mt-1">{daysAdmitted} хоног</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлөв</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs mt-1 ${sc}`}>
                {sl}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(admission.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(admission.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Patient Info */}
        <div className="space-y-4">
          {/* Patient Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Өвчтөний мэдээлэл</h3>
            {admission.patients ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">
                      {admission.patients.first_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{patientName}</p>
                    <Link
                      href={`/dashboard/patients/${admission.patients.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                    >
                      Дэлгэрэнгүй
                    </Link>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {admission.patients.date_of_birth && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Төрсөн огноо</span>
                      <span className="text-slate-300">{formatDate(admission.patients.date_of_birth)}</span>
                    </div>
                  )}
                  {admission.patients.gender && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Хүйс</span>
                      <span className="text-slate-300">
                        {admission.patients.gender === 'male' ? 'Эрэгтэй' : admission.patients.gender === 'female' ? 'Эмэгтэй' : admission.patients.gender}
                      </span>
                    </div>
                  )}
                  {admission.patients.blood_type && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Цусны бүлэг</span>
                      <span className="text-white font-medium">{admission.patients.blood_type}</span>
                    </div>
                  )}
                  {admission.patients.allergies && (
                    <div>
                      <span className="text-slate-500">Харшил</span>
                      <p className="text-red-400 text-xs mt-1">{admission.patients.allergies}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Сонгоогүй</p>
            )}
          </div>

          {/* Attending Physician Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хариуцсан эмч</h3>
            {admission.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {admission.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{admission.staff.name}</p>
                  <p className="text-slate-400 text-xs">Хариуцсан эмч</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Томилоогүй</p>
            )}
          </div>
        </div>
      </div>

      {/* Bed Assignments */}
      {admission.bed_assignments && admission.bed_assignments.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-sm text-slate-400 font-medium">
              Орны хуваарилалт ({admission.bed_assignments.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Ор / Өрөө</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Төрөл</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Эхлэсэн</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Дууссан</th>
                </tr>
              </thead>
              <tbody>
                {admission.bed_assignments.map(ba => (
                  <tr key={ba.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-white text-sm">
                      {ba.bookable_resources?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm capitalize">
                      {ba.bookable_resources?.type || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {formatDateTime(ba.start_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {formatDateTime(ba.end_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discharge Summary Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Гарах дүгнэлт</h3>
        {isEditing ? (
          <textarea
            value={editData.discharge_summary as string}
            onChange={e => setEditData({ ...editData, discharge_summary: e.target.value })}
            className={`${inputClassName} min-h-[120px]`}
            rows={5}
            placeholder="Гарах дүгнэлт бичих..."
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {admission.discharge_summary || 'Гарах дүгнэлт оруулаагүй'}
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
            {admission.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(admission.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(admission.updated_at)}</span>
      </div>
    </div>
  )
}
