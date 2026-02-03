'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { labOrderTransitions } from '@/lib/status-machine'

interface LabOrderDetail {
  id: string
  patient_id: string
  encounter_id: string | null
  ordered_by: string | null
  order_type: string
  test_name: string
  test_code: string | null
  urgency: string
  specimen_type: string | null
  collection_time: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  patients: { id: string; first_name: string; last_name: string } | null
  staff: { id: string; name: string } | null
}

interface LabResult {
  id: string
  order_id: string
  result_data: unknown
  interpretation: string | null
  report_url: string | null
  resulted_by: string | null
  resulted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  ordered: 'bg-blue-500/20 text-blue-400',
  collected: 'bg-yellow-500/20 text-yellow-400',
  processing: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  ordered: 'Захиалсан',
  collected: 'Цуглуулсан',
  processing: 'Боловсруулж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцалсан',
}

const URGENCY_COLORS: Record<string, string> = {
  routine: 'bg-slate-500/20 text-slate-400',
  urgent: 'bg-orange-500/20 text-orange-400',
  stat: 'bg-red-500/20 text-red-400',
}

const URGENCY_LABELS: Record<string, string> = {
  routine: 'Энгийн',
  urgent: 'Яаралтай',
  stat: 'STAT',
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  lab: 'Лабораторийн',
  imaging: 'Дүрс оношилгоо',
  other: 'Бусад',
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

export default function LabOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [labOrder, setLabOrder] = useState<LabOrderDetail | null>(null)
  const [results, setResults] = useState<LabResult[]>([])
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

    // Fetch lab order via API
    const res = await fetch(`/api/lab-orders/${id}`)
    if (!res.ok) {
      router.push('/dashboard/lab')
      return
    }
    const data = await res.json()
    setLabOrder(data)

    // Fetch lab results for this order
    const resResults = await fetch(`/api/lab-results?order_id=${id}`)
    if (resResults.ok) {
      const json = await resResults.json()
      setResults(json.data || [])
    }

    setLoading(false)
  }

  function startEdit() {
    if (!labOrder) return
    setEditData({
      notes: labOrder.notes || '',
      urgency: labOrder.urgency || 'routine',
      specimen_type: labOrder.specimen_type || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!labOrder) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        notes: labOrder.notes || '',
        urgency: labOrder.urgency || 'routine',
        specimen_type: labOrder.specimen_type || '',
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

      const res = await fetch(`/api/lab-orders/${id}`, {
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

  if (!labOrder) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Лабораторийн захиалга олдсонгүй</p>
        <Link href="/dashboard/lab" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_COLORS[labOrder.status] || 'bg-slate-500/20 text-slate-400'
  const sl = STATUS_LABELS[labOrder.status] || labOrder.status
  const uc = URGENCY_COLORS[labOrder.urgency] || 'bg-slate-500/20 text-slate-400'
  const ul = URGENCY_LABELS[labOrder.urgency] || labOrder.urgency
  const patientName = labOrder.patients
    ? `${labOrder.patients.first_name} ${labOrder.patients.last_name}`
    : '-'
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/lab"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{labOrder.test_name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc}`}>
                {sl}
              </span>
              {isEditing ? (
                <select
                  value={editData.urgency as string}
                  onChange={e => setEditData({ ...editData, urgency: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="routine">Энгийн</option>
                  <option value="urgent">Яаралтай</option>
                  <option value="stat">STAT</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${uc}`}>
                  {ul}
                </span>
              )}
            </div>
            {labOrder.test_code && (
              <p className="text-slate-400 mt-1 font-mono text-sm">{labOrder.test_code}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusActions
          currentStatus={labOrder.status}
          transitions={labOrderTransitions}
          statusLabels={STATUS_LABELS}
          apiPath={`/api/lab-orders/${id}`}
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
        {/* Order Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Захиалгын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Шинжилгээний нэр</p>
              <p className="text-white font-medium mt-1">{labOrder.test_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинжилгээний код</p>
              <p className="text-white font-mono mt-1">{labOrder.test_code || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Захиалгын төрөл</p>
              <p className="text-white mt-1">{ORDER_TYPE_LABELS[labOrder.order_type] || labOrder.order_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Сорьцын төрөл</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.specimen_type as string}
                  onChange={e => setEditData({ ...editData, specimen_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  placeholder="Жишээ нь: Цус, Шээс"
                />
              ) : (
                <p className="text-white mt-1">{labOrder.specimen_type || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Цуглуулсан хугацаа</p>
              <p className="text-white mt-1">{formatDateTime(labOrder.collection_time)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Яаралтай байдал</p>
              {isEditing ? (
                <select
                  value={editData.urgency as string}
                  onChange={e => setEditData({ ...editData, urgency: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="routine">Энгийн</option>
                  <option value="urgent">Яаралтай</option>
                  <option value="stat">STAT</option>
                </select>
              ) : (
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs mt-1 ${uc}`}>
                  {ul}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(labOrder.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(labOrder.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Patient + Ordered By */}
        <div className="space-y-4">
          {/* Patient Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Өвчтөн</h3>
            {labOrder.patients ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {labOrder.patients.first_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{patientName}</p>
                  <Link
                    href={`/dashboard/patients/${labOrder.patients.id}`}
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

          {/* Ordered By Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Захиалсан эмч</h3>
            {labOrder.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {labOrder.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{labOrder.staff.name}</p>
                  <p className="text-slate-400 text-xs">Хариуцсан эмч</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Томилоогүй</p>
            )}
          </div>
        </div>
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
            {labOrder.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Lab Results Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h3 className="text-sm text-slate-400 font-medium">
            Шинжилгээний үр дүн ({results.length})
          </h3>
        </div>
        {results.length > 0 ? (
          <div className="divide-y divide-slate-700/50">
            {results.map(result => (
              <div key={result.id} className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-slate-500">Үр дүн огноо</p>
                    <p className="text-white text-sm mt-1">{formatDateTime(result.resulted_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Хянасан огноо</p>
                    <p className="text-white text-sm mt-1">{formatDateTime(result.reviewed_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Тайлбар</p>
                    <p className="text-white text-sm mt-1">{result.interpretation || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Тайлан</p>
                    {result.report_url ? (
                      <a
                        href={result.report_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm mt-1 inline-block transition-all"
                      >
                        Тайлан харах
                      </a>
                    ) : (
                      <p className="text-slate-400 text-sm mt-1">-</p>
                    )}
                  </div>
                </div>
                {!!result.result_data && (
                  <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-xs text-slate-500 mb-2">Үр дүнгийн дата</p>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-x-auto">
                      {typeof result.result_data === 'string'
                        ? result.result_data
                        : JSON.stringify(result.result_data, null, 2) as string}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm">Үр дүн бүртгэгдээгүй</p>
          </div>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(labOrder.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(labOrder.updated_at)}</span>
      </div>
    </div>
  )
}
