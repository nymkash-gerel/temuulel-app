'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Permit {
  id: string
  project_id: string
  permit_type: string
  permit_number: string | null
  issuing_authority: string | null
  applied_date: string | null
  issued_date: string | null
  expiry_date: string | null
  cost: number | null
  status: string
  conditions: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  applied: { label: 'Хүсэлт гаргасан', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  under_review: { label: 'Хянагдаж буй', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  denied: { label: 'Татгалзсан', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  expired: { label: 'Хугацаа дууссан', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

const TYPE_LABELS: Record<string, string> = {
  building: 'Барилга',
  electrical: 'Цахилгаан',
  plumbing: 'Сантехник',
  demolition: 'Нураалт',
  environmental: 'Байгаль орчин',
  other: 'Бусад',
}

const STATUS_FLOW = ['applied', 'under_review', 'approved']

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function PermitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const permitId = params.id as string

  const [permit, setPermit] = useState<Permit | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editingConditions, setEditingConditions] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conditions, setConditions] = useState('')
  const [notes, setNotes] = useState('')

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

      const res = await fetch(`/api/permits/${permitId}`)
      if (!res.ok) {
        router.push('/dashboard/permits')
        return
      }

      const data = await res.json()
      setPermit(data)
      setConditions(data.conditions || '')
      setNotes(data.notes || '')

      // Fetch project name
      if (data.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', data.project_id)
          .single()
        if (project) setProjectName(project.name)
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitId])

  async function handleStatusChange(newStatus: string) {
    if (!permit) return
    setSaving(true)
    try {
      const res = await fetch(`/api/permits/${permitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPermit(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveConditions() {
    if (!permit) return
    setSaving(true)
    try {
      const res = await fetch(`/api/permits/${permitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions: conditions.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPermit(updated)
        setEditingConditions(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes() {
    if (!permit) return
    setSaving(true)
    try {
      const res = await fetch(`/api/permits/${permitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPermit(updated)
        setEditingNotes(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function getNextStatus(): string | null {
    if (!permit) return null
    const idx = STATUS_FLOW.indexOf(permit.status)
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null
    return STATUS_FLOW[idx + 1]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!permit) return null

  const sc = STATUS_CONFIG[permit.status] || { label: permit.status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  const typeLabel = TYPE_LABELS[permit.permit_type] || permit.permit_type
  const nextStatus = getNextStatus()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/permits" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                {permit.permit_number || 'Зөвшөөрөл'}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {typeLabel}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              Зөвшөөрлийн дэлгэрэнгүй
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {permit.status !== 'denied' && permit.status !== 'expired' && permit.status !== 'approved' && (
            <button
              onClick={() => handleStatusChange('denied')}
              disabled={saving}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
            >
              Татгалзсан
            </button>
          )}
          {permit.status === 'approved' && (
            <button
              onClick={() => handleStatusChange('expired')}
              disabled={saving}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-all disabled:opacity-50"
            >
              Хугацаа дууссан
            </button>
          )}
          {nextStatus && (
            <button
              onClick={() => handleStatusChange(nextStatus)}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {saving ? '...' : `${STATUS_CONFIG[nextStatus]?.label} болгох`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Зөвшөөрлийн явц</h3>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.map((status, i) => {
                const config = STATUS_CONFIG[status]
                const currentIdx = STATUS_FLOW.indexOf(permit.status)
                const isCompleted = i <= currentIdx && permit.status !== 'denied' && permit.status !== 'expired'
                const isCurrent = status === permit.status

                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        isCompleted
                          ? isCurrent ? 'bg-blue-500 ring-4 ring-blue-500/20 text-white' : 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        {isCompleted && !isCurrent ? '&#10003;' : i + 1}
                      </div>
                      <span className={`text-xs mt-2 ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                        {config.label}
                      </span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        i < currentIdx ? 'bg-emerald-500' : 'bg-slate-700'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            {permit.status === 'denied' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">Энэ зөвшөөрлийн хүсэлт татгалзагдсан байна</p>
              </div>
            )}
            {permit.status === 'expired' && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-400 text-sm">Энэ зөвшөөрлийн хугацаа дууссан байна</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Дэлгэрэнгүй мэдээлэл</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Төсөл</p>
                <p className="text-white text-sm">{projectName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Зөвшөөрлийн төрөл</p>
                <p className="text-white text-sm">{typeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Зөвшөөрлийн дугаар</p>
                <p className="text-white text-sm">{permit.permit_number || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Олгосон байгууллага</p>
                <p className="text-white text-sm">{permit.issuing_authority || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Хүсэлт гаргасан огноо</p>
                <p className="text-white text-sm">
                  {permit.applied_date
                    ? new Date(permit.applied_date).toLocaleDateString('mn-MN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Зөвшөөрсөн огноо</p>
                <p className="text-white text-sm">
                  {permit.issued_date
                    ? new Date(permit.issued_date).toLocaleDateString('mn-MN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Дуусах огноо</p>
                <p className="text-white text-sm">
                  {permit.expiry_date
                    ? new Date(permit.expiry_date).toLocaleDateString('mn-MN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Зардал</p>
                <p className="text-white text-sm">
                  {permit.cost != null ? formatPrice(permit.cost) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Нөхцөл / Шаардлага</h3>
              {!editingConditions && (
                <button
                  onClick={() => setEditingConditions(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-all"
                >
                  Засах
                </button>
              )}
            </div>
            {editingConditions ? (
              <div className="space-y-3">
                <textarea
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Зөвшөөрлийн нөхцөл, шаардлага..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setEditingConditions(false); setConditions(permit.conditions || '') }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSaveConditions}
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {permit.conditions || 'Нөхцөл оруулаагүй'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Тэмдэглэл</h3>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-all"
                >
                  Засах
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Тэмдэглэл оруулах..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setEditingNotes(false); setNotes(permit.notes || '') }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {permit.notes || 'Тэмдэглэл байхгүй'}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хураангуй</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Төлөв</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Төрөл</span>
                <span className="text-white">{typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Дугаар</span>
                <span className="text-white">{permit.permit_number || '-'}</span>
              </div>
              {permit.issuing_authority && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Байгууллага</span>
                  <span className="text-white text-right max-w-[150px] truncate" title={permit.issuing_authority}>
                    {permit.issuing_authority}
                  </span>
                </div>
              )}
              {permit.cost != null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Зардал</span>
                  <span className="text-white font-medium">{formatPrice(permit.cost)}</span>
                </div>
              )}
              {projectName && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Төсөл</span>
                  <span className="text-white">{projectName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Огноо</h3>
            <div className="space-y-3 text-sm">
              {permit.applied_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Хүсэлт</span>
                  <span className="text-slate-300">
                    {new Date(permit.applied_date).toLocaleDateString('mn-MN', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {permit.issued_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Олгосон</span>
                  <span className="text-slate-300">
                    {new Date(permit.issued_date).toLocaleDateString('mn-MN', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              {permit.expiry_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Дуусах</span>
                  <span className="text-slate-300">
                    {new Date(permit.expiry_date).toLocaleDateString('mn-MN', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300">
                  {new Date(permit.created_at).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">
                  {new Date(permit.updated_at).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
