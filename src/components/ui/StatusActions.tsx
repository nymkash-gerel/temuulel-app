'use client'

import { useState } from 'react'
import type { TransitionMap } from '@/lib/status-machine'

interface StatusActionsProps {
  currentStatus: string
  transitions: TransitionMap
  statusLabels: Record<string, string>
  apiPath: string
  onSuccess: () => void
}

const BUTTON_STYLES: Record<string, string> = {
  // Positive / forward
  completed: 'bg-green-600 hover:bg-green-500 text-white',
  delivered: 'bg-green-600 hover:bg-green-500 text-white',
  attended: 'bg-green-600 hover:bg-green-500 text-white',
  checked_out: 'bg-green-600 hover:bg-green-500 text-white',
  approved: 'bg-green-600 hover:bg-green-500 text-white',
  settled: 'bg-green-600 hover:bg-green-500 text-white',
  received: 'bg-green-600 hover:bg-green-500 text-white',
  ready: 'bg-green-600 hover:bg-green-500 text-white',
  // Active / in-progress
  in_progress: 'bg-blue-600 hover:bg-blue-500 text-white',
  in_repair: 'bg-blue-600 hover:bg-blue-500 text-white',
  checked_in: 'bg-blue-600 hover:bg-blue-500 text-white',
  assigned: 'bg-blue-600 hover:bg-blue-500 text-white',
  processing: 'bg-blue-600 hover:bg-blue-500 text-white',
  washing: 'bg-blue-600 hover:bg-blue-500 text-white',
  drying: 'bg-blue-600 hover:bg-blue-500 text-white',
  ironing: 'bg-blue-600 hover:bg-blue-500 text-white',
  confirmed: 'bg-blue-600 hover:bg-blue-500 text-white',
  // Diagnostic / info
  diagnosed: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  quoted: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  pending_hearing: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  // Hold / pause
  on_hold: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  suspended: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  rescheduled: 'bg-yellow-600 hover:bg-yellow-500 text-white',
  // Negative
  cancelled: 'bg-red-600 hover:bg-red-500 text-white',
  no_show: 'bg-orange-600 hover:bg-orange-500 text-white',
  withdrawn: 'bg-red-600 hover:bg-red-500 text-white',
  skipped: 'bg-slate-600 hover:bg-slate-500 text-white',
  // Archive
  archived: 'bg-slate-600 hover:bg-slate-500 text-white',
  closed: 'bg-slate-600 hover:bg-slate-500 text-white',
}

const DEFAULT_STYLE = 'bg-slate-600 hover:bg-slate-500 text-white'

const DESTRUCTIVE_STATUSES = new Set(['cancelled', 'no_show', 'withdrawn', 'archived'])

export default function StatusActions({
  currentStatus,
  transitions,
  statusLabels,
  apiPath,
  onSuccess,
}: StatusActionsProps) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allowed = transitions[currentStatus] || []
  if (allowed.length === 0) return null

  async function handleAction(newStatus: string) {
    if (DESTRUCTIVE_STATUSES.has(newStatus)) {
      const label = statusLabels[newStatus] || newStatus
      if (!confirm(`"${label}" төлөвт шилжүүлэхдээ итгэлтэй байна уу?`)) return
    }

    setUpdating(newStatus)
    setError(null)

    try {
      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Алдаа гарлаа')
        setUpdating(null)
        return
      }

      setUpdating(null)
      onSuccess()
    } catch {
      setError('Сүлжээний алдаа')
      setUpdating(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allowed.map((status) => {
          const label = statusLabels[status] || status
          const style = BUTTON_STYLES[status] || DEFAULT_STYLE
          const isLoading = updating === status

          return (
            <button
              key={status}
              onClick={() => handleAction(status)}
              disabled={updating !== null}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${style}`}
            >
              {isLoading ? 'Уншиж байна...' : label}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
