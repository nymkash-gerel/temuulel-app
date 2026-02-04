'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TableSession {
  id: string
  table_name: string
  server_name: string | null
  guest_count: number
  seated_at: string
  status: 'active' | 'closed'
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-500/20 text-blue-400',
  closed: 'bg-green-500/20 text-green-400',
}

function formatDuration(seatedAt: string): string {
  const diff = Date.now() - new Date(seatedAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m`
}

export default function FloorManagementPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<TableSession[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)

  // Busy mode state
  const [busyMode, setBusyMode] = useState(false)
  const [busyMessage, setBusyMessage] = useState('')
  const [busyWait, setBusyWait] = useState<number | ''>('')
  const [savingBusy, setSavingBusy] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/table-sessions?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Failed to fetch table sessions')
      }
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : data.sessions || [])
    } catch {
      setError('Could not load table sessions')
    } finally {
      setLoading(false)
    }
  }, [supabase, statusFilter])

  const fetchBusyMode = useCallback(async () => {
    try {
      const res = await fetch('/api/stores/busy-mode')
      if (res.ok) {
        const data = await res.json()
        setBusyMode(data.busy_mode ?? false)
        setBusyMessage(data.busy_message ?? '')
        setBusyWait(data.estimated_wait_minutes ?? '')
      }
    } catch {
      // ignore - non-critical
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    fetchBusyMode()
  }, [fetchSessions, fetchBusyMode])

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions

    const q = search.trim().toLowerCase()
    return sessions.filter((s) =>
      s.table_name?.toLowerCase().includes(q) ||
      s.server_name?.toLowerCase().includes(q)
    )
  }, [sessions, search])

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status === 'active')
    const totalGuests = active.reduce((sum, s) => sum + (s.guest_count || 0), 0)
    return {
      activeSessions: active.length,
      availableTables: sessions.filter((s) => s.status === 'closed').length,
      totalGuests,
    }
  }, [sessions])

  async function handleCloseSession(sessionId: string) {
    setClosingId(sessionId)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/table-sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, status: 'closed' }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to close session')
      }

      setSuccess('Session closed successfully')
      await fetchSessions()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setClosingId(null)
    }
  }

  async function handleBusyToggle(newBusy: boolean) {
    setSavingBusy(true)
    try {
      const res = await fetch('/api/stores/busy-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busy_mode: newBusy,
          busy_message: newBusy ? (busyMessage || null) : null,
          estimated_wait_minutes: newBusy && busyWait ? Number(busyWait) : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update busy mode')
      const data = await res.json()
      setBusyMode(data.busy_mode)
      setBusyMessage(data.busy_message ?? '')
      setBusyWait(data.estimated_wait_minutes ?? '')
      setSuccess(newBusy ? 'Завгүй горим идэвхжлээ' : 'Завгүй горим унтарлаа')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSavingBusy(false)
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
          <h1 className="text-2xl font-bold text-white">Floor Management</h1>
          <p className="text-slate-400 mt-1">
            {sessions.length} sessions total
            {filtered.length !== sessions.length && ` (${filtered.length} results)`}
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Busy Mode Panel */}
      <div className={`mb-6 border rounded-xl p-4 ${busyMode ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">{busyMode ? '🔴' : '🟢'}</span>
            <div>
              <h3 className="text-sm font-medium text-white">
                {busyMode ? 'Завгүй горим идэвхтэй' : 'Захиалга авч байна'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {busyMode
                  ? 'Шинэ захиалга хүлээн авахгүй байна'
                  : 'Шинэ захиалга хэвийн хүлээн авч байна'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleBusyToggle(!busyMode)}
            disabled={savingBusy}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              busyMode ? 'bg-red-600' : 'bg-green-600'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
              busyMode ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {busyMode && (
          <div className="mt-4 pt-4 border-t border-red-500/20 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Мессеж (сонголтоор)</label>
              <input
                type="text"
                value={busyMessage}
                onChange={(e) => setBusyMessage(e.target.value)}
                onBlur={() => handleBusyToggle(true)}
                placeholder="Жишээ: Одоогоор завгүй байна"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Хүлээх хугацаа (минут)</label>
              <input
                type="number"
                min="0"
                max="180"
                value={busyWait}
                onChange={(e) => setBusyWait(e.target.value ? Number(e.target.value) : '')}
                onBlur={() => handleBusyToggle(true)}
                placeholder="30"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm">Active Sessions</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.activeSessions}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <p className="text-green-400 text-sm">Available Tables</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.availableTables}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <p className="text-purple-400 text-sm">Total Guests</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalGuests}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by table or server name..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Table</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Server</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Guests</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Seated At</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Duration</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left py-3 px-3 md:py-4 md:px-6 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => (
                <tr key={session.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-all">
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white font-medium">{session.table_name}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{session.server_name || '-'}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-white text-sm">{session.guest_count}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">
                      {new Date(session.seated_at).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className="text-slate-300 text-sm">{formatDuration(session.seated_at)}</span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[session.status] || 'bg-slate-500/20 text-slate-400'}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 md:py-4 md:px-6">
                    {session.status === 'active' && (
                      <button
                        onClick={() => handleCloseSession(session.id)}
                        disabled={closingId === session.id}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {closingId === session.id ? 'Closing...' : 'Close Session'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : sessions.length > 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <p className="text-slate-400">No sessions match your search</p>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-12 text-center">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No table sessions yet</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Table sessions will appear here when guests are seated.
          </p>
        </div>
      )}
    </div>
  )
}
