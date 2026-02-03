'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PosSessionRow {
  id: string
  store_id: string
  opened_by: string
  closed_by: string | null
  register_name: string
  opening_cash: number
  closing_cash: number | null
  total_sales: number
  total_transactions: number
  status: string
  opened_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
}

interface StaffMember {
  id: string
  name: string
}

function formatCurrency(amount: number) {
  return amount.toLocaleString() + '₮'
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PosSessionsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState<string>('')
  const [sessions, setSessions] = useState<PosSessionRow[]>([])
  const [staffMap, setStaffMap] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState('')
  const [closingSessionId, setClosingSessionId] = useState<string | null>(null)
  const [closingCash, setClosingCash] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSessions = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('store_id', sid)
      .order('opened_at', { ascending: false })

    if (data) {
      setSessions(data as unknown as PosSessionRow[])
    }
  }, [supabase])

  const loadStaff = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from('staff')
      .select('id, name')
      .eq('store_id', sid)

    if (data) {
      const map: Record<string, string> = {}
      for (const s of data as unknown as StaffMember[]) {
        map[s.id] = s.name
      }
      setStaffMap(map)
    }
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (store) {
        setStoreId(store.id)
        await Promise.all([
          loadSessions(store.id),
          loadStaff(store.id),
        ])
      }
      setLoading(false)
    }
    init()
  }, [supabase, router, loadSessions, loadStaff])

  const stats = useMemo(() => {
    const total = sessions.length
    const openSessions = sessions.filter(s => s.status === 'open').length
    const totalSales = sessions.reduce((sum, s) => sum + (s.total_sales || 0), 0)
    const totalTransactions = sessions.reduce((sum, s) => sum + (s.total_transactions || 0), 0)
    return { total, openSessions, totalSales, totalTransactions }
  }, [sessions])

  const filtered = useMemo(() => {
    if (!statusFilter) return sessions
    return sessions.filter(s => s.status === statusFilter)
  }, [sessions, statusFilter])

  function getStaffName(staffId: string) {
    return staffMap[staffId] || staffId.slice(0, 8) + '...'
  }

  async function handleCloseSession(sessionId: string) {
    if (!closingCash.trim()) {
      setError('Please enter the closing cash amount')
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const cashAmount = parseFloat(closingCash)
      if (isNaN(cashAmount) || cashAmount < 0) {
        throw new Error('Please enter a valid cash amount')
      }

      const { error: updateError } = await supabase
        .from('pos_sessions')
        .update({
          status: 'closed',
          closing_cash: cashAmount,
          closed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (updateError) throw updateError

      await loadSessions(storeId)
      setClosingSessionId(null)
      setClosingCash('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close session')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">POS Sessions</h1>
          <p className="text-slate-400 mt-1">
            {sessions.length} sessions total
            {filtered.length !== sessions.length && ` (${filtered.length} shown)`}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-sm">Total Sessions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Open Sessions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.openSessions}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Total Sales</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(stats.totalSales)}</p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-indigo-400 text-sm">Total Transactions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalTransactions.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-pink-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
        {statusFilter && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-pink-400 hover:text-pink-300 transition-all"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Close Session Modal */}
      {closingSessionId && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Close Session</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Closing Cash Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="Enter cash in register"
              className="w-full max-w-sm px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition-all"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleCloseSession(closingSessionId)}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl disabled:opacity-50 transition-all"
            >
              {actionLoading ? 'Closing...' : 'Close Session'}
            </button>
            <button
              onClick={() => { setClosingSessionId(null); setClosingCash(''); setError('') }}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Register</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Opened By</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Opening Cash</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Closing Cash</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Total Sales</th>
                <th className="text-right py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Transactions</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Opened At</th>
                <th className="text-center py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => {
                const isOpen = session.status === 'open'
                return (
                  <tr key={session.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-white font-medium">{session.register_name}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-300">{getStaffName(session.opened_by)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isOpen
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{formatCurrency(session.opening_cash)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">
                        {session.closing_cash != null ? formatCurrency(session.closing_cash) : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-white font-medium">{formatCurrency(session.total_sales)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-right">
                      <span className="text-slate-300">{session.total_transactions.toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6">
                      <span className="text-slate-400 text-sm">{formatDateTime(session.opened_at)}</span>
                    </td>
                    <td className="py-3 px-3 md:py-4 md:px-6 text-center">
                      {isOpen ? (
                        <button
                          onClick={() => {
                            setClosingSessionId(session.id)
                            setClosingCash('')
                            setError('')
                          }}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-all"
                        >
                          Close Session
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : sessions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No sessions match your current filter</p>
          <button
            onClick={() => setStatusFilter('')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">&#128179;</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No POS Sessions Yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            POS sessions will appear here when registers are opened for sales.
          </p>
        </div>
      )}
    </div>
  )
}
