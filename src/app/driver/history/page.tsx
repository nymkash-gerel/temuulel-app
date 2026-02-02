'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Delivery {
  id: string
  delivery_number: string
  status: string
  delivery_address: string
  customer_name: string | null
  actual_delivery_time: string | null
  failure_reason: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  delivered: { label: 'Хүргэсэн', color: 'bg-green-500/20 text-green-400' },
  failed: { label: 'Амжилтгүй', color: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-slate-500/20 text-slate-400' },
}

export default function DriverHistoryPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchHistory = useCallback(async (loadMore = false) => {
    try {
      const currentOffset = loadMore ? offset + limit : 0
      const res = await fetch(`/api/driver/deliveries?status=completed&limit=${limit}&offset=${currentOffset}`)
      const data = await res.json()

      if (loadMore) {
        setDeliveries(prev => [...prev, ...(data.deliveries || [])])
      } else {
        setDeliveries(data.deliveries || [])
      }
      setTotal(data.total || 0)
      setOffset(currentOffset)
    } catch {
      console.error('Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => {
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-white font-semibold">Хүргэлтийн түүх</h2>

      {deliveries.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-3">📋</span>
          <p className="text-slate-400">Түүх байхгүй</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {deliveries.map((delivery) => {
              const statusInfo = STATUS_LABELS[delivery.status] || STATUS_LABELS.delivered
              return (
                <Link
                  key={delivery.id}
                  href={`/driver/delivery/${delivery.id}`}
                  className="block bg-slate-800 rounded-xl border border-slate-700 p-3.5 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white font-medium text-sm">{delivery.delivery_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs line-clamp-1">{delivery.delivery_address}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-slate-500 text-xs">
                      {delivery.customer_name || ''}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(delivery.created_at).toLocaleDateString('mn-MN')}
                    </span>
                  </div>
                  {delivery.failure_reason && (
                    <p className="text-red-400 text-xs mt-1">
                      {delivery.failure_reason}
                    </p>
                  )}
                </Link>
              )
            })}
          </div>

          {deliveries.length < total && (
            <button
              onClick={() => fetchHistory(true)}
              className="w-full py-2.5 text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors"
            >
              Цааш үзэх ({total - deliveries.length} үлдсэн)
            </button>
          )}
        </>
      )}
    </div>
  )
}
