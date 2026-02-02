'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ProductionBatch {
  id: string
  product_id: string | null
  production_date: string
  target_qty: number
  produced_qty: number
  cost_per_unit: number | null
  expiry_date: string | null
  status: string
  assigned_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  planned: 'Төлөвлөсөн',
  in_progress: 'Үйлдвэрлэж буй',
  completed: 'Дууссан',
  cancelled: 'Цуцлагдсан',
  on_hold: 'Түр зогссон',
}

const STATUS_PIPELINE = ['planned', 'in_progress', 'completed']

function formatCurrency(amount: number | null): string {
  if (amount == null) return '-'
  return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 }).format(amount)
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

function getProgressColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 75) return 'bg-blue-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-orange-500'
}

export default function ProductionBatchDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [batch, setBatch] = useState<ProductionBatch | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [producedQtyInput, setProducedQtyInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBatch()
  }, [id])

  async function loadBatch() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/production-batches/' + id)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/production')
          return
        }
        throw new Error('Failed to fetch production batch')
      }
      const data = await res.json()
      setBatch(data)
      setNotes(data.notes || '')
      setProducedQtyInput(String(data.produced_qty || 0))
    } catch {
      setError('Үйлдвэрлэлийн багцын мэдээлэл ачаалахад алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  async function updateBatch(updates: Record<string, unknown>) {
    if (!batch) return
    setUpdating(true)
    setError(null)

    try {
      const res = await fetch('/api/production-batches/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        throw new Error('Failed to update')
      }

      const data = await res.json()
      setBatch(data)
      setNotes(data.notes || '')
      setProducedQtyInput(String(data.produced_qty || 0))
    } catch {
      setError('Шинэчлэхэд алдаа гарлаа')
    } finally {
      setUpdating(false)
    }
  }

  async function updateStatus(newStatus: string) {
    await updateBatch({ status: newStatus })
  }

  async function saveNotes() {
    await updateBatch({ notes })
    setEditing(false)
  }

  async function updateProducedQty() {
    const qty = parseInt(producedQtyInput, 10)
    if (isNaN(qty) || qty < 0) {
      setError('Зөв тоо оруулна уу')
      return
    }
    await updateBatch({ produced_qty: qty })
  }

  function getNextStatus(): string | null {
    if (!batch) return null
    const idx = STATUS_PIPELINE.indexOf(batch.status)
    if (idx === -1 || idx >= STATUS_PIPELINE.length - 1) return null
    return STATUS_PIPELINE[idx + 1]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!batch) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Үйлдвэрлэлийн багц олдсонгүй</p>
        <Link href="/dashboard/production" className="mt-4 text-blue-400 hover:underline inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_COLORS[batch.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  const nextStatus = getNextStatus()
  const progressPct = batch.target_qty > 0
    ? Math.min(Math.round((batch.produced_qty / batch.target_qty) * 100), 100)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/production"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">
                Багц #{batch.id.slice(0, 8)}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusCfg}`}>
                {STATUS_LABELS[batch.status] || batch.status}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {formatDate(batch.production_date)}
              {batch.assigned_to && ` | ${batch.assigned_to}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all"
          >
            {editing ? 'Болих' : 'Засах'}
          </button>
          {nextStatus && (
            <button
              onClick={() => updateStatus(nextStatus)}
              disabled={updating}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              {updating ? '...' : `${STATUS_LABELS[nextStatus]} болгох`}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Status Pipeline */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">Явцын шат</h3>
        <div className="flex items-center justify-between overflow-x-auto">
          {STATUS_PIPELINE.map((status, i) => {
            const currentIdx = STATUS_PIPELINE.indexOf(batch.status)
            const isCancelled = batch.status === 'cancelled'
            const isCompleted = !isCancelled && i <= currentIdx
            const isCurrent = status === batch.status

            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? isCurrent ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-emerald-500'
                      : 'bg-slate-700'
                  }`}>
                    <span className="text-white">
                      {isCompleted ? (isCurrent ? (i + 1) : '✓') : (i + 1)}
                    </span>
                  </div>
                  <span className={`text-xs mt-2 text-center whitespace-nowrap ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>
                {i < STATUS_PIPELINE.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    !isCancelled && i < currentIdx ? 'bg-emerald-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Үйлдвэрлэлийн ахиц</h3>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">
                  {batch.produced_qty} / {batch.target_qty} ширхэг
                </span>
                <span className={`text-sm font-medium ${
                  progressPct >= 100 ? 'text-green-400' :
                  progressPct >= 75 ? 'text-blue-400' :
                  progressPct >= 50 ? 'text-yellow-400' : 'text-orange-400'
                }`}>
                  {progressPct}%
                </span>
              </div>
              <div className="w-full h-4 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getProgressColor(progressPct)} transition-all duration-500`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Progress Update Input */}
            {(batch.status === 'in_progress' || batch.status === 'planned') && (
              <div className="pt-4 border-t border-slate-700">
                <label className="block text-sm text-slate-400 mb-2">Үйлдвэрлэсэн тоо шинэчлэх</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={producedQtyInput}
                    onChange={(e) => setProducedQtyInput(e.target.value)}
                    min="0"
                    max={batch.target_qty}
                    className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="Тоо оруулах"
                  />
                  <button
                    onClick={updateProducedQty}
                    disabled={updating}
                    className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {updating ? '...' : 'Шинэчлэх'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Багцын мэдээлэл</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Үйлдвэрлэх огноо</span>
                <p className="text-white mt-1">{formatDate(batch.production_date)}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Зорилтот тоо хэмжээ</span>
                <p className="text-white mt-1">{batch.target_qty} ширхэг</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Үйлдвэрлэсэн тоо</span>
                <p className="text-white mt-1">{batch.produced_qty} ширхэг</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Нэгжийн өртөг</span>
                <p className="text-white mt-1">{formatCurrency(batch.cost_per_unit)}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Дуусах хугацаа</span>
                <p className="text-white mt-1">
                  {batch.expiry_date ? formatDate(batch.expiry_date) : '-'}
                </p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Нийт өртөг</span>
                <p className="text-white mt-1 font-medium">
                  {batch.cost_per_unit != null
                    ? formatCurrency(batch.cost_per_unit * batch.produced_qty)
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
            {editing ? (
              <div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Тэмдэглэл оруулах..."
                />
                <button
                  onClick={saveNotes}
                  disabled={updating}
                  className="mt-3 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {updating ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {batch.notes || 'Тэмдэглэл байхгүй'}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хураангуй</h3>
            <div className="space-y-4">
              <div className="text-center p-4 bg-slate-700/30 rounded-xl">
                <p className="text-slate-400 text-sm mb-1">Ахиц</p>
                <p className={`text-3xl font-bold ${
                  progressPct >= 100 ? 'text-green-400' :
                  progressPct >= 75 ? 'text-blue-400' :
                  progressPct >= 50 ? 'text-yellow-400' : 'text-orange-400'
                }`}>
                  {progressPct}%
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Зорилт</span>
                <span className="text-white font-medium">{batch.target_qty}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Үйлдвэрлэсэн</span>
                <span className="text-white font-medium">{batch.produced_qty}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Үлдэгдэл</span>
                <span className="text-white font-medium">
                  {Math.max(0, batch.target_qty - batch.produced_qty)}
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Staff */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хариуцсан ажилтан</h3>
            {batch.assigned_to ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {batch.assigned_to.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-white font-medium">{batch.assigned_to}</span>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Хариуцагч томилогдоогүй</p>
            )}
          </div>

          {/* Expiry Warning */}
          {batch.expiry_date && (
            <div className={`border rounded-2xl p-6 ${
              new Date(batch.expiry_date) < new Date()
                ? 'bg-red-500/10 border-red-500/30'
                : new Date(batch.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-slate-800/50 border-slate-700'
            }`}>
              <h3 className="text-white font-medium mb-2">Дуусах хугацаа</h3>
              <p className={`text-lg font-bold ${
                new Date(batch.expiry_date) < new Date()
                  ? 'text-red-400'
                  : new Date(batch.expiry_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    ? 'text-yellow-400'
                    : 'text-white'
              }`}>
                {formatDate(batch.expiry_date)}
              </p>
              {new Date(batch.expiry_date) < new Date() && (
                <p className="text-red-400 text-sm mt-1">Хугацаа дууссан</p>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Огноо</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(batch.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(batch.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
