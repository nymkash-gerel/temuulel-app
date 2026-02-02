'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface LegalCase {
  id: string
  case_number: string
  title: string
}

interface Customer {
  id: string
  name: string | null
}

interface Retainer {
  id: string
  case_id: string
  client_id: string | null
  initial_amount: number
  current_balance: number
  status: string
  created_at: string
  updated_at: string
  legal_cases: LegalCase | null
  customers: Customer | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Идэвхтэй', color: 'bg-green-500/20 text-green-400' },
  depleted: { label: 'Дууссан', color: 'bg-red-500/20 text-red-400' },
  closed: { label: 'Хаагдсан', color: 'bg-slate-500/20 text-slate-400' },
  refunded: { label: 'Буцаагдсан', color: 'bg-yellow-500/20 text-yellow-400' },
}

function formatPrice(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RetainerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const retainerId = params.id as string

  const [retainer, setRetainer] = useState<Retainer | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')

  async function loadRetainer() {
    try {
      const res = await fetch(`/api/retainers/${retainerId}`)
      if (res.ok) {
        const data = await res.json()
        setRetainer(data)
      } else {
        router.push('/dashboard/retainers')
        return
      }
    } catch {
      router.push('/dashboard/retainers')
      return
    }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!store) { router.push('/dashboard'); return }

      await loadRetainer()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retainerId])

  function startEdit() {
    if (!retainer) return
    setEditStatus(retainer.status)
    setEditNotes('')
    setIsEditing(true)
  }

  async function handleSave() {
    if (!retainer) return
    setSaving(true)

    try {
      const changed: Record<string, unknown> = {}
      if (editStatus !== retainer.status) changed.status = editStatus

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/retainers/${retainer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (res.ok) {
        setIsEditing(false)
        await loadRetainer()
      } else {
        alert('Хадгалахад алдаа гарлаа')
      }
    } catch {
      alert('Хадгалахад алдаа гарлаа')
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!retainer) return null

  const sc = STATUS_CONFIG[retainer.status] || STATUS_CONFIG.active
  const used = retainer.initial_amount - retainer.current_balance
  const usedPercent = retainer.initial_amount > 0
    ? Math.round((used / retainer.initial_amount) * 100)
    : 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/retainers"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                Урьдчилгаа төлбөр
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1">
              {retainer.legal_cases
                ? `${retainer.legal_cases.case_number} - ${retainer.legal_cases.title}`
                : 'Хэрэг тодорхойгүй'}
              {retainer.customers?.name && ` | ${retainer.customers.name}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all disabled:opacity-50"
              >
                Болих
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                {saving ? '...' : 'Хадгалах'}
              </button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all"
            >
              Засах
            </button>
          )}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Case & Client Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Хэрэг / Үйлчлүүлэгч</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хэргийн дугаар</span>
              <span className="text-white font-mono">
                {retainer.legal_cases?.case_number || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хэргийн нэр</span>
              <span className="text-slate-300 text-right max-w-[200px] truncate">
                {retainer.legal_cases?.title || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Үйлчлүүлэгч</span>
              <span className="text-white">
                {retainer.customers?.name || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Санхүүгийн мэдээлэл</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Анхны дүн</span>
              <span className="text-white font-medium">{formatPrice(retainer.initial_amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Одоогийн үлдэгдэл</span>
              <span className="text-green-400 font-medium">{formatPrice(retainer.current_balance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Ашиглагдсан</span>
              <span className="text-slate-300">{formatPrice(used)}</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">Ашиглалт</span>
                <span className="text-slate-300 text-xs">{usedPercent}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    usedPercent > 80 ? 'bg-red-500' : usedPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(usedPercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Төлөв</h3>
          {isEditing ? (
            <div className="space-y-3">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="active">Идэвхтэй</option>
                <option value="depleted">Дууссан</option>
                <option value="closed">Хаагдсан</option>
                <option value="refunded">Буцаагдсан</option>
              </select>
              <div className="text-xs text-slate-500">
                Идэвхтэй &rarr; Дууссан &rarr; Хаагдсан
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Одоогийн төлөв</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Идэвхтэй &rarr; Дууссан &rarr; Хаагдсан
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Balance Overview Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">Үлдэгдлийн тойм</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-2xl font-bold text-white">{formatPrice(retainer.initial_amount)}</p>
            <p className="text-slate-400 text-sm mt-1">Анхны дүн</p>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-xl">
            <p className="text-2xl font-bold text-yellow-400">{formatPrice(used)}</p>
            <p className="text-slate-400 text-sm mt-1">Ашиглагдсан</p>
          </div>
          <div className="text-center p-4 bg-slate-700/30 rounded-xl">
            <p className={`text-2xl font-bold ${retainer.current_balance > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPrice(retainer.current_balance)}
            </p>
            <p className="text-slate-400 text-sm mt-1">Үлдэгдэл</p>
          </div>
        </div>
      </div>

      {/* Notes Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
        <h3 className="text-white font-medium mb-4">Тэмдэглэл</h3>
        {isEditing ? (
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={4}
            placeholder="Тэмдэглэл бичих..."
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
        ) : (
          <p className="text-slate-300 text-sm">
            Тэмдэглэл байхгүй
          </p>
        )}
      </div>

      {/* Timestamps */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Цаг хугацаа</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Үүсгэсэн</span>
            <span className="text-slate-300">{formatDateTime(retainer.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Шинэчлэгдсэн</span>
            <span className="text-slate-300">{formatDateTime(retainer.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
