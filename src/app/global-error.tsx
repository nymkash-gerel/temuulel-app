'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
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
    <html lang="mn" className="dark">
      <body className="bg-slate-900 text-white min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="text-6xl mb-4">⚠</div>
          <h1 className="text-2xl font-bold mb-2">Алдаа гарлаа</h1>
          <p className="text-slate-400 mb-6">
            Систем дээр алдаа гарлаа. Дахин оролдоно уу.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-500 mb-4">Код: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Дахин оролдох
          </button>
        </div>
      </body>
    </html>
  )
}
