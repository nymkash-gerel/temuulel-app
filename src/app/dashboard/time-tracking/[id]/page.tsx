'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TimeEntryDetail {
  id: string
  case_id: string | null
  staff_id: string | null
  description: string | null
  hours: number | null
  rate: number | null
  amount: number | null
  billable: boolean
  billed: boolean
  entry_date: string | null
  start_time: string | null
  end_time: string | null
  activity_type: string | null
  notes: string | null
  created_at: string
  updated_at: string
  legal_cases: { id: string; case_number: string; title: string } | null
  staff: { id: string; name: string } | null
}

const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  research: { label: 'Судалгаа', color: 'bg-blue-500/20 text-blue-400' },
  drafting: { label: 'Бичиг баримт', color: 'bg-purple-500/20 text-purple-400' },
  court: { label: 'Шүүх', color: 'bg-red-500/20 text-red-400' },
  meeting: { label: 'Уулзалт', color: 'bg-green-500/20 text-green-400' },
  travel: { label: 'Зорчилт', color: 'bg-orange-500/20 text-orange-400' },
  admin: { label: 'Захиргаа', color: 'bg-slate-500/20 text-slate-400' },
  other: { label: 'Бусад', color: 'bg-yellow-500/20 text-yellow-400' },
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

export default function TimeTrackingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [entry, setEntry] = useState<TimeEntryDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

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

    const { data } = await supabase
      .from('time_entries')
      .select(`
        id, case_id, staff_id, description, hours, rate, amount, billable, billed,
        entry_date, start_time, end_time, activity_type, notes, created_at, updated_at,
        legal_cases(id, case_number, title),
        staff(id, name)
      `)
      .eq('id', id)
      .eq('store_id', store.id)
      .single()

    if (!data) {
      router.push('/dashboard/time-tracking')
      return
    }

    setEntry(data as unknown as TimeEntryDetail)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function startEdit() {
    if (!entry) return
    setEditData({
      description: entry.description || '',
      hours: entry.hours ?? '',
      rate: entry.rate ?? '',
      billable: entry.billable ?? false,
      activity_type: entry.activity_type || 'other',
      notes: entry.notes || '',
    })
    setIsEditing(true)
  }

  async function handleSave() {
    if (!entry) return
    setSaving(true)
    try {
      const changes: Record<string, unknown> = {}
      const original: Record<string, unknown> = {
        description: entry.description || '',
        hours: entry.hours ?? '',
        rate: entry.rate ?? '',
        billable: entry.billable ?? false,
        activity_type: entry.activity_type || 'other',
        notes: entry.notes || '',
      }

      for (const key of Object.keys(editData)) {
        if (String(editData[key]) !== String(original[key])) {
          if (key === 'hours' || key === 'rate') {
            changes[key] = editData[key] === '' ? null : Number(editData[key])
          } else if (key === 'billable') {
            changes[key] = editData[key]
          } else {
            changes[key] = editData[key]
          }
        }
      }

      if (Object.keys(changes).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/time-entries/${id}`, {
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

  if (!entry) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Цагийн бүртгэл олдсонгүй</p>
        <Link href="/dashboard/time-tracking" className="text-blue-400 hover:text-blue-300 mt-2 inline-block">
          Буцах
        </Link>
      </div>
    )
  }

  const ac = ACTIVITY_TYPE_CONFIG[entry.activity_type || 'other'] || { label: entry.activity_type || '-', color: 'bg-slate-500/20 text-slate-400' }
  const inputClassName = 'w-full px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/time-tracking"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Цагийн бүртгэл</h1>
              {isEditing ? (
                <select
                  value={editData.activity_type as string}
                  onChange={e => setEditData({ ...editData, activity_type: e.target.value })}
                  className={`${inputClassName} !w-auto`}
                >
                  <option value="research">Судалгаа</option>
                  <option value="drafting">Бичиг баримт</option>
                  <option value="court">Шүүх</option>
                  <option value="meeting">Уулзалт</option>
                  <option value="travel">Зорчилт</option>
                  <option value="admin">Захиргаа</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${ac.color}`}>
                  {ac.label}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${entry.billable ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                {entry.billable ? 'Төлбөртэй' : 'Төлбөргүй'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${entry.billed ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {entry.billed ? 'Нэхэмжилсэн' : 'Нэхэмжлээгүй'}
              </span>
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
            <p className="text-slate-400 mt-1">{entry.description || 'Тайлбаргүй'}</p>
          </div>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entry Info Card */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-sm text-slate-400 font-medium mb-4">Цагийн мэдээлэл</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500">Тайлбар</p>
              {isEditing ? (
                <input
                  type="text"
                  value={editData.description as string}
                  onChange={e => setEditData({ ...editData, description: e.target.value })}
                  className={`${inputClassName} mt-1`}
                />
              ) : (
                <p className="text-white mt-1">{entry.description || '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үйл ажиллагааны төрөл</p>
              {isEditing ? (
                <select
                  value={editData.activity_type as string}
                  onChange={e => setEditData({ ...editData, activity_type: e.target.value })}
                  className={`${inputClassName} mt-1`}
                >
                  <option value="research">Судалгаа</option>
                  <option value="drafting">Бичиг баримт</option>
                  <option value="court">Шүүх</option>
                  <option value="meeting">Уулзалт</option>
                  <option value="travel">Зорчилт</option>
                  <option value="admin">Захиргаа</option>
                  <option value="other">Бусад</option>
                </select>
              ) : (
                <p className="text-white mt-1">{ac.label}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Огноо</p>
              <p className="text-white mt-1">{formatDate(entry.entry_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Эхлэх цаг</p>
              <p className="text-white mt-1">{entry.start_time || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Дуусах цаг</p>
              <p className="text-white mt-1">{entry.end_time || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Цаг</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editData.hours as string | number}
                  onChange={e => setEditData({ ...editData, hours: e.target.value })}
                  className={`${inputClassName} mt-1`}
                  min="0"
                  step="0.25"
                />
              ) : (
                <p className="text-white mt-1">{entry.hours != null ? `${entry.hours} цаг` : '-'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Үүсгэсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(entry.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Шинэчилсэн</p>
              <p className="text-slate-300 mt-1">{formatDateTime(entry.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Case Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Хэрэг</h3>
            {entry.legal_cases ? (
              <div>
                <p className="text-white font-medium">{entry.legal_cases.case_number}</p>
                <p className="text-slate-400 text-sm">{entry.legal_cases.title}</p>
                <Link
                  href={`/dashboard/legal-cases/${entry.legal_cases.id}`}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                >
                  Дэлгэрэнгүй
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Хэрэг холбоогүй</p>
            )}
          </div>

          {/* Staff Card */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h3 className="text-sm text-slate-400 font-medium mb-3">Ажилтан</h3>
            {entry.staff ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">
                    {entry.staff.name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{entry.staff.name}</p>
                  <p className="text-slate-400 text-xs">Хариуцсан ажилтан</p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Томилоогүй</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 font-medium mb-4">Төлбөрийн мэдээлэл</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Цаг</p>
            {isEditing ? (
              <input
                type="number"
                value={editData.hours as string | number}
                onChange={e => setEditData({ ...editData, hours: e.target.value })}
                className={`${inputClassName} mt-1`}
                min="0"
                step="0.25"
              />
            ) : (
              <p className="text-lg text-white font-medium mt-1">{entry.hours != null ? `${entry.hours} цаг` : '-'}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Үнэ (цагт)</p>
            {isEditing ? (
              <input
                type="number"
                value={editData.rate as string | number}
                onChange={e => setEditData({ ...editData, rate: e.target.value })}
                className={`${inputClassName} mt-1`}
                min="0"
                step="1"
              />
            ) : (
              <p className="text-lg text-white font-medium mt-1">{formatPrice(entry.rate)}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500">Нийт дүн</p>
            <p className="text-lg text-green-400 font-medium mt-1">{formatPrice(entry.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Төлбөртэй эсэх</p>
            {isEditing ? (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editData.billable as boolean}
                  onChange={e => setEditData({ ...editData, billable: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-white">{editData.billable ? 'Тийм' : 'Үгүй'}</span>
              </label>
            ) : (
              <p className={`text-lg font-medium mt-1 ${entry.billable ? 'text-green-400' : 'text-slate-400'}`}>
                {entry.billable ? 'Тийм' : 'Үгүй'}
              </p>
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
            {entry.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Footer Meta */}
      <div className="text-sm text-slate-500 flex gap-6">
        <span>Үүсгэсэн: {formatDateTime(entry.created_at)}</span>
        <span>Шинэчилсэн: {formatDateTime(entry.updated_at)}</span>
      </div>
    </div>
  )
}
