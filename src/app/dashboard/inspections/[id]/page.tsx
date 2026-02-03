'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Inspection {
  id: string
  project_id: string
  inspection_type: string
  inspector_name: string
  scheduled_date: string
  completed_date: string | null
  status: string
  result: string
  findings: string | null
  required_corrections: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Товлосон', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  in_progress: { label: 'Явагдаж буй', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  passed: { label: 'Тэнцсэн', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  failed: { label: 'Тэнцээгүй', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  pass: { label: 'Тэнцсэн', color: 'bg-green-500/20 text-green-400' },
  fail: { label: 'Тэнцээгүй', color: 'bg-red-500/20 text-red-400' },
  partial: { label: 'Хэсэгчилсэн', color: 'bg-yellow-500/20 text-yellow-400' },
}

const TYPE_LABELS: Record<string, string> = {
  structural: 'Бүтцийн',
  electrical: 'Цахилгаан',
  plumbing: 'Сантехник',
  fire: 'Галын аюулгүй байдал',
  final: 'Эцсийн',
  other: 'Бусад',
}

const STATUS_FLOW = ['scheduled', 'in_progress', 'passed']

export default function InspectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const inspectionId = params.id as string

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editingFindings, setEditingFindings] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [findings, setFindings] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!store) { router.push('/dashboard'); return }

    const res = await fetch(`/api/inspections/${inspectionId}`)
    if (!res.ok) {
      router.push('/dashboard/inspections')
      return
    }

    const data = await res.json()
    setInspection(data)
    setFindings(data.findings || data.required_corrections || '')
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
  }, [supabase, router, inspectionId])

  useEffect(() => {
    load()
  }, [load])

  async function handleStatusChange(newStatus: string) {
    if (!inspection) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInspection(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFindings() {
    if (!inspection) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required_corrections: findings.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInspection(updated)
        setEditingFindings(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes() {
    if (!inspection) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInspection(updated)
        setEditingNotes(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function getNextStatus(): string | null {
    if (!inspection) return null
    const idx = STATUS_FLOW.indexOf(inspection.status)
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

  if (!inspection) return null

  const sc = STATUS_CONFIG[inspection.status] || { label: inspection.status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  const rc = RESULT_CONFIG[inspection.result] || { label: inspection.result, color: 'bg-slate-500/20 text-slate-400' }
  const typeLabel = TYPE_LABELS[inspection.inspection_type] || inspection.inspection_type
  const nextStatus = getNextStatus()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/inspections" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">Шалгалт</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {typeLabel}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {inspection.inspector_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {inspection.status !== 'cancelled' && inspection.status !== 'passed' && inspection.status !== 'failed' && (
            <>
              <button
                onClick={() => handleStatusChange('failed')}
                disabled={saving}
                className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                Тэнцээгүй
              </button>
              <button
                onClick={() => handleStatusChange('cancelled')}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                Цуцлах
              </button>
            </>
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
            <h3 className="text-white font-medium mb-4">Шалгалтын явц</h3>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.map((status, i) => {
                const config = STATUS_CONFIG[status]
                const currentIdx = STATUS_FLOW.indexOf(inspection.status)
                const isCompleted = i <= currentIdx && inspection.status !== 'cancelled' && inspection.status !== 'failed'
                const isCurrent = status === inspection.status

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
            {inspection.status === 'cancelled' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">Энэ шалгалт цуцлагдсан байна</p>
              </div>
            )}
            {inspection.status === 'failed' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">Энэ шалгалт тэнцээгүй</p>
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
                <p className="text-xs text-slate-400 mb-1">Шалгагчийн нэр</p>
                <p className="text-white text-sm">{inspection.inspector_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Шалгалтын төрөл</p>
                <p className="text-white text-sm">{typeLabel}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Үр дүн</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>
                  {rc.label}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Товлосон огноо</p>
                <p className="text-white text-sm">
                  {new Date(inspection.scheduled_date).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Дууссан огноо</p>
                <p className="text-white text-sm">
                  {inspection.completed_date
                    ? new Date(inspection.completed_date).toLocaleDateString('mn-MN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Findings / Required Corrections */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Засах шаардлага / Дүгнэлт</h3>
              {!editingFindings && (
                <button
                  onClick={() => setEditingFindings(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-all"
                >
                  Засах
                </button>
              )}
            </div>
            {editingFindings ? (
              <div className="space-y-3">
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Шалгалтын дүгнэлт, засах шаардлага..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setEditingFindings(false); setFindings(inspection.findings || inspection.required_corrections || '') }}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Болих
                  </button>
                  <button
                    onClick={handleSaveFindings}
                    disabled={saving}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {inspection.findings || inspection.required_corrections || 'Дүгнэлт оруулаагүй'}
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
                    onClick={() => { setEditingNotes(false); setNotes(inspection.notes || '') }}
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
                {inspection.notes || 'Тэмдэглэл байхгүй'}
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
                <span className="text-slate-400">Үр дүн</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rc.color}`}>
                  {rc.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Төрөл</span>
                <span className="text-white">{typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шалгагч</span>
                <span className="text-white">{inspection.inspector_name}</span>
              </div>
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
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Товлосон</span>
                <span className="text-slate-300">
                  {new Date(inspection.scheduled_date).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </span>
              </div>
              {inspection.completed_date && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Дууссан</span>
                  <span className="text-slate-300">
                    {new Date(inspection.completed_date).toLocaleDateString('mn-MN', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300">
                  {new Date(inspection.created_at).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">
                  {new Date(inspection.updated_at).toLocaleDateString('mn-MN', {
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
