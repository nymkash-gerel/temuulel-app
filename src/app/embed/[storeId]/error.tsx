'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function EmbedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Чат ачааллахад алдаа гарлаа.</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
        >
          Дахин оролдох
        </button>
      </div>
    </div>
  )
}
