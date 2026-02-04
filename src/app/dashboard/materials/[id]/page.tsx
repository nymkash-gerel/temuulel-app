'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface MaterialOrder {
  id: string
  project_id: string
  supplier_name: string
  material_name: string | null
  quantity: number | null
  unit_cost: number | null
  order_date: string
  expected_delivery: string | null
  status: string
  total_cost: number
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ordered: { label: 'Захиалсан', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  shipped: { label: 'Илгээсэн', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  delivered: { label: 'Хүргэгдсэн', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const STATUS_FLOW = ['ordered', 'shipped', 'delivered']

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function MaterialOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const materialId = params.id as string

  const [material, setMaterial] = useState<MaterialOrder | null>(null)
  const [projectName, setProjectName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
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

      const res = await fetch(`/api/material-orders/${materialId}`)
      if (!res.ok) {
        router.push('/dashboard/materials')
        return
      }

      const data = await res.json()
      setMaterial(data)
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
  }, [materialId, supabase, router])

  async function handleStatusChange(newStatus: string) {
    if (!material) return
    setSaving(true)
    try {
      const res = await fetch(`/api/material-orders/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMaterial(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes() {
    if (!material) return
    setSaving(true)
    try {
      const res = await fetch(`/api/material-orders/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMaterial(updated)
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function getNextStatus(): string | null {
    if (!material) return null
    const idx = STATUS_FLOW.indexOf(material.status)
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

  if (!material) return null

  const sc = STATUS_CONFIG[material.status] || { label: material.status, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
  const nextStatus = getNextStatus()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/materials" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {material.material_name || material.supplier_name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              Материалын захиалга
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {material.status !== 'cancelled' && material.status !== 'delivered' && (
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={saving}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
            >
              Цуцлах
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
            <h3 className="text-white font-medium mb-4">Захиалгын явц</h3>
            <div className="flex items-center justify-between">
              {STATUS_FLOW.map((status, i) => {
                const config = STATUS_CONFIG[status]
                const currentIdx = STATUS_FLOW.indexOf(material.status)
                const isCompleted = i <= currentIdx && material.status !== 'cancelled'
                const isCurrent = status === material.status

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
            {material.status === 'cancelled' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-400 text-sm">Энэ захиалга цуцлагдсан байна</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Дэлгэрэнгүй мэдээлэл</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Нийлүүлэгч</p>
                <p className="text-white text-sm">{material.supplier_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Төсөл</p>
                <p className="text-white text-sm">{projectName || '-'}</p>
              </div>
              {material.material_name && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Материалын нэр</p>
                  <p className="text-white text-sm">{material.material_name}</p>
                </div>
              )}
              {material.quantity != null && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Тоо хэмжээ</p>
                  <p className="text-white text-sm">{material.quantity}</p>
                </div>
              )}
              {material.unit_cost != null && (
                <div>
                  <p className="text-xs text-slate-400 mb-1">Нэгж үнэ</p>
                  <p className="text-white text-sm">{formatPrice(material.unit_cost)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-1">Нийт зардал</p>
                <p className="text-white text-sm font-medium">{formatPrice(material.total_cost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Захиалсан огноо</p>
                <p className="text-white text-sm">
                  {new Date(material.order_date).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Хүлээгдэж буй огноо</p>
                <p className="text-white text-sm">
                  {material.expected_delivery
                    ? new Date(material.expected_delivery).toLocaleDateString('mn-MN', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Тэмдэглэл</h3>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-all"
                >
                  Засах
                </button>
              )}
            </div>
            {editing ? (
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
                    onClick={() => { setEditing(false); setNotes(material.notes || '') }}
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
                {material.notes || 'Тэмдэглэл байхгүй'}
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
                <span className="text-slate-400">Нийт зардал</span>
                <span className="text-white font-medium">{formatPrice(material.total_cost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Нийлүүлэгч</span>
                <span className="text-white">{material.supplier_name}</span>
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
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300">
                  {new Date(material.created_at).toLocaleDateString('mn-MN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">
                  {new Date(material.updated_at).toLocaleDateString('mn-MN', {
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
