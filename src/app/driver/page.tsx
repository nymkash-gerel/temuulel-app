'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Delivery {
  id: string
  delivery_number: string
  status: string
  delivery_address: string
  customer_name: string | null
  customer_phone: string | null
  estimated_delivery_time: string | null
  delivery_fee: number
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  assigned: { label: 'Оноосон', color: 'bg-yellow-500/20 text-yellow-400', icon: '📋' },
  picked_up: { label: 'Авсан', color: 'bg-blue-500/20 text-blue-400', icon: '📦' },
  in_transit: { label: 'Зам дээр', color: 'bg-purple-500/20 text-purple-400', icon: '🚚' },
  delayed: { label: 'Хоцорсон', color: 'bg-orange-500/20 text-orange-400', icon: '⏳' },
}

const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string }> = {
  assigned: { label: 'Авсан', status: 'picked_up', color: 'from-blue-500 to-blue-600' },
  picked_up: { label: 'Зам дээр', status: 'in_transit', color: 'from-purple-500 to-purple-600' },
  in_transit: { label: 'Хүргэсэн', status: 'delivered', color: 'from-green-500 to-green-600' },
  delayed: { label: 'Зам дээр', status: 'in_transit', color: 'from-purple-500 to-purple-600' },
}

export default function DriverDashboardPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch('/api/driver/deliveries?status=active')
      const data = await res.json()
      setDeliveries(data.deliveries || [])
    } catch {
      console.error('Failed to fetch deliveries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeliveries()
  }, [fetchDeliveries])

  const handleQuickAction = async (deliveryId: string, newStatus: string) => {
    setActionLoading(deliveryId)
    try {
      const res = await fetch(`/api/driver/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await fetchDeliveries()
      }
    } catch {
      console.error('Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  // Stats
  const stats = {
    assigned: deliveries.filter(d => d.status === 'assigned').length,
    picked_up: deliveries.filter(d => d.status === 'picked_up').length,
    in_transit: deliveries.filter(d => d.status === 'in_transit').length,
    delayed: deliveries.filter(d => d.status === 'delayed').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(stats).map(([key, count]) => {
          const config = STATUS_CONFIG[key]
          return (
            <div key={key} className="bg-slate-800 rounded-xl p-2.5 text-center">
              <span className="text-lg">{config.icon}</span>
              <p className="text-xl font-bold text-white mt-0.5">{count}</p>
              <p className="text-xs text-slate-400">{config.label}</p>
            </div>
          )
        })}
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold">Идэвхтэй хүргэлт</h2>
        <button
          onClick={() => { setLoading(true); fetchDeliveries() }}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Шинэчлэх
        </button>
      </div>

      {/* Route Optimize Button */}
      {deliveries.length >= 2 && (
        <button
          onClick={async () => {
            setOptimizing(true)
            try {
              const res = await fetch('/api/driver/deliveries/optimize', { method: 'POST' })
              if (res.ok) {
                const { route } = await res.json()
                // Reorder deliveries based on optimized order
                const orderMap = new Map(route.ordered_stops.map((s: { delivery_id: string; order: number }) => [s.delivery_id, s.order]))
                setDeliveries(prev => [...prev].sort((a, b) => ((orderMap.get(a.id) || 99) as number) - ((orderMap.get(b.id) || 99) as number)))
              } else {
                const err = await res.json()
                alert(err.error || 'Маршрут оновчлох амжилтгүй')
              }
            } catch {
              alert('Алдаа гарлаа')
            } finally {
              setOptimizing(false)
            }
          }}
          disabled={optimizing}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
        >
          {optimizing ? 'Оновчилж байна...' : 'Маршрут оновчлох'}
        </button>
      )}

      {/* Delivery Cards */}
      {deliveries.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-3">📭</span>
          <p className="text-slate-400">Идэвхтэй хүргэлт байхгүй</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map((delivery) => {
            const statusConfig = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.assigned
            const nextAction = NEXT_ACTIONS[delivery.status]
            const isActioning = actionLoading === delivery.id

            return (
              <div key={delivery.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <Link href={`/driver/delivery/${delivery.id}`} className="block p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-white font-medium text-sm">{delivery.delivery_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <p className="text-slate-300 text-sm mb-1 line-clamp-2">{delivery.delivery_address}</p>

                  {delivery.customer_name && (
                    <p className="text-slate-400 text-xs">
                      {delivery.customer_name}
                      {delivery.customer_phone ? ` — ${delivery.customer_phone}` : ''}
                    </p>
                  )}

                  {delivery.delivery_fee > 0 && (
                    <p className="text-slate-500 text-xs mt-1">
                      {delivery.delivery_fee.toLocaleString()}₮
                    </p>
                  )}
                </Link>

                {/* Quick action */}
                {nextAction && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        handleQuickAction(delivery.id, nextAction.status)
                      }}
                      disabled={isActioning}
                      className={`w-full py-2 px-4 bg-gradient-to-r ${nextAction.color} text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50`}
                    >
                      {isActioning ? 'Шинэчилж байна...' : nextAction.label}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
