'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StatusActions from '@/components/ui/StatusActions'
import { treatmentPlanTransitions } from '@/lib/status-machine'

interface Customer {
  id: string
  name: string | null
}

interface TreatmentPlan {
  id: string
  customer_id: string | null
  name: string
  description: string | null
  sessions_total: number
  sessions_used: number
  start_date: string | null
  end_date: string | null
  status: string
  created_at: string
  updated_at: string
  customers: Customer | null
}

interface TreatmentSession {
  id: string
  treatment_plan_id: string
  appointment_id: string | null
  session_number: number
  status: string
  notes: string | null
  results: string | null
  performed_at: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Дууссан', color: 'bg-blue-500/20 text-blue-400' },
  paused: { label: 'Түр зогссон', color: 'bg-yellow-500/20 text-yellow-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Ноорог',
  active: 'Идэвхтэй',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
}

const SESSION_STATUS: Record<string, string> = {
  scheduled: 'Товлосон',
  completed: 'Дууссан',
  missed: 'Тасалсан',
  cancelled: 'Цуцлагдсан',
}

const SESSION_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400',
  completed: 'bg-green-500/20 text-green-400',
  missed: 'bg-orange-500/20 text-orange-400',
  cancelled: 'bg-red-500/20 text-red-400',
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

export default function TreatmentPlanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<TreatmentPlan | null>(null)
  const [sessions, setSessions] = useState<TreatmentSession[]>([])
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

    if (!store) { setLoading(false); return }

    const { data: planData } = await supabase
      .from('treatment_plans')
      .select(`
        id, customer_id, name, description, sessions_total, sessions_used,
        start_date, end_date, status, created_at, updated_at,
        customers(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    setPlan(planData as unknown as TreatmentPlan)

    if (planData) {
      const { data: sessionsData } = await supabase
        .from('treatment_sessions')
        .select('id, treatment_plan_id, appointment_id, session_number, status, notes, results, performed_at, created_at')
        .eq('treatment_plan_id', id)
        .order('session_number', { ascending: true })

      setSessions((sessionsData as unknown as TreatmentSession[]) || [])
    }

    setLoading(false)
  }, [supabase, router, id])

  useEffect(() => {
    load()
  }, [load])


  function startEdit() {
    if (!plan) return
    setEditData({
      name: plan.name,
      description: plan.description || '',
      sessions_total: plan.sessions_total,
      sessions_used: plan.sessions_used,
      start_date: plan.start_date ? plan.start_date.slice(0, 10) : '',
      end_date: plan.end_date ? plan.end_date.slice(0, 10) : '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!plan) return
    setSaving(true)
    try {
      const changed: Record<string, unknown> = {}
      if (editData.name !== plan.name) changed.name = editData.name
      if (editData.description !== (plan.description || '')) changed.description = editData.description
      if (Number(editData.sessions_total) !== plan.sessions_total) changed.sessions_total = Number(editData.sessions_total)
      if (Number(editData.sessions_used) !== plan.sessions_used) changed.sessions_used = Number(editData.sessions_used)
      const startVal = plan.start_date ? plan.start_date.slice(0, 10) : ''
      if (editData.start_date !== startVal) changed.start_date = editData.start_date || null
      const endVal = plan.end_date ? plan.end_date.slice(0, 10) : ''
      if (editData.end_date !== endVal) changed.end_date = editData.end_date || null

      if (Object.keys(changed).length > 0) {
        const res = await fetch(`/api/treatment-plans/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changed),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Хадгалахад алдаа гарлаа')
        }
      }
      setIsEditing(false)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Хадгалахад алдаа гарлаа')
    } finally {
      setSaving(false)
    }
  }

  function getProgressPercent(used: number, total: number): number {
    if (!total || total <= 0) return 0
    return Math.min(Math.round((used / total) * 100), 100)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="h-64 bg-slate-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Эмчилгээний төлөвлөгөө олдсонгүй.</p>
        <button
          onClick={() => router.push('/dashboard/treatment-plans')}
          className="mt-4 text-blue-400 hover:underline"
        >
          Буцах
        </button>
      </div>
    )
  }

  const editInputClass = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const statusCfg = STATUS_CONFIG[plan.status] || { label: plan.status, color: 'bg-slate-500/20 text-slate-400' }
  const progressPercent = getProgressPercent(plan.sessions_used, plan.sessions_total)

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/treatment-plans')}
          className="text-slate-400 hover:text-white transition-colors"
        >
          &larr; Буцах
        </button>
        <h1 className="text-2xl font-bold text-white">Эмчилгээний төлөвлөгөө</h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <StatusActions
          currentStatus={plan.status}
          transitions={treatmentPlanTransitions}
          statusLabels={STATUS_LABELS}
          apiPath={`/api/treatment-plans/${id}`}
          onSuccess={load}
        />
        {!isEditing ? (
          <button
            onClick={startEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Засах
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Болих
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plan Info Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Төлөвлөгөөний мэдээлэл</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.name as string}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className={editInputClass}
                />
              ) : (
                <p className="text-white font-medium">{plan.name}</p>
              )}
            </div>
            <div>
              <span className="text-sm text-slate-400">Төлөв</span>
              <p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </p>
            </div>
            {(plan.description || isEditing) && (
              <div>
                <span className="text-sm text-slate-400">Тайлбар</span>
                {isEditing ? (
                  <textarea
                    value={editData.description as string}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className={editInputClass}
                  />
                ) : (
                  <p className="text-slate-300 whitespace-pre-wrap">{plan.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Client Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Үйлчлүүлэгч</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Нэр</span>
              <p className="text-white">
                {plan.customers ? (plan.customers.name || 'Нэргүй') : 'Тодорхойгүй'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Явц</h2>
          <div className="space-y-3">
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-slate-400">Нийт сесс</span>
                  <input
                    type="number"
                    value={editData.sessions_total as number}
                    onChange={(e) => setEditData({ ...editData, sessions_total: e.target.value })}
                    className={editInputClass}
                  />
                </div>
                <div>
                  <span className="text-sm text-slate-400">Хийсэн сесс</span>
                  <input
                    type="number"
                    value={editData.sessions_used as number}
                    onChange={(e) => setEditData({ ...editData, sessions_used: e.target.value })}
                    className={editInputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Сесс</span>
                <span className="text-white font-medium">
                  {plan.sessions_used} / {plan.sessions_total}
                </span>
              </div>
            )}
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-right">
              <span className="text-sm text-slate-400">{progressPercent}%</span>
            </div>
            <div>
              <span className="text-sm text-slate-400">Үлдсэн сесс</span>
              <p className="text-white font-medium">
                {Math.max(0, plan.sessions_total - plan.sessions_used)}
              </p>
            </div>
          </div>
        </div>

        {/* Schedule Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">Хугацаа</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-400">Эхлэх огноо</span>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.start_date as string}
                  onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                  className={editInputClass}
                />
              ) : (
                <p className="text-white">
                  {plan.start_date ? formatDate(plan.start_date) : '-'}
                </p>
              )}
            </div>
            <div>
              <span className="text-sm text-slate-400">Дуусах огноо</span>
              {isEditing ? (
                <input
                  type="date"
                  value={editData.end_date as string}
                  onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                  className={editInputClass}
                />
              ) : (
                <p className="text-white">
                  {plan.end_date ? formatDate(plan.end_date) : '-'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Үе шатууд</h2>
        {sessions.length > 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    #
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Төлөв
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Хийсэн огноо
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Тэмдэглэл
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                    Үр дүн
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const sessionStatusColor =
                    SESSION_STATUS_COLORS[session.status] || 'bg-slate-500/20 text-slate-400'
                  const sessionStatusLabel =
                    SESSION_STATUS[session.status] || session.status
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all"
                    >
                      <td className="py-3 px-4">
                        <span className="text-white font-medium">
                          {session.session_number}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${sessionStatusColor}`}
                        >
                          {sessionStatusLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {session.performed_at
                            ? formatDateTime(session.performed_at)
                            : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {session.notes || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 text-sm">
                          {session.results || '-'}
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
            <p className="text-slate-400">Үе шат бүртгэгдээгүй байна.</p>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-6 text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(plan.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(plan.updated_at)}</span>
      </div>
    </div>
  )
}
