'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveStoreId } from '@/lib/resolve-store'

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

interface TransfersResponse {
  data: StockTransfer[]
  total: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Хүлээгдэж буй', color: 'bg-yellow-500/20 text-yellow-400' },
  in_transit: { label: 'Тээвэрлэж буй', color: 'bg-blue-500/20 text-blue-400' },
  received: { label: 'Хүлээн авсан', color: 'bg-green-500/20 text-green-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-500/20 text-red-400' },
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Бүгд' },
  { value: 'pending', label: 'Хүлээгдэж буй' },
  { value: 'in_transit', label: 'Тээвэрлэж буй' },
  { value: 'received', label: 'Хүлээн авсан' },
  { value: 'cancelled', label: 'Цуцлагдсан' },
]

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function StockTransfersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadTransfers = useCallback(async () => {
    // Send the status filter + a high limit to the API so filtering/KPIs cover the
    // whole dataset, not just the default-paginated first page.
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/stock-transfers?${params.toString()}`)
    if (res.ok) {
      const json: TransfersResponse = await res.json()
      setTransfers(json.data || [])
    }
  }, [statusFilter])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const storeId = await resolveStoreId(supabase, user.id)
      if (storeId) {
        await loadTransfers()
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadTransfers])

  const stats = useMemo(() => {
    const total = transfers.length
    const pending = transfers.filter(t => t.status === 'pending').length
    const inTransit = transfers.filter(t => t.status === 'in_transit').length
    const received = transfers.filter(t => t.status === 'received').length
    return { total, pending, inTransit, received }
  }, [transfers])

  const filtered = useMemo(() => {
    let rows = transfers
    if (statusFilter) {
      rows = rows.filter(t => t.status === statusFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(t =>
        t.id.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      )
    }
    return rows
  }, [transfers, search, statusFilter])

  function itemCount(t: StockTransfer): number {
    return (t.transfer_items || []).length
  }

  function totalQty(t: StockTransfer): number {
    return (t.transfer_items || []).reduce((s, i) => s + i.quantity, 0)
  }

  function totalReceived(t: StockTransfer): number {
    return (t.transfer_items || []).reduce((s, i) => s + (i.received_quantity || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Нөөцийн шилжүүлэг</h1>
          <p className="text-slate-400 mt-1">
            Нийт {transfers.length} шилжүүлэг
            {filtered.length !== transfers.length && ` (${filtered.length} харагдаж байна)`}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Нийт шилжүүлэг</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">Хүлээгдэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.pending}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Тээвэрлэж буй</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.inTransit}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Хүлээн авсан</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.received}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Хайх</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Дугаар эсвэл тэмдэглэлээр хайх..."
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Төлөв</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
            >
              {STATUS_FILTERS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        {(search || statusFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => { setSearch(''); setStatusFilter('') }}
              className="text-sm text-blue-400 hover:text-blue-300 transition-all"
            >
              Шүүлтүүр цэвэрлэх
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Дугаар</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Төлөв</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Бараа</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Илгээсэн тоо</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Хүлээн авсан тоо</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Үүсгэсэн</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((transfer) => {
                const sc = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending
                return (
                  <tr
                    key={transfer.id}
                    onClick={() => router.push(`/dashboard/stock-transfers/${transfer.id}`)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all cursor-pointer"
                  >
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-mono text-sm">{transfer.id.slice(0, 8)}...</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{itemCount(transfer)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{totalQty(transfer)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{totalReceived(transfer)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">{formatDateTime(transfer.created_at)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : transfers.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">Шүүлтүүрт тохирох шилжүүлэг олдсонгүй</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Шүүлтүүр цэвэрлэх
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128230;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Шилжүүлэг байхгүй байна</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Салбар хооронд бараа шилжүүлэх үед нөөцийн шилжүүлэг энд харагдана.
          </p>
        </div>
      )}
    </div>
  )
}
