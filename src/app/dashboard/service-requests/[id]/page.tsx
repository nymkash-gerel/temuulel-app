'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { serviceRequestTransitions } from '@/lib/status-machine'

interface ServiceRequest {
  id: string
  request_number: string
  service_type: string
  status: string
  priority: string
  address: string
  scheduled_at: string | null
  duration_estimate: number | null
  estimated_cost: number | null
  actual_cost: number | null
  notes: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  customers: { id: string; name: string | null } | null
  staff: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  assigned: { label: 'Хуваарилсан', color: 'bg-cyan-500/20 text-cyan-400' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-orange-500/20 text-orange-400' },
  completed: { label: 'Дууссан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  in_progress: 'Явагдаж байна',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Бага', color: 'bg-gray-500/20 text-gray-400' },
  medium: { label: 'Дунд', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'Өндөр', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Яаралтай', color: 'bg-red-500/20 text-red-400' },
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  cleaning: 'Цэвэрлэгээ',
  plumbing: 'Сантехник',
  electrical: 'Цахилгаан',
  painting: 'Будаг',
  carpentry: 'Мужаан',
  hvac: 'Агааржуулалт',
  landscaping: 'Тохижилт',
  moving: 'Зөөвөрлөлт',
  pest_control: 'Хортон шавьж устгал',
  general: 'Ерөнхий',
  other: 'Бусад',
}

const STATUS_FLOW = ['pending', 'confirmed', 'assigned', 'in_progress', 'completed']

const NEXT_STATUS_LABELS: Record<string, string> = {
  pending: 'Баталгаажуулах',
  confirmed: 'Хуваарилах',
  assigned: 'Эхлүүлэх',
  in_progress: 'Дуусгах',
}

function formatPrice(amount: number | null | undefined): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ServiceRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const requestId = params.id as string

  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  function startEdit() {
    if (!request) return
    setEditData({
      service_type: request.service_type,
      address: request.address || '',
      scheduled_at: request.scheduled_at ? request.scheduled_at.slice(0, 16) : '',
      duration_estimate: request.duration_estimate ?? '',
      priority: request.priority,
      estimated_cost: request.estimated_cost ?? '',
      actual_cost: request.actual_cost ?? '',
      notes: request.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!request) return
    const changed: Record<string, unknown> = {}
    const original: Record<string, unknown> = {
      service_type: request.service_type,
      address: request.address || '',
      scheduled_at: request.scheduled_at ? request.scheduled_at.slice(0, 16) : '',
      duration_estimate: request.duration_estimate ?? '',
      priority: request.priority,
      estimated_cost: request.estimated_cost ?? '',
      actual_cost: request.actual_cost ?? '',
      notes: request.notes || '',
    }

    for (const key of Object.keys(editData)) {
      if (String(editData[key]) !== String(original[key])) {
        let value = editData[key]
        if (key === 'scheduled_at' && value) {
          value = new Date(value as string).toISOString()
        }
        if (key === 'duration_estimate' || key === 'estimated_cost' || key === 'actual_cost') {
          value = value === '' || value === null || value === undefined ? null : Number(value)
        }
        changed[key] = value
      }
    }

    if (Object.keys(changed).length === 0) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/service-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Хадгалахад алдаа гарлаа')
      }
      setIsEditing(false)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/login'); return }

    const { data } = await supabase
      .from('service_requests')
      .select(`
        *,
        customers(id, name),
        staff(id, name)
      `)
      .eq('id', requestId)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/service-requests')
      return
    }

    setRequest(data as unknown as ServiceRequest)
    setLoading(false)
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!request) return null

  const sc = STATUS_CONFIG[request.status] || { label: request.status, color: 'bg-slate-500/20 text-slate-400' }
  const pc = PRIORITY_CONFIG[request.priority] || { label: request.priority, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/service-requests"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                Үйлчилгээний хүсэлт
              </h1>
              <span className="text-slate-400 font-mono text-lg">#{request.request_number}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pc.color}`}>
                {pc.label}
              </span>
              <span className="text-slate-500 text-sm">
                {formatDateTime(request.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              onClick={startEdit}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Засах
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </>
          )}
          <StatusActions
            currentStatus={request.status}
            transitions={serviceRequestTransitions}
            statusLabels={STATUS_LABELS}
            apiPath={`/api/service-requests/${requestId}`}
            onSuccess={load}
          />
        </div>
      </div>

      {/* Status Flow Bar */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((step, i) => {
            const config = STATUS_CONFIG[step]
            const currentIdx = STATUS_FLOW.indexOf(request.status)
            const isPast = currentIdx >= 0 && i < currentIdx
            const isCurrent = step === request.status
            const isCompleted = isPast || (request.status === 'completed' && i <= STATUS_FLOW.indexOf('completed'))

            return (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex-1 py-2 text-center text-xs font-medium rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-slate-700/50 text-slate-500'
                  }`}
                >
                  {config.label}
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isCompleted ? '#22c55e' : '#475569'}
                    strokeWidth="2"
                    className="shrink-0 mx-0.5"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
        {request.status === 'cancelled' && (
          <div className="mt-3 text-center">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400">
              Цуцлагдсан
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Info Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хүсэлтийн мэдээлэл</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Хүсэлтийн дугаар</p>
                <p className="text-white text-sm font-mono mt-0.5">#{request.request_number}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Үйлчилгээний төрөл</p>
                {isEditing ? (
                  <select
                    value={editData.service_type as string}
                    onChange={(e) => setEditData({ ...editData, service_type: e.target.value })}
                    className={inputClassName + ' mt-0.5'}
                  >
                    {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-white text-sm mt-0.5">
                    {SERVICE_TYPE_LABELS[request.service_type] || request.service_type}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Төлөв</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-0.5 ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Зэрэглэл</p>
                {isEditing ? (
                  <select
                    value={editData.priority as string}
                    onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                    className={inputClassName + ' mt-0.5'}
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-0.5 ${pc.color}`}>
                    {pc.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Location Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Байршил</h3>
            <div>
              <p className="text-xs text-slate-500 mb-1">Хаяг</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.address as string}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  className={inputClassName}
                />
              ) : (
                <p className="text-slate-300 text-sm">{request.address || '-'}</p>
              )}
            </div>
          </div>

          {/* Financial Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Төлбөр</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Төсөвт зардал</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.estimated_cost as string | number}
                    onChange={(e) => setEditData({ ...editData, estimated_cost: e.target.value })}
                    className={inputClassName + ' mt-0.5'}
                    placeholder="0"
                  />
                ) : (
                  <p className="text-lg text-white font-medium">{formatPrice(request.estimated_cost)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Бодит зардал</p>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.actual_cost as string | number}
                    onChange={(e) => setEditData({ ...editData, actual_cost: e.target.value })}
                    className={inputClassName + ' mt-0.5'}
                    placeholder="0"
                  />
                ) : (
                  <p className={`text-lg font-medium ${
                    request.actual_cost != null ? 'text-white' : 'text-slate-500'
                  }`}>
                    {formatPrice(request.actual_cost)}
                  </p>
                )}
              </div>
            </div>
            {request.estimated_cost != null && request.actual_cost != null && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Зөрүү</span>
                  <span className={`font-medium ${
                    request.actual_cost > request.estimated_cost
                      ? 'text-red-400'
                      : request.actual_cost < request.estimated_cost
                        ? 'text-green-400'
                        : 'text-slate-300'
                  }`}>
                    {request.actual_cost - request.estimated_cost > 0 ? '+' : ''}
                    {formatPrice(request.actual_cost - request.estimated_cost)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notes Card */}
          {(request.notes || isEditing) && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
              {isEditing ? (
                <textarea
                  value={editData.notes as string}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={4}
                  className={inputClassName}
                  placeholder="Тэмдэглэл..."
                />
              ) : (
                <p className="text-slate-300 text-sm whitespace-pre-wrap">{request.notes}</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Захиалагч</h3>
            {request.customers ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {request.customers.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{request.customers.name || 'Нэргүй'}</p>
                  </div>
                </div>
                <Link
                  href={`/dashboard/customers/${request.customers.id}`}
                  className="block w-full py-2 text-center text-sm text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-lg transition-all"
                >
                  Дэлгэрэнгүй
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Захиалагч сонгоогүй</p>
            )}
          </div>

          {/* Technician Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Техникч</h3>
            {request.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {request.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{request.staff.name}</p>
                  <p className="text-slate-400 text-xs">Техникч</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Техникч оноогүй</p>
            )}
          </div>

          {/* Schedule Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хугацаа</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Товлосон огноо</span>
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={editData.scheduled_at as string}
                    onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                    className={inputClassName + ' w-auto'}
                  />
                ) : (
                  <span className="text-white">{formatDateTime(request.scheduled_at)}</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Хугацаа (минут)</span>
                {isEditing ? (
                  <input
                    type="number"
                    value={editData.duration_estimate as string | number}
                    onChange={(e) => setEditData({ ...editData, duration_estimate: e.target.value })}
                    className={inputClassName + ' w-24 text-right'}
                    placeholder="0"
                  />
                ) : (
                  <span className="text-white">
                    {request.duration_estimate != null ? `${request.duration_estimate} мин` : '-'}
                  </span>
                )}
              </div>
              {request.completed_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Дууссан</span>
                  <span className="text-green-400">{formatDateTime(request.completed_at)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-700">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300 text-xs">{formatDateTime(request.created_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Шинэчлэгдсэн</span>
                <span className="text-slate-300 text-xs">{formatDateTime(request.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
