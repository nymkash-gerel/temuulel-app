'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TransferItem {
  id: string
  product_id: string
  quantity: number
  received_quantity: number | null
}

interface StockTransfer {
  id: string
  store_id: string
  from_location_id: string | null
  to_location_id: string | null
  status: string
  initiated_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  transfer_items: TransferItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  in_transit: { label: 'Тээвэрлэж буй', color: 'bg-blue-500/20 text-blue-400' },
  received: { label: 'Хүлээн авсан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_FLOW: Record<string, string> = {
  pending: 'in_transit',
  in_transit: 'received',
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  in_transit: 'Тээвэрлэх',
  received: 'Хүлээн авах',
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

export default function StockTransferDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const transferId = params.id as string

  const [transfer, setTransfer] = useState<StockTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')

  async function loadTransfer() {
    try {
      const res = await fetch(`/api/stock-transfers/${transferId}`)
      if (res.ok) {
        const data = await res.json()
        setTransfer(data)
      } else {
        router.push('/dashboard/stock-transfers')
        return
      }
    } catch {
      router.push('/dashboard/stock-transfers')
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

      await loadTransfer()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId])

  function startEdit() {
    if (!transfer) return
    setEditStatus(transfer.status)
    setEditNotes(transfer.notes || '')
    setIsEditing(true)
  }

  async function handleSave() {
    if (!transfer) return
    setSaving(true)

    try {
      const changed: Record<string, unknown> = {}
      if (editStatus !== transfer.status) changed.status = editStatus
      if (editNotes !== (transfer.notes || '')) changed.notes = editNotes || null

      if (Object.keys(changed).length === 0) {
        setIsEditing(false)
        setSaving(false)
        return
      }

      const res = await fetch(`/api/stock-transfers/${transfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })

      if (res.ok) {
        setIsEditing(false)
        await loadTransfer()
      } else {
        alert('Хадгалахад алдаа гарлаа')
      }
    } catch {
      alert('Хадгалахад алдаа гарлаа')
    }

    setSaving(false)
  }

  async function handleStatusAdvance(newStatus: string) {
    if (!transfer) return

    const confirmMessages: Record<string, string> = {
      in_transit: 'Тээвэрлэж эхлэх үү?',
      received: 'Бараа бүгдийг хүлээн авсан гэж тэмдэглэх үү?',
      cancelled: 'Энэ шилжүүлгийг цуцлах уу?',
    }

    if (!confirm(confirmMessages[newStatus] || `Төлөв "${newStatus}" болгох уу?`)) return

    setActionLoading(true)

    try {
      const res = await fetch(`/api/stock-transfers/${transfer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        await loadTransfer()
      }
    } catch {
      // keep state unchanged
    }

    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!transfer) return null

  const sc = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending
  const nextStatus = STATUS_FLOW[transfer.status]
  const nextLabel = nextStatus ? STATUS_ACTION_LABELS[nextStatus] : null
  const items = transfer.transfer_items || []
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const totalReceived = items.reduce((s, i) => s + (i.received_quantity || 0), 0)
  const receiveProgress = totalQty > 0 ? Math.min(Math.round((totalReceived / totalQty) * 100), 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/stock-transfers"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          >
            &larr;
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                Нөөцийн шилжүүлэг
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-slate-400 mt-1 font-mono text-sm">{transfer.id.slice(0, 8)}...</p>
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
            <>
              <button
                onClick={startEdit}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded-xl text-sm transition-all"
              >
                Засах
              </button>
              {transfer.status !== 'received' && transfer.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusAdvance('cancelled')}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  Цуцлах
                </button>
              )}
              {nextStatus && nextLabel && (
                <button
                  onClick={() => handleStatusAdvance(nextStatus)}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                >
                  {actionLoading ? '...' : nextLabel}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Transfer Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Шилжүүлгийн мэдээлэл</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Дугаар</span>
              <span className="text-white font-mono text-xs">{transfer.id.slice(0, 12)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Төлөв</span>
              {isEditing ? (
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="pending">Хүлээгдэж буй</option>
                  <option value="in_transit">Тээвэрлэж буй</option>
                  <option value="received">Хүлээн авсан</option>
                  <option value="cancelled">Цуцлагдсан</option>
                </select>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                  {sc.label}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хүлээн авалт</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      receiveProgress === 100 ? 'bg-green-500' : receiveProgress > 0 ? 'bg-yellow-500' : 'bg-slate-600'
                    }`}
                    style={{ width: `${receiveProgress}%` }}
                  />
                </div>
                <span className="text-slate-300 text-xs">{receiveProgress}%</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Хүлээгдэж буй &rarr; Тээвэрлэж буй &rarr; Хүлээн авсан
            </div>
          </div>
        </div>

        {/* Locations */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Байршил</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хаанаас</span>
              <span className="text-white font-mono text-xs">
                {transfer.from_location_id ? transfer.from_location_id.slice(0, 8) + '...' : '-'}
              </span>
            </div>
            <div className="flex items-center justify-center text-slate-500 my-2">
              &darr;
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хаашаа</span>
              <span className="text-white font-mono text-xs">
                {transfer.to_location_id ? transfer.to_location_id.slice(0, 8) + '...' : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-700">
              <span className="text-slate-400">Эхлүүлсэн</span>
              <span className="text-slate-300 text-xs">
                {transfer.initiated_by ? transfer.initiated_by.slice(0, 8) + '...' : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-white font-medium mb-4">Тоо хэмжээ</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Нийт бараа</span>
              <span className="text-white font-medium">{items.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Илгээсэн тоо</span>
              <span className="text-white font-medium">{totalQty}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Хүлээн авсан тоо</span>
              <span className="text-white font-medium">{totalReceived}</span>
            </div>
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
            {transfer.notes || 'Тэмдэглэл байхгүй'}
          </p>
        )}
      </div>

      {/* Transfer Items Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-white font-medium">
            Шилжүүлгийн бараа ({items.length})
          </h3>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Бүтээгдэхүүн ID</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Илгээсэн тоо</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Хүлээн авсан тоо</th>
                  <th className="text-center py-3 px-6 text-xs font-medium text-slate-400 uppercase tracking-wider">Хүлээн авалт</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const itemProgress = item.quantity > 0
                    ? Math.round(((item.received_quantity || 0) / item.quantity) * 100)
                    : 0
                  return (
                    <tr key={item.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-all">
                      <td className="py-3 px-6 text-slate-400 text-sm">{idx + 1}</td>
                      <td className="py-3 px-6">
                        <span className="text-white text-sm font-mono">{item.product_id.slice(0, 8)}...</span>
                      </td>
                      <td className="py-3 px-6 text-right text-slate-300 text-sm">{item.quantity}</td>
                      <td className="py-3 px-6 text-right text-slate-300 text-sm">{item.received_quantity ?? 0}</td>
                      <td className="py-3 px-6 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          itemProgress === 100
                            ? 'bg-green-500/20 text-green-400'
                            : itemProgress > 0
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-slate-500/20 text-slate-400'
                        }`}>
                          {itemProgress}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td colSpan={2} className="py-3 px-6 text-slate-400 text-sm font-medium">Нийт</td>
                  <td className="py-3 px-6 text-right text-white text-sm font-medium">{totalQty}</td>
                  <td className="py-3 px-6 text-right text-white text-sm font-medium">{totalReceived}</td>
                  <td className="py-3 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      receiveProgress === 100
                        ? 'bg-green-500/20 text-green-400'
                        : receiveProgress > 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {receiveProgress}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400 text-sm">Энэ шилжүүлэгт бараа байхгүй байна</p>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-white font-medium mb-4">Цаг хугацаа</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Үүсгэсэн</span>
            <span className="text-slate-300">{formatDateTime(transfer.created_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Шинэчлэгдсэн</span>
            <span className="text-slate-300">{formatDateTime(transfer.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
