'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface CommissionDetail {
  id: string
  staff_id: string | null
  appointment_id: string | null
  sale_type: string | null
  sale_amount: number | null
  commission_rate: number | null
  commission_amount: number | null
  status: string
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  staff: { id: string; name: string } | null
  appointments: { id: string; scheduled_at: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-slate-500/20 text-slate-400' },
  approved: { label: 'Зөвшөөрсөн', color: 'bg-blue-500/20 text-blue-400' },
  paid: { label: 'Төлсөн', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцалсан', color: 'bg-red-500/20 text-red-400' },
}

const SALE_TYPE_LABELS: Record<string, string> = {
  service: 'Үйлчилгээ',
  product: 'Бүтээгдэхүүн',
  package: 'Багц',
  other: 'Бусад',
}

function formatPrice(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
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

function formatPercent(rate: number | null) {
  if (rate === null || rate === undefined) return '-'
  return (rate * 100).toFixed(1) + '%'
}

export default function CommissionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [commission, setCommission] = useState<CommissionDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/commissions/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/commissions')
          return
        }
        throw new Error('Мэдээлэл ачаалахад алдаа гарлаа')
      }
      const data = await res.json()
      setCommission(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!commission) return
    setEditData({
      status: commission.status || '',
      notes: commission.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!commission) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      if (editData.status !== commission.status) changes.status = editData.status
      if (editData.notes !== (commission.notes || '')) changes.notes = editData.notes || null

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/commissions/${id}`, {
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

  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">{error}</p>
        <Link href="/dashboard/commissions" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!commission) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Шимтгэлийн мэдээлэл олдсонгүй</p>
        <Link href="/dashboard/commissions" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[commission.status] || { label: commission.status, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/commissions"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Шимтгэл</h1>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="pending">Хүлээгдэж буй</option>
                  <option value="approved">Зөвшөөрсөн</option>
                  <option value="paid">Төлсөн</option>
                  <option value="cancelled">Цуцалсан</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
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
            <p className="text-slate-400 mt-1 text-sm font-mono">{commission.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Commission Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Шимтгэлийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Борлуулалтын төрөл</p>
              <p className="text-white mt-1">{SALE_TYPE_LABELS[commission.sale_type || ''] || commission.sale_type || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Борлуулалтын дүн</p>
              <p className="text-white mt-1">{formatPrice(commission.sale_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шимтгэлийн хувь</p>
              <p className="text-white mt-1">{formatPercent(commission.commission_rate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шимтгэлийн дүн</p>
              <p className="text-lg text-blue-400 font-medium mt-1">{formatPrice(commission.commission_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлөв</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлсөн огноо</p>
              <p className="text-white mt-1">{formatDateTime(commission.paid_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(commission.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(commission.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar: Staff + Appointment */}
        <div className="space-y-4">
          {/* Staff Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Ажилтан</h3>
            {commission.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {commission.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{commission.staff.name}</p>
                  <p className="text-slate-400 text-xs">{commission.staff_id?.slice(0, 8)}...</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Ажилтан тодорхойгүй</p>
            )}
          </div>

          {/* Appointment Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Цаг захиалга</h3>
            {commission.appointments ? (
              <div>
                <p className="text-white font-medium">{formatDateTime(commission.appointments.scheduled_at)}</p>
                <p className="text-slate-400 text-xs mt-1">{commission.appointment_id?.slice(0, 8)}...</p>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Цаг захиалга холбоогүй</p>
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
            {commission.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(commission.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(commission.updated_at)}</span>
      </div>
    </div>
  )
}
