'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface KdsTicketItem {
  name: string
  quantity: number
  notes?: string
}

interface KdsTicket {
  id: string
  order_number: string | null
  items: KdsTicketItem[] | string | null
  priority: string | null
  status: string
  station_name: string | null
  created_at: string
  updated_at: string | null
}

type KdsColumn = 'new' | 'preparing' | 'ready'

const COLUMN_CONFIG: { key: KdsColumn; label: string; color: string; borderColor: string }[] = [
  { key: 'new', label: 'New', color: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { key: 'preparing', label: 'Preparing', color: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  { key: 'ready', label: 'Ready', color: 'text-green-400', borderColor: 'border-green-500/30' },
]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  preparing: 'bg-yellow-500/20 text-yellow-400',
  ready: 'bg-green-500/20 text-green-400',
  served: 'bg-slate-500/20 text-slate-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const PRIORITY_INDICATOR: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-red-500', label: 'HIGH' },
  rush: { color: 'bg-red-600', label: 'RUSH' },
  normal: { color: 'bg-blue-500', label: 'NORMAL' },
  low: { color: 'bg-slate-500', label: 'LOW' },
}

function formatTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m ago`
}

function parseItems(items: KdsTicketItem[] | string | null): KdsTicketItem[] {
  if (!items) return []
  if (Array.isArray(items)) return items
  try {
    const parsed = JSON.parse(items)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function KitchenDisplayPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<KdsTicket[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchTickets = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/kds-tickets')
      if (!res.ok) {
        throw new Error('Failed to fetch KDS tickets')
      }
      const data = await res.json()
      setTickets(Array.isArray(data) ? data : data.tickets || [])
    } catch {
      setError('Could not load KDS tickets')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Auto-refresh every 30 seconds for live kitchen display
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTickets()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchTickets])

  const columns = useMemo(() => {
    const grouped: Record<KdsColumn, KdsTicket[]> = {
      new: [],
      preparing: [],
      ready: [],
    }

    for (const ticket of tickets) {
      if (ticket.status in grouped) {
        grouped[ticket.status as KdsColumn].push(ticket)
      }
    }

    return grouped
  }, [tickets])

  const stats = useMemo(() => ({
    newCount: columns.new.length,
    preparingCount: columns.preparing.length,
    readyCount: columns.ready.length,
  }), [columns])

  async function handleStatusChange(ticketId: string, newStatus: string) {
    setUpdatingId(ticketId)
    setError(null)

    try {
      const res = await fetch('/api/kds-tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, status: newStatus }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to update ticket')
      }

      await fetchTickets()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setUpdatingId(null)
    }
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
          <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
          <p className="text-slate-400 mt-1">
            {stats.newCount} new / {stats.preparingCount} preparing / {stats.readyCount} ready
          </p>
        </div>
        <button
          onClick={() => fetchTickets()}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-all inline-flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Kanban Columns */}
      {tickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMN_CONFIG.map((col) => (
            <div key={col.key} className={`bg-slate-800/30 border ${col.borderColor} rounded-2xl p-4`}>
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold ${col.color}`}>{col.label}</h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[col.key]}`}>
                  {columns[col.key].length}
                </span>
              </div>

              {/* Ticket Cards */}
              <div className="space-y-3">
                {columns[col.key].map((ticket) => {
                  const items = parseItems(ticket.items)
                  const priority = PRIORITY_INDICATOR[ticket.priority || 'normal'] || PRIORITY_INDICATOR.normal

                  return (
                    <div
                      key={ticket.id}
                      className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all"
                    >
                      {/* Ticket Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-medium text-sm">
                          {ticket.order_number || `#${ticket.id.slice(0, 6)}`}
                        </span>
                        <div className="flex items-center gap-2">
                          {(ticket.priority === 'high' || ticket.priority === 'rush') && (
                            <span className={`px-1.5 py-0.5 ${priority.color} text-white rounded text-[10px] font-bold uppercase`}>
                              {priority.label}
                            </span>
                          )}
                          <span className="text-slate-400 text-xs">
                            {formatTimeSince(ticket.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      {items.length > 0 ? (
                        <ul className="space-y-1.5 mb-3">
                          {items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-400 text-sm font-bold min-w-[1.5rem]">{item.quantity}x</span>
                              <div>
                                <span className="text-white text-sm">{item.name}</span>
                                {item.notes && (
                                  <p className="text-slate-400 text-xs">{item.notes}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500 text-xs mb-3">No items</p>
                      )}

                      {/* Station */}
                      {ticket.station_name && (
                        <p className="text-slate-400 text-xs mb-3">
                          Station: {ticket.station_name}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {col.key === 'new' && (
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'preparing')}
                            disabled={updatingId === ticket.id}
                            className="flex-1 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingId === ticket.id ? 'Updating...' : 'Start Preparing'}
                          </button>
                        )}
                        {col.key === 'preparing' && (
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'ready')}
                            disabled={updatingId === ticket.id}
                            className="flex-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingId === ticket.id ? 'Updating...' : 'Mark Ready'}
                          </button>
                        )}
                        {col.key === 'ready' && (
                          <button
                            onClick={() => handleStatusChange(ticket.id, 'served')}
                            disabled={updatingId === ticket.id}
                            className="flex-1 px-3 py-1.5 bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingId === ticket.id ? 'Updating...' : 'Mark Served'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {columns[col.key].length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-slate-500 text-sm">No tickets</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No kitchen tickets yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Kitchen tickets will appear here when orders are placed.
          </p>
        </div>
      )}
    </div>
  )
}
