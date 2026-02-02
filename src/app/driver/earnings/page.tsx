'use client'

import { useEffect, useState } from 'react'

interface EarningsSummary {
  today: number
  week: number
  month: number
  total: number
  today_count: number
  week_count: number
  month_count: number
  total_count: number
}

interface DeliveryHistory {
  id: string
  delivery_number: string
  delivery_address: string
  delivery_fee: number
  actual_delivery_time: string | null
  created_at: string
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('mn-MN').format(amount) + '₮'
}

export default function DriverEarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [history, setHistory] = useState<DeliveryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    async function load() {
      try {
        const [summaryRes, historyRes] = await Promise.all([
          fetch('/api/driver/earnings'),
          fetch(`/api/driver/earnings/history?page=${page}&limit=15`),
        ])

        if (summaryRes.ok) {
          setSummary(await summaryRes.json())
        }
        if (historyRes.ok) {
          const data = await historyRes.json()
          setHistory(data.deliveries)
          setTotalPages(data.pages)
        }
      } catch {
        console.error('Failed to load earnings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page])

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Орлого</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-xs font-medium">Өнөөдөр</p>
          <p className="text-white text-xl font-bold mt-1">{formatPrice(summary.today)}</p>
          <p className="text-green-400/70 text-xs mt-0.5">{summary.today_count} хүргэлт</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-xs font-medium">Энэ долоо хоног</p>
          <p className="text-white text-xl font-bold mt-1">{formatPrice(summary.week)}</p>
          <p className="text-blue-400/70 text-xs mt-0.5">{summary.week_count} хүргэлт</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-purple-500/30 rounded-xl p-4">
          <p className="text-purple-400 text-xs font-medium">Энэ сар</p>
          <p className="text-white text-xl font-bold mt-1">{formatPrice(summary.month)}</p>
          <p className="text-purple-400/70 text-xs mt-0.5">{summary.month_count} хүргэлт</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-400 text-xs font-medium">Нийт</p>
          <p className="text-white text-xl font-bold mt-1">{formatPrice(summary.total)}</p>
          <p className="text-amber-400/70 text-xs mt-0.5">{summary.total_count} хүргэлт</p>
        </div>
      </div>

      {/* Delivery History */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold text-sm">Хүргэлтийн түүх</h2>
        </div>

        {history.length > 0 ? (
          <div className="divide-y divide-slate-700/50">
            {history.map(d => (
              <div key={d.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">#{d.delivery_number}</p>
                  <p className="text-slate-400 text-xs truncate mt-0.5">{d.delivery_address}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(d.actual_delivery_time || d.created_at).toLocaleDateString('mn-MN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-green-400 font-semibold text-sm">+{formatPrice(Number(d.delivery_fee) || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm">Хүргэлтийн түүх байхгүй</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-700 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg disabled:opacity-30 hover:bg-slate-600 transition-colors"
            >
              Өмнөх
            </button>
            <span className="text-slate-400 text-xs">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-lg disabled:opacity-30 hover:bg-slate-600 transition-colors"
            >
              Дараах
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
