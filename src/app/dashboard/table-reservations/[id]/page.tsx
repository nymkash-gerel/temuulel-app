'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface TableReservation {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  party_size: number
  table_layout_id: string | null
  reservation_date: string
  reservation_time: string | null
  duration_minutes: number | null
  status: string
  special_requests: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-gray-500/20 text-gray-400' },
  confirmed: { label: 'Баталгаажсан', color: 'bg-blue-500/20 text-blue-400' },
  seated: { label: 'Суусан', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Дууссан', color: 'bg-emerald-500/20 text-emerald-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
  no_show: { label: 'Ирээгүй', color: 'bg-orange-500/20 text-orange-400' },
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

export default function TableReservationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reservation, setReservation] = useState<TableReservation | null>(null)
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
      const res = await fetch(`/api/table-reservations/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/dashboard/table-reservations')
          return
        }
        throw new Error('Мэдээлэл ачааллахад алдаа гарлаа')
      }
      const data = await res.json()
      setReservation(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа')
    } finally {
      setLoading(false)
    }
  }

  function startEdit() {
    if (!reservation) return
    setEditData({
      customer_name: reservation.customer_name || '',
      customer_phone: reservation.customer_phone || '',
      party_size: reservation.party_size ?? '',
      status: reservation.status || '',
      special_requests: reservation.special_requests || '',
      notes: reservation.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!reservation) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        customer_name: reservation.customer_name || '',
        customer_phone: reservation.customer_phone || '',
        party_size: reservation.party_size ?? '',
        status: reservation.status || '',
        special_requests: reservation.special_requests || '',
        notes: reservation.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'party_size') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else {
            changes[key] = editData[key] || null
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/table-reservations/${id}`, {
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
        <Link href="/dashboard/table-reservations" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Захиалга олдсонгүй</p>
        <Link href="/dashboard/table-reservations" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const sc = STATUS_CONFIG[reservation.status] || { label: reservation.status, color: 'bg-slate-500/20 text-slate-400' }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/table-reservations"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Ширээний захиалга</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {reservation.customer_name || 'Нэргүй'} - {formatDate(reservation.reservation_date)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reservation Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Захиалгын мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Захиалагч</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.customer_name as string}
                  onChange={e => setEditData({ ...editData, customer_name: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{reservation.customer_name || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Утас</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.customer_phone as string}
                  onChange={e => setEditData({ ...editData, customer_phone: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{reservation.customer_phone || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Имэйл</p>
              <p className="text-white mt-1">{reservation.customer_email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Хүний тоо</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.party_size as string | number}
                  onChange={e => setEditData({ ...editData, party_size: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="1"
                />
              ) : (
                <p className="text-white mt-1">{reservation.party_size}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Огноо</p>
              <p className="text-white mt-1">{formatDate(reservation.reservation_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Цаг</p>
              <p className="text-white mt-1">{reservation.reservation_time || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Үргэлжлэх хугацаа (мин)</p>
              <p className="text-white mt-1">{reservation.duration_minutes ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Төлөв</p>
              {isEditing ? (
                <select
                  value={editData.status as string}
                  onChange={e => setEditData({ ...editData, status: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="pending">Хүлээгдэж буй</option>
                  <option value="confirmed">Баталгаажсан</option>
                  <option value="seated">Суусан</option>
                  <option value="completed">Дууссан</option>
                  <option value="cancelled">Цуцлагдсан</option>
                  <option value="no_show">Ирээгүй</option>
                </select>
              ) : (
                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Ширээний ID</p>
              <p className="text-white font-mono mt-1 text-sm">{reservation.table_layout_id || '-'}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Timestamps Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хугацаа</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Үүсгэсэн</span>
                <span className="text-slate-300">{formatDateTime(reservation.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Шинэчилсэн</span>
                <span className="text-slate-300">{formatDateTime(reservation.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Special Requests Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-3">Тусгай хүсэлт</h3>
        {isEditing ? (
          <textarea
            value={editData.special_requests as string}
            onChange={e => setEditData({ ...editData, special_requests: e.target.value })}
            className={`${inputClassName} min-h-[100px]`}
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {reservation.special_requests || 'Тусгай хүсэлт байхгүй'}
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
            {reservation.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(reservation.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(reservation.updated_at)}</span>
      </div>
    </div>
  )
}
