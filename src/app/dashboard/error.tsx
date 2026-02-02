'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

export default function DashboardError({
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
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-4">⚠</div>
        <h2 className="text-xl font-bold text-white mb-2">Алдаа гарлаа</h2>
        <p className="text-slate-400 mb-6">
          Хуудсыг ачааллахад алдаа гарлаа. Дахин оролдоно уу.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 mb-4">Код: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white"
          >
            Дахин оролдох
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white"
          >
            Хянах самбар
          </Link>
        </div>
      </div>
    </div>
  )
}
