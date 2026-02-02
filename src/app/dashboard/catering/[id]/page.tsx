'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface CateringOrder {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  serving_date: string
  serving_time: string | null
  location_type: string | null
  address_text: string | null
  guest_count: number
  status: string
  quoted_amount: number | null
  final_amount: number | null
  logistics_notes: string | null
  equipment_needed: unknown
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  preparing: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dispatched: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  served: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  inquiry: 'Лавлагаа',
  confirmed: 'Баталгаажсан',
  preparing: 'Бэлтгэж буй',
  dispatched: 'Илгээсэн',
  served: 'Зөөгдсөн',
  closed: 'Хаагдсан',
  cancelled: 'Цуцлагдсан',
}

const STATUS_PIPELINE = ['inquiry', 'confirmed', 'preparing', 'dispatched', 'served', 'closed']

const LOCATION_TYPE_LABELS: Record<string, string> = {
  on_site: 'Байранд',
  off_site: 'Гадуур',
  delivery: 'Хүргэлтээр',
}

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

export default function CateringOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<CateringOrder | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [logisticsNotes, setLogisticsNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadOrder() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/catering-orders/' + id)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/catering')
          return
        }
        throw new Error('Failed to fetch catering order')
      }
      const data = await res.json()
      setOrder(data)
      setLogisticsNotes(data.logistics_notes || '')
    } catch {
      setError('Кейтеринг захиалгын мэдээлэл ачаалахад алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  async function updateOrder(updates: Record<string, unknown>) {
    if (!order) return
    setUpdating(true)
    setError(null)

    try {
      const res = await fetch('/api/catering-orders/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        throw new Error('Failed to update')
      }

      const data = await res.json()
      setOrder(data)
      setLogisticsNotes(data.logistics_notes || '')
    } catch {
      setError('Шинэчлэхэд алдаа гарлаа')
    } finally {
      setUpdating(false)
    }
  }

  async function updateStatus(newStatus: string) {
    await updateOrder({ status: newStatus })
  }

  async function saveLogisticsNotes() {
    await updateOrder({ logistics_notes: logisticsNotes })
    setEditing(false)
  }

  function getNextStatus(): string | null {
    if (!order) return null
    const idx = STATUS_PIPELINE.indexOf(order.status)
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

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-400">Кейтеринг захиалга олдсонгүй</p>
        <Link href="/dashboard/catering" className="mt-4 text-blue-400 hover:underline inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_COLORS[order.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  const nextStatus = getNextStatus()
  const equipmentNeeded = order.equipment_needed as string[] | null

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/catering"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{order.customer_name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusCfg}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {formatDate(order.serving_date)} | {order.guest_count} зочин
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
          {order.status !== 'cancelled' && order.status !== 'closed' && (
            <button
              onClick={() => {
                if (confirm('Кейтеринг захиалга цуцлах уу?')) updateStatus('cancelled')
              }}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all"
            >
              Цуцлах
            </button>
          )}
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
            const currentIdx = STATUS_PIPELINE.indexOf(order.status)
            const isCancelled = order.status === 'cancelled'
            const isCompleted = !isCancelled && i <= currentIdx
            const isCurrent = status === order.status

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
        {order.status === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">Энэ кейтеринг захиалга цуцлагдсан байна</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Grid */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Захиалгын мэдээлэл</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-400">Зөөглөх огноо</span>
                <p className="text-white mt-1">{formatDate(order.serving_date)}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Зөөглөх цаг</span>
                <p className="text-white mt-1">{order.serving_time || '-'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Байршлын төрөл</span>
                <p className="text-white mt-1">
                  {order.location_type ? (LOCATION_TYPE_LABELS[order.location_type] || order.location_type) : '-'}
                </p>
              </div>
              <div>
                <span className="text-sm text-slate-400">Зочдын тоо</span>
                <p className="text-white mt-1">{order.guest_count}</p>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-slate-400">Хаяг</span>
                <p className="text-white mt-1">{order.address_text || '-'}</p>
              </div>
            </div>
          </div>

          {/* Financial Section */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Санхүүгийн мэдээлэл</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Санал болгосон дүн</span>
                <span className="text-white font-medium">{formatCurrency(order.quoted_amount)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                <span className="text-slate-400 text-sm">Эцсийн дүн</span>
                <span className="text-white text-lg font-bold">{formatCurrency(order.final_amount)}</span>
              </div>
            </div>
          </div>

          {/* Equipment Needed */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Шаардлагатай тоног төхөөрөмж</h3>
            {equipmentNeeded && Array.isArray(equipmentNeeded) && equipmentNeeded.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {equipmentNeeded.map((item, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm"
                  >
                    {typeof item === 'string' ? item : JSON.stringify(item)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Тоног төхөөрөмж оруулаагүй</p>
            )}
          </div>

          {/* Logistics Notes */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Ложистикийн тэмдэглэл</h3>
            {editing ? (
              <div>
                <textarea
                  value={logisticsNotes}
                  onChange={(e) => setLogisticsNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none transition-all"
                  placeholder="Ложистикийн тэмдэглэл оруулах..."
                />
                <button
                  onClick={saveLogisticsNotes}
                  disabled={updating}
                  className="mt-3 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {updating ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
              </div>
            ) : (
              <p className="text-slate-300 text-sm whitespace-pre-wrap">
                {order.logistics_notes || 'Тэмдэглэл байхгүй'}
              </p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Харилцагч</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {order.customer_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{order.customer_name}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {order.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Утас</span>
                  <span className="text-slate-300">{order.customer_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Хураангуй</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Зочдын тоо</span>
                <span className="text-white font-medium">{order.guest_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Байршил</span>
                <span className="text-white text-sm capitalize">
                  {order.location_type ? (LOCATION_TYPE_LABELS[order.location_type] || order.location_type) : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Тоног төхөөрөмж</span>
                <span className="text-white text-sm">
                  {equipmentNeeded && Array.isArray(equipmentNeeded) ? equipmentNeeded.length + ' ширхэг' : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-medium mb-4">Огноо</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(order.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(order.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
