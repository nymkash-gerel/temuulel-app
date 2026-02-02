'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

export default function RootError({
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
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl mb-4">⚠</div>
        <h2 className="text-xl font-bold mb-2">Алдаа гарлаа</h2>
        <p className="text-slate-400 mb-6">
          Хуудсыг ачааллахад алдаа гарлаа. Дахин оролдоно уу.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 mb-4">Код: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Дахин оролдох
          </button>
          <Link
            href="/"
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Нүүр хуудас
          </Link>
        </div>
      </div>
    </div>
  )
}
